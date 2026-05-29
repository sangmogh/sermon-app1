import json
import os
import random
import re
import time
from pathlib import Path

from google import genai

from project_env import PROJECT_ROOT, get_bulk_gemini_model, load_ai_env

load_ai_env()
MODEL_NAME = get_bulk_gemini_model()
client = genai.Client()

def _read_float_env(name: str, default: float) -> float:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
        return value if value >= 0 else default
    except ValueError:
        return default


GEMINI_CALL_SLEEP_MIN_SEC = _read_float_env("GEMINI_CALL_SLEEP_MIN_SEC", 8.0)
GEMINI_CALL_SLEEP_MAX_SEC = _read_float_env("GEMINI_CALL_SLEEP_MAX_SEC", 16.0)
if GEMINI_CALL_SLEEP_MAX_SEC < GEMINI_CALL_SLEEP_MIN_SEC:
    GEMINI_CALL_SLEEP_MAX_SEC = GEMINI_CALL_SLEEP_MIN_SEC


def _sleep_before_gemini(label: str) -> None:
    sleep_sec = random.uniform(GEMINI_CALL_SLEEP_MIN_SEC, GEMINI_CALL_SLEEP_MAX_SEC)
    print(f"💤 [{label}] Gemini 호출 전 대기 {sleep_sec:.1f}초...")
    time.sleep(sleep_sec)


# 503(과부하)·500(내부오류)·429(쿼터) 등 일시적 오류 자동 재시도
GEMINI_MAX_RETRIES = int(_read_float_env("GEMINI_MAX_RETRIES", 3))
GEMINI_RETRY_BASE_SEC = _read_float_env("GEMINI_RETRY_BASE_SEC", 30.0)
_RETRYABLE_TOKENS = (
    "503",
    "500",
    "429",
    "unavailable",
    "overloaded",
    "internal",
    "deadline",
    "timeout",
    "high demand",
    "try again",
)


def _is_retryable_gemini_error(err: Exception) -> bool:
    msg = str(err).lower()
    return any(tok in msg for tok in _RETRYABLE_TOKENS)


def _generate_with_retry(label: str, **kwargs):
    """
    client.models.generate_content 호출을 503/500/429 등 일시적 오류에 대해
    지수 백오프(30→60→120초)로 최대 GEMINI_MAX_RETRIES회 재시도한다.
    재시도 불가능한 오류는 즉시 올린다.
    """
    last_err: Exception | None = None
    for attempt in range(1, GEMINI_MAX_RETRIES + 1):
        try:
            return client.models.generate_content(**kwargs)
        except Exception as e:  # noqa: BLE001 - SDK 예외 종류가 다양해 메시지로 판별
            last_err = e
            if attempt >= GEMINI_MAX_RETRIES or not _is_retryable_gemini_error(e):
                raise
            wait_sec = GEMINI_RETRY_BASE_SEC * (2 ** (attempt - 1))
            print(
                f"⏳ [{label}] 일시적 오류 (시도 {attempt}/{GEMINI_MAX_RETRIES}): {e}\n"
                f"   {wait_sec:.0f}초 대기 후 재시도합니다...",
            )
            time.sleep(wait_sec)
    if last_err is not None:
        raise last_err
    raise RuntimeError("Gemini 호출 실패 (원인 불명)")

# 스크립트 원문 타임스탬프 패턴: [05:44]
TIMESTAMP_PATTERN = re.compile(r"\[(\d{1,2}):(\d{2})\]")

# 개역개정 스타일 장:절 참조 (누가복음 19:1-10 등)
BIBLE_REFERENCE_PATTERN = re.compile(
    r"[가-힣]{2,12}(?:복음|서|기)?\s*\d+:\d+(?:-\d+)?"
)

# core_bible_verse 가 이 길이를 넘고 본문처럼 보이면 참조만 추출
CORE_VERSE_MAX_REF_LEN = 48

# grace_notes: 설교 말미·결단 기도 구간과 분리
GRACE_FORBIDDEN_LAST_SECONDS = 180
GRACE_PRAYER_TIME_GAP_SECONDS = 120

# ──────────────────────────────────────────────
# 표준 키워드 태그 80개 (Gemini는 이 목록 안에서만 선택)
# ──────────────────────────────────────────────
STANDARD_KEYWORDS: list[str] = [
    # 하나님
    "하나님 나라", "하나님의 사랑", "하나님의 뜻", "하나님의 임재",
    "하나님의 능력", "하나님의 심판", "하나님 중심", "하나님의 응답",
    # 예수님
    "예수님", "예수님의 마음", "십자가", "부활", "구원",
    # 성령
    "성령", "성령 충만", "성령의 열매", "영적 싸움",
    # 믿음·신앙생활
    "믿음", "회개", "기도", "말씀", "예배", "순종", "결단",
    "감사", "소망", "은혜",
    # 제자도·사명
    "제자", "사명", "섬김", "전도", "헌신", "준비", "겸손", "성실",
    # 관계
    "사랑", "용서", "가정", "부모·효도", "자녀", "관계", "친구",
    "공동체", "소외", "배려", "갈등", "책임",
    # 내면·정서
    "두려움", "자존감", "실망", "교만", "욕심", "의심", "분별",
    "기쁨", "인내", "회복", "자기 이해", "죄·중독", "염려",
    # 삶의 현장
    "직장·일상", "재물·청지기", "시간", "세상 가치관", "고난", "봉사",
    # 종말·구원론
    "종말", "천국", "구원 확신", "심판",
    # 성숙·성장
    "성숙", "성장", "변화", "치유", "축복", "평화", "행함",
]

# 설교당 표준 태그 개수 (고민 검색 교집합·재현율용)
KEYWORD_MIN = 6
KEYWORD_MAX = 10


def _output_path(video_id: str) -> Path:
    return PROJECT_ROOT / "output" / f"result_transcript_{video_id}.json"


def _sermon_date_prompt_block(expected_sermon_date: str | None) -> str:
    if expected_sermon_date:
        return f"""
    [★ sermon_date — 반드시 고정 (유튜브 제목 기준) ★]
    - 이 설교의 예배일은 **{expected_sermon_date}** 입니다.
    - sermon_date 필드에는 반드시 "{expected_sermon_date}" 만 넣으세요.
    - 오디오·본문 속 다른 날짜(역사적 사건, 성경 배경, 추측한 업로드일)는 sermon_date에 쓰지 마세요.
        """
    return """
    [★ sermon_date — 날짜 추출 규칙 ★]
    - 자막 첫 몇 줄, 제목, 예배 안내 문자에서 "2025년 12월 15일", "25.12.15", "2025-12-15" 등을 찾아 YYYY-MM-DD로 변환하라.
    - "주일", "예배" 같은 단어 근처에 날짜가 있으면 그것을 사용하라.
    - 날짜가 두 개 이상 나오면 설교가 전해진 날(예배일)을 우선하라.
    - 정말 어디에도 날짜가 없을 때만 빈 문자열 "".
        """


def _apply_service_metadata(
    parsed_data: dict,
    *,
    service_type: str | None,
    preacher: str | None,
) -> dict:
    """
    예배 종류(service_type)·설교자(preacher) 확정.
    - service_type: 소스(재생목록)에서 넘어온 값이 있으면 그것으로 고정 (Gemini 추측 무시).
    - preacher: 명시적으로 넘어온 값이 있으면 우선, 없으면 Gemini가 추출한 값을 정제(문자열만).
    """
    if service_type:
        parsed_data["service_type"] = service_type

    if preacher and preacher.strip():
        parsed_data["preacher"] = preacher.strip()
    else:
        existing = parsed_data.get("preacher")
        parsed_data["preacher"] = existing.strip() if isinstance(existing, str) else ""

    return parsed_data


def _apply_expected_sermon_date(
    parsed_data: dict, expected_sermon_date: str | None
) -> dict:
    """유튜브 제목에서 확정된 예배일이 있으면 sermon_date를 그 값으로 고정."""
    if not expected_sermon_date:
        return parsed_data
    actual = (parsed_data.get("sermon_date") or "").strip()[:10]
    if actual != expected_sermon_date:
        if actual:
            print(
                f"ℹ️ sermon_date {actual!r} → 유튜브 제목 기준 "
                f"{expected_sermon_date!r} 로 고정",
            )
        parsed_data["sermon_date"] = expected_sermon_date
    return parsed_data


def _build_json_prompt(
    transcript: str | None = None,
    *,
    from_audio: bool = False,
    expected_sermon_date: str | None = None,
) -> str:
    if from_audio:
        source_note = (
            "다음은 교회 예배 설교의 오디오입니다. 청취하여 내용을 분석해 주세요. "
            "각 대지의 시작 시점을 오디오에서 실제로 들리는 위치 기준으로 "
            "start_time_text에 [MM:SS] 형식으로 기록하고, "
            "start_time_seconds는 그 값을 초 단위 정수로 변환하세요."
        )
        timestamp_rules = """
    [타임스탬프 추출 시 절대 주의사항 — 오디오]
    - 타임스탬프는 오디오에서 해당 대지 내용이 실제로 시작되는 시점만 사용하세요.
    - 대지(point_title)를 추출할 때 '첫째, 둘째' 같은 서수 표현은 완전히 제거하고 핵심 명사형 소제목만 적으세요.
    - start_time_text는 반드시 [MM:SS] 형식(대괄호 포함)으로 작성하세요. 예: [05:44]
    - start_time_seconds = 분×60 + 초 (정수). 예: [05:44] → 344
    - 확신이 없는 시점은 points 항목으로 넣지 마세요.
        """
    else:
        source_note = (
            "다음은 교회 예배 설교의 스크립트 원문입니다. "
            "각 문장 앞에는 [분:초] 형태의 타임스탬프가 있습니다."
        )
        timestamp_rules = """
    [타임스탬프 추출 시 절대 주의사항]
    - 타임스탬프는 절대 임의로 지어내거나 유추하지 마세요.
    - 요약한 대지의 내용이 '처음 시작되는' 스크립트 원문의 문장을 찾고,
      그 문장 앞에 적힌 [분:초]를 1글자도 틀리지 말고 그대로 start_time_text에 복사하세요.
    - start_time_text는 반드시 원문에 실제로 존재하는 [MM:SS] 문자열이어야 합니다.
      원문에 없는 타임스탬프를 만들어 쓰면 안 됩니다.
    - start_time_seconds는 추출한 [분:초]를 정수형 초(seconds)로 변환한 값입니다.
      (예: [05:44] → 5×60 + 44 = 344)
    - start_time_seconds는 start_time_text와 항상 일치해야 합니다. 따로 추측하지 마세요.
        """

    standard_keywords_block = (
        "    [★ keywords — 반드시 아래 표준 목록에서만 선택 ★]\n"
        "    아래 목록 외 단어를 keywords에 넣지 마라. 목록에 없는 개념은 가장 가까운 표준 태그로 대체하라.\n"
        f"    개수: {KEYWORD_MIN}~{KEYWORD_MAX}개 (검색용 — 설교에서 다룬 주제·적용을 빠짐없이). # 기호 없이 단어만.\n"
        "    앞쪽에 핵심 주제, 뒤쪽에 부차 주제·적용을 넣어라. 너무 일반적인 태그(믿음·기도)만으로 채우지 마라.\n\n"
        "    허용 목록:\n"
        + ", ".join(STANDARD_KEYWORDS)
        + "\n"
    )

    transcript_block = ""
    if transcript:
        transcript_block = f"\n    [설교 스크립트 원문]\n    {transcript}\n"

    return f"""
    {source_note}
    내용을 분석하여 아래의 JSON 형식에 맞춰서 정확하게 출력해 주세요.
    결과물 앞뒤로 다른 설명이나 마크다운(```) 기호는 절대 덧붙이지 말고 순수 JSON만 출력하세요.

    {{
        "title": "설교의 핵심 주제를 담은 짧은 제목",
        "sermon_date": "설교가 전해진 날짜 YYYY-MM-DD. 자막 서두·제목·안내 문자에 날짜가 있으면 반드시 기재. 정말 전혀 없을 때만 빈 문자열",
        "core_bible_verse": "핵심 본문의 성경 참조만 (예: 누가복음 9:36). 본문 인용 금지",
        "keywords": ["핵심태그1", "핵심태그2", "핵심태그3", "부차태그4", "부차태그5", "부차태그6"],
        "summary": "성도에게 직접 전하는 핵심 메시지 3~4문장 (설교를 바깥에서 설명하지 말고 그 말씀을 선포하듯). 자세한 문체 규칙은 아래 참조",
        "points": [
            {{
                "point_title": "대지 소제목 (서수 '첫째' 제외, 명사형)",
                "start_time_text": "[05:44]",
                "start_time_seconds": 344,
                "description": "이 대지에서 성도에게 전하는 메시지 1~2줄 (설교 해설 아님, 인용문·묵상문도 아님). 문체는 아래 규칙"
            }}
        ],
        "grace_notes": [
            {{
                "quote": "points와 다른 구간의 묵상용 인용 3~4문장 (대지 요약과 중복 금지)",
                "start_time_text": "[15:00]",
                "start_time_seconds": 900
            }}
        ],
        "decision_prayer": {{
            "prayer_text": "설교 말미 결단 기도 전문 (따라 기도할 수 있게)",
            "start_time_text": "[48:30]",
            "start_time_seconds": 2910
        }}
    }}

    {_sermon_date_prompt_block(expected_sermon_date)}

    {standard_keywords_block}
    [★ core_bible_verse (핵심 말씀) — 반드시 참조만 ★]
    - UI에 "누가복음 9:36", "마태복음 5:3-10"처럼 짧은 참조만 표시됩니다.
    - 성경 본문 문장 전체, "이르되 … 하시니라" 같은 인용문은 절대 넣지 마라.
    - 여러 절이면 "누가복음 19:1-10"처럼 장:절 범위만 적어라. 괄호로 감쌀 필요 없다.
    - 핵심 본문을 특정할 수 없을 때만 빈 문자열 "".

    [★ title / keywords — 표기 정확도 ★]
    - 성경 인물·지명은 개역개정 표기를 따르라 (예: 삭개오, 베드로, 갈릴리, 니고데모).
    - 음성 전사 오류를 그대로 쓰지 마라 (예: 사케오 X → 삭개오, 사울/바울 혼동 금지).
    - keywords는 # 없이 단어만 {KEYWORD_MIN}~{KEYWORD_MAX}개(표준 목록만). 인물명이 핵심이면 올바른 표기로 넣어라.

    [★ points vs grace_notes — 역할 분리 (최우선) ★]
    두 필드는 UI에서 나란히 보이므로 내용이 겹치면 안 된다. 반드시 아래 역할을 지켜라.

    [설교 포인트 points = 설교 지도]
    - 목적: 설교의 대지·흐름을 파악하는 목차/개요.
    - point_title: 해당 대지의 짧은 소제목(핵심 명사). "첫째, 둘째" 서수는 쓰지 마라.
    - description: 그 대지의 메시지를 성도에게 직접 전하듯 1~2줄. 보고서체·제3자 시점 금지 (아래 문체 규칙 적용).
    - description에 설교 문장을 길게 인용하거나, grace_notes에 넣을 만한 감동 멘트를 통째로 넣지 마라.
    - 타임스탬프는 그 대지가 처음 시작되는 지점.

    [은혜의 조각 grace_notes = 묵상용 인용]
    - 목적: 성도가 잠시 멈춰 묵상할 수 있는, points와 다른 구간의 메시지.
    - points의 어느 description과도 같은 주제·같은 문장을 반복하지 마라. paraphrase도 중복이다.
    - points에 이미 담은 대지 구간과 같은 start_time_text / 비슷한 시각(±90초 이내)을 쓰지 마라.
    - 설교 **맨 마지막 3분(180초)** 구간은 decision_prayer·마무리 전용이므로 grace_notes에 넣지 마라.
    - decision_prayer의 기도문(prayer_text)·시각(±2분)과 같은 결단·기도 멘트를 grace_notes quote에 넣지 마라.
    - 적합한 독립 구간이 없으면 grace_notes는 빈 배열 [] (억지로 1개 채우지 마라).

    [작성 순서 권장]
    1) points로 대지 전체를 먼저 잡고,
    2) points와 겹치지 않는 구간만 골라 grace_notes를 작성하라.

    [중요 지시사항 — points]
    - 'points' 배열은 목사님의 설교 구조에 따라 유동적으로 작성하세요.
    - 첫째, 둘째, 셋째 등 구분이 명확하다면 그 개수(2~5개)만큼 배열 항목을 생성하세요.
    - 대지 구분이 없는 통설교면 points는 1~2개만 두거나 빈 배열 [].
    - 각 항목에 point_title, start_time_text, start_time_seconds, description을 모두 포함하세요.
    - 예전 필드명 start_time은 사용하지 마세요.
    
    [★ summary(요약 카드)·points의 description 문체 — 절대 규칙 ★]
    (이 규칙은 summary와 각 points.description 에만 적용된다. grace_notes·decision_prayer 에는 적용하지 마라.)

    [핵심 원칙] 설교를 "바깥에서 설명·요약"하지 말고, 목사님이 성도에게 "직접 선포하듯" 말씀 자체를 전하라.

    - 금지 1 (메타 주어): 문장의 주어로 "본 설교는 / 이 설교는 / 목사님은 / 설교자는 / 본문은 / ~이야기는 / ~비유는" 을 쓰지 마라.
      주어는 성경 인물(예: 삭개오, 바디매오), 또는 "우리"·"저와 여러분", 또는 영적 진리 자체여야 한다.
    - 금지 2 (보고 동사): 다음 서술어로 끝맺지 마라 — 강조합니다, 지적합니다, 설명합니다, 전합니다, 보여줍니다, 듭니다, 다룹니다, 당부합니다, 역설합니다, 제시합니다, 밝힙니다, 권면합니다.
    - 금지 3 (명사화 보고체): "~중요성을 강조합니다", "~살 수 있음을 강조합니다", "~해야 함을 역설합니다" 처럼 "~음을/~함을/~임을 + (강조·설명·역설 등)" 으로 메시지를 감싸지 마라. 그 메시지를 그냥 직접 말하라.
    - 금지 4 (첫 문장): 특히 첫 문장을 설교 해설("본 설교는 …", "삭개오의 이야기는 …을 보여줍니다")로 시작하지 마라. 곧바로 말씀·메시지로 들어가라.
    - 불필요한 서론은 자르고, 말씀의 핵심과 성도가 삶에 적용할 결단 위주로 써라.

    [다양성 요구 — 단조로워지지 않게]
    - 시작을 매번 같은 형태로 하지 말고 번갈아 변주하라: (가) 비유·이미지, (나) 선언적 영적 진리, (다) 성경 인물의 행동·고백 서술.
    - 맺음도 한 가지로 굳히지 말고 돌아가며 쓰라: "~합시다", "~되기를 바랍니다", "~되기를 축복합니다", "~나타나야 합니다", "~누리며 살아갑니다".
    - 모든 항목을 "우리는 ~해야 합니다" 한 가지 틀로 시작·종결하지 마라.

    [변환 예시 — 왼쪽(나쁨)을 오른쪽(좋음)처럼 고쳐라]
    - (나쁨) "본 설교는 바디매오의 이야기를 통해 바른 믿음의 중요성을 강조합니다."
      (좋음) "맹인 바디매오는 연약함 속에서도 '다윗의 자손 예수여 나를 불쌍히 여기소서' 부르짖었습니다. 그 간절한 믿음이 그를 살렸습니다. 우리의 믿음도 막연한 지식이 아니라 삶의 변화로 나타나야 합니다."
    - (나쁨) "삭개오의 이야기는 우리에게 기회를 붙잡는 삶의 중요성을 보여줍니다."
      (좋음) "삭개오는 예수님을 만나려 핑계 대지 않고 나무 위로 올라갔습니다. 예수님이 다가오실 때 적극적으로 나아갈 때, 우리 삶에도 획기적인 변화가 찾아옵니다. 지금의 기회를 놓치지 마시기 바랍니다."
    - (나쁨) "목사님은 마귀가 좋아하는 사람의 특징으로 욕심과 교만을 듭니다."
      (좋음) "마귀는 욕심내고 회개하지 않는 마음을 좋아합니다. 우리는 날마다 회개하며 정직한 심령으로 승리하는 성도가 됩시다."

    [좋은 예 — 이미 잘 된 형태]
    - "삶은 흔들리지만 뽑히지 않는 나무와 같습니다. 어려운 순간일수록 하나님께 기도하며, 흔들림 속에서도 견고한 믿음으로 하나님 나라를 이루어 갑시다."
    - "부모님은 하나님이 주신 축복의 통로입니다. 효도할 기회를 놓치지 마시고, 그 순종을 통해 영적 유익과 장수의 복을 누리며 살아갑시다."
    
    [★ grace_notes (은혜의 조각들) — points·결단 기도와 중복 금지 ★]
    설교 **중반·전반**에서 points·decision_prayer에 실리지 않은 별도 영적 깨달음 구간만 골라라.
    반드시 0~2개. points·decision_prayer와 겹치거나 말미 3분이면 0개. 억지로 채우지 마라.

    [엄격한 추출 및 편집 규칙]
    1. 잡담 절대 금지
       - 농담, 개인 일상 썰(밥·설거지·육아·가정 잔소리 등), 단순 인사·안내, 성경 봉독 안내,
         청중 반응 유도("따라 해봐", "아멘", "그렇죠?"), 수사적 반복만 있는 구절은 제외하라.
       - 철저히 신학적·영적으로 의미 있는 메시지(복음, 믿음, 회개, 사랑, 십자가, 성령, 구원, 헌신 등)만 선택하라.

    2. 텍스트 정제 (문맥 다듬기)
       - "~했잖아요", "그니까", "어~", "거기", "나온다니까" 같은 구어체·군더더기는 제거하거나 문어체로 다듬어라.
       - 원문을 기계적으로 베끼지 말고, 읽기 편한 '명언·인용구' 톤으로 교정(Editing)하되 의미는 왜곡하지 마라.

    3. 독립된 메시지
       - 앞뒤 맥락 없이 이 조각만 읽어도 울림이 있게, 완결된 하나의 문단으로 구성하라.

    4. 분량
       - 각 quote는 3~4문장 내외. 너무 길거나 산만하면 안 된다.

    5. 타임스탬프
       - quote의 핵심 내용이 처음 시작되는 지점의 [MM:SS]를 start_time_text에 넣고, start_time_seconds와 일치시켜라.
       - (플랜 A) 원문에 실제로 있는 타임스탬프만 사용하라.

    [나쁜 예 — 이런 quote는 절대 넣지 마라]
    - "고 나오면 나중에 자기가 알아서 할 일이지. 설거지하다 보면 잔소리가 나와… 그런 일은 안 하는 게 좋아." (일상 잡담)
    - "따라 해봐. 다 이유가 있다. … 나만 옳다고 강요하면 교만해진다." (청중 유도·단편적, 정제 부족)
    - "남자는 흙으로… 서운한 게 쌓이자나? … 깨어지기 쉬운 존재가 남편이라는 존재야." (구어체 그대로, 잔소리·수다 위주)

    [좋은 예]
    - "우리가 남을 판단하고 강요할수록 마음은 교만해집니다. 상대에게 이유가 있다는 것을 인정할 때 비로소 겸손이 자랍니다. 오늘 주님 앞에서 내 시선부터 낮추고, 사랑으로 감싸 안을 수 있기를 바랍니다."
    - "남편과 아내는 서로를 깨뜨리기 쉬운 연약한 존재입니다. 그러나 하나님의 사랑 안에서 서로를 둘러싸 안을 때, 집은 작은 교회가 됩니다. 서운함보다 용서와 축복의 말을 먼저 선택합시다."

    [★ decision_prayer (결단의 기도) ★]
    - 설교 맨 마지막 약 1~3분 구간에서 목사님과 성도가 함께 드리는 '결단·마무리 기도'만 추출하라. 이 구간은 grace_notes에 넣지 말고 여기에만 담아라.
    - 기도문은 성도가 그대로 따라 읽으며 기도할 수 있도록, 1인칭 복수(우리, 함께) 기도체로 정제하되 기도의 핵심 표현은 살려라.
    - "아멘", "다 같이 기도합시다" 등 안내 말만 있는 구간은 제외하고, 실제 기도 본문이 시작되는 [MM:SS]를 start_time_text에 넣어라.
    - 구어체 군더더기("어~", "그니까")는 줄이되, 기도의 따뜻함과 결단은 유지하라.
    - 명확한 결단 기도가 없으면 decision_prayer는 null로 두어라.

    {timestamp_rules}
    {transcript_block}
    """


def _time_text_to_seconds(time_text: str) -> int | None:
    """[05:44] 또는 05:44 → 초 단위 정수."""
    match = TIMESTAMP_PATTERN.search(time_text)
    if not match:
        match = re.match(r"^(\d{1,2}):(\d{2})$", time_text.strip())
    if not match:
        return None
    minutes, seconds = int(match.group(1)), int(match.group(2))
    return minutes * 60 + seconds


def _is_short_bible_reference(text: str) -> bool:
    """이미 짧은 참조 형식이면 추가 가공 없음."""
    if len(text) > CORE_VERSE_MAX_REF_LEN:
        return False
    body_markers = ("이르되", "하시니", "하느니", "말씀하", "여호와", "예수께서", "그리하여")
    if any(m in text for m in body_markers):
        return False
    return BIBLE_REFERENCE_PATTERN.search(text) is not None


def _extract_bible_reference(text: str) -> str:
    """본문+괄호 참조 혼합 문자열에서 장:절 참조만 추출."""
    stripped = text.strip()
    if not stripped:
        return ""

    paren = re.search(r"\(([^)]+)\)\s*$", stripped)
    if paren:
        inner = paren.group(1).strip()
        if BIBLE_REFERENCE_PATTERN.fullmatch(inner) or BIBLE_REFERENCE_PATTERN.search(
            inner
        ):
            return inner

    matches = BIBLE_REFERENCE_PATTERN.findall(stripped)
    if matches:
        return matches[-1].strip()

    return stripped


def _enforce_core_bible_verse(parsed_data: dict) -> dict:
    """core_bible_verse를 짧은 참조 형식으로 정규화."""
    raw = parsed_data.get("core_bible_verse")
    if raw is None:
        return parsed_data
    if not isinstance(raw, str):
        parsed_data["core_bible_verse"] = ""
        return parsed_data

    text = raw.strip()
    if not text:
        parsed_data["core_bible_verse"] = ""
        return parsed_data

    if _is_short_bible_reference(text):
        parsed_data["core_bible_verse"] = text
        return parsed_data

    extracted = _extract_bible_reference(text)
    if extracted and extracted != text:
        print(f"ℹ️ core_bible_verse 본문 제거 → 참조만: {extracted!r}")
        text = extracted
    elif len(text) > CORE_VERSE_MAX_REF_LEN:
        print(
            f"⚠️ core_bible_verse 참조 추출 실패 (길이 {len(text)}). "
            "수동 확인 권장."
        )

    parsed_data["core_bible_verse"] = text.strip()
    return parsed_data


def _normalize_for_overlap(text: str) -> str:
    """중복 비교용 간단 정규화."""
    cleaned = re.sub(r"\s+", "", text.lower())
    for ch in ".,!?\"'""''·…":
        cleaned = cleaned.replace(ch, "")
    return cleaned


def _texts_substantially_overlap(a: str, b: str) -> bool:
    """짧은 요약 vs 긴 인용의 포함·유사 여부."""
    na = _normalize_for_overlap(a)
    nb = _normalize_for_overlap(b)
    if not na or not nb:
        return False
    shorter, longer = (na, nb) if len(na) <= len(nb) else (nb, na)
    if len(shorter) < 12:
        return False
    if shorter in longer:
        return True
    # 공통 글자 비율 (한글 설교 문장용 단순 휴리스틱)
    common = sum(1 for ch in shorter if ch in longer)
    return common / len(shorter) >= 0.72


def _collect_timestamp_seconds_from_transcript(transcript: str | None) -> list[int]:
    if not transcript:
        return []
    seconds: list[int] = []
    for match in TIMESTAMP_PATTERN.finditer(transcript):
        seconds.append(int(match.group(1)) * 60 + int(match.group(2)))
    return seconds


def _estimate_sermon_end_seconds(
    parsed_data: dict, transcript: str | None = None
) -> int | None:
    """자막·points·decision_prayer 기준 설교 끝 시각(초) 추정."""
    candidates = _collect_timestamp_seconds_from_transcript(transcript)

    for point in parsed_data.get("points") or []:
        if not isinstance(point, dict):
            continue
        sec = point.get("start_time_seconds")
        if isinstance(sec, (int, float)) and sec == sec:
            candidates.append(int(sec))

    prayer = parsed_data.get("decision_prayer")
    if isinstance(prayer, dict):
        sec = prayer.get("start_time_seconds")
        if isinstance(sec, (int, float)) and sec == sec:
            candidates.append(int(sec))

    if not candidates:
        return None
    return max(candidates)


def _enforce_grace_notes_distinct(
    parsed_data: dict, transcript: str | None = None
) -> dict:
    """
    grace_notes가 points·decision_prayer·말미 3분과 겹치면 제거.
    (모델이 프롬프트를 어겨도 JSON 저장 전 안전장치)
    """
    points = parsed_data.get("points")
    notes = _unwrap_grace_notes(parsed_data.get("grace_notes"))
    parsed_data["grace_notes"] = notes
    if not isinstance(notes, list):
        parsed_data["grace_notes"] = []
        return parsed_data
    if not notes:
        return parsed_data

    point_seconds: list[int] = []
    point_texts: list[str] = []
    if isinstance(points, list):
        for point in points:
            if not isinstance(point, dict):
                continue
            sec = point.get("start_time_seconds")
            if isinstance(sec, (int, float)) and sec == sec:
                point_seconds.append(int(sec))
            for key in ("description", "point_title"):
                val = point.get(key)
                if isinstance(val, str) and val.strip():
                    point_texts.append(val.strip())

    prayer = parsed_data.get("decision_prayer")
    prayer_sec: int | None = None
    prayer_text = ""
    if isinstance(prayer, dict):
        raw_sec = prayer.get("start_time_seconds")
        if isinstance(raw_sec, (int, float)) and raw_sec == raw_sec:
            prayer_sec = int(raw_sec)
        prayer_text = str(
            prayer.get("prayer_text")
            or prayer.get("prayer")
            or prayer.get("text")
            or ""
        ).strip()

    sermon_end = _estimate_sermon_end_seconds(parsed_data, transcript)
    grace_cutoff: int | None = None
    if sermon_end is not None and sermon_end > GRACE_FORBIDDEN_LAST_SECONDS:
        grace_cutoff = sermon_end - GRACE_FORBIDDEN_LAST_SECONDS

    kept: list[dict] = []
    for i, note in enumerate(notes):
        if not isinstance(note, dict):
            continue
        quote = str(note.get("quote") or "").strip()
        if not quote:
            continue

        note_sec = note.get("start_time_seconds")
        parsed_note_sec: int | None = None
        if isinstance(note_sec, (int, float)) and note_sec == note_sec:
            parsed_note_sec = int(note_sec)

        if parsed_note_sec is not None and grace_cutoff is not None:
            if parsed_note_sec >= grace_cutoff:
                print(
                    f"ℹ️ grace_notes[{i}] 제거: 설교 말미 {GRACE_FORBIDDEN_LAST_SECONDS}초 "
                    f"이내 ({parsed_note_sec}s >= {grace_cutoff}s)"
                )
                quote = ""

        if quote and parsed_note_sec is not None and prayer_sec is not None:
            if abs(parsed_note_sec - prayer_sec) <= GRACE_PRAYER_TIME_GAP_SECONDS:
                print(
                    f"ℹ️ grace_notes[{i}] 제거: 결단의 기도와 시각이 너무 가깝습니다 "
                    f"({parsed_note_sec}s vs {prayer_sec}s)"
                )
                quote = ""

        if quote and prayer_text and _texts_substantially_overlap(quote, prayer_text):
            print(f"ℹ️ grace_notes[{i}] 제거: 결단의 기도 문장과 겹칩니다.")
            quote = ""

        if quote and parsed_note_sec is not None:
            for ps in point_seconds:
                if abs(parsed_note_sec - ps) <= 90:
                    print(
                        f"ℹ️ grace_notes[{i}] 제거: points와 시각이 너무 가깝습니다 "
                        f"({parsed_note_sec}s vs {ps}s)"
                    )
                    quote = ""
                    break

        if quote:
            for pt in point_texts:
                if _texts_substantially_overlap(quote, pt):
                    print(
                        f"ℹ️ grace_notes[{i}] 제거: points 설명과 문장이 겹칩니다."
                    )
                    quote = ""
                    break

        if quote:
            kept.append(note)

    if len(kept) < len(notes):
        print(f"ℹ️ grace_notes {len(notes)}개 → {len(kept)}개 (중복 제거)")
    parsed_data["grace_notes"] = kept
    return parsed_data


def _normalize_keywords(parsed_data: dict) -> dict:
    """keywords 배열: # 제거, 표준 목록 필터링, 개수 상한."""
    raw = parsed_data.get("keywords")

    # grace_notes 처럼 가끔 dict 감싸기로 올 때 방어
    if isinstance(raw, dict):
        for key in ("keywords", "tags", "list"):
            if isinstance(raw.get(key), list):
                raw = raw[key]
                break
        else:
            raw = list(raw.values())

    if not isinstance(raw, list):
        parsed_data["keywords"] = []
        return parsed_data

    standard_set = set(STANDARD_KEYWORDS)
    cleaned: list[str] = []
    rejected: list[str] = []

    for item in raw:
        if not isinstance(item, str):
            continue
        word = item.strip().lstrip("#").strip()
        if not word:
            continue
        if word in standard_set:
            if word not in cleaned:
                cleaned.append(word)
        else:
            rejected.append(word)

    if rejected:
        print(f"⚠️ keywords 표준 목록 외 단어 제거: {rejected}")

    if not cleaned:
        print("⚠️ 표준 태그와 일치하는 keywords 없음. 원본 유지.")
        fallback = []
        for item in raw:
            if not isinstance(item, str):
                continue
            word = item.strip().lstrip("#").strip()
            if word and word not in fallback:
                fallback.append(word)
        parsed_data["keywords"] = fallback
        return parsed_data

    if len(cleaned) > KEYWORD_MAX:
        dropped = cleaned[KEYWORD_MAX:]
        cleaned = cleaned[:KEYWORD_MAX]
        print(
            f"⚠️ keywords {KEYWORD_MAX}개 초과 → 앞 {KEYWORD_MAX}개만 유지, 제거: {dropped}"
        )

    if len(cleaned) < KEYWORD_MIN:
        print(
            f"⚠️ keywords {len(cleaned)}개 — 권장 {KEYWORD_MIN}~{KEYWORD_MAX}개 "
            f"(검색 품질용, 재분석 시 보완 권장)"
        )

    parsed_data["keywords"] = cleaned
    return parsed_data


def _unwrap_grace_notes(raw: object) -> list:
    """Gemini가 grace_notes를 dict로 감싸 줄 때 배열 추출."""
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for key in ("grace_notes", "notes", "quotes", "items", "list"):
            val = raw.get(key)
            if isinstance(val, list):
                print(f"ℹ️ grace_notes 객체 감싸기 감지 → '{key}' 키로 배열 추출")
                return val
        # 값들 중 list가 있으면 그걸 사용
        for val in raw.values():
            if isinstance(val, list):
                print("ℹ️ grace_notes 객체 감싸기 감지 → 첫 번째 배열 값 추출")
                return val
    return []


def _normalize_start_time_text(time_text: str) -> str:
    """[MM:SS] 형식으로 통일."""
    match = TIMESTAMP_PATTERN.search(time_text)
    if match:
        return f"[{int(match.group(1)):02d}:{match.group(2)}]"
    match = re.match(r"^(\d{1,2}):(\d{2})$", time_text.strip())
    if match:
        return f"[{int(match.group(1)):02d}:{match.group(2)}]"
    return time_text.strip()


def _enforce_point_timestamps(parsed_data: dict, transcript: str | None = None) -> dict:
    """
    points의 start_time_seconds를 start_time_text에서 서버가 재계산.
    Plan A일 때 원문에 없는 타임스탬프는 경고 로그.
    """
    points = parsed_data.get("points")
    if not isinstance(points, list):
        return parsed_data

    for i, point in enumerate(points):
        if not isinstance(point, dict):
            continue

        # 구 스키마 호환: start_time → start_time_text
        if "start_time_text" not in point and "start_time" in point:
            point["start_time_text"] = point.pop("start_time")
            if "[" not in str(point["start_time_text"]):
                point["start_time_text"] = _normalize_start_time_text(
                    str(point["start_time_text"])
                )

        raw_text = str(point.get("start_time_text", "")).strip()
        normalized = _normalize_start_time_text(raw_text)
        point["start_time_text"] = normalized

        seconds = _time_text_to_seconds(normalized)
        if seconds is not None:
            point["start_time_seconds"] = seconds
        else:
            print(f"⚠️ points[{i}] 타임스탬프 파싱 실패: {raw_text!r}")

        if transcript and normalized not in transcript:
            print(
                f"⚠️ points[{i}] start_time_text {normalized!r} 가 "
                f"스크립트 원문에 없습니다. 딥링크 오류 가능성 있음."
            )

    return parsed_data


def _enforce_decision_prayer(parsed_data: dict, transcript: str | None = None) -> dict:
    """decision_prayer 타임스탬프·필드 정규화."""
    prayer = parsed_data.get("decision_prayer")
    if prayer is None:
        return parsed_data
    if not isinstance(prayer, dict):
        parsed_data["decision_prayer"] = None
        return parsed_data

    text = (
        prayer.get("prayer_text")
        or prayer.get("text")
        or prayer.get("prayer")
        or prayer.get("quote")
        or ""
    )
    if not str(text).strip():
        parsed_data["decision_prayer"] = None
        return parsed_data

    if "start_time_text" not in prayer and "start_time" in prayer:
        prayer["start_time_text"] = prayer.pop("start_time")

    raw_text = str(prayer.get("start_time_text", "")).strip()
    normalized = _normalize_start_time_text(raw_text)
    prayer["start_time_text"] = normalized
    prayer["prayer_text"] = str(text).strip()

    seconds = _time_text_to_seconds(normalized)
    if seconds is not None:
        prayer["start_time_seconds"] = seconds
    else:
        print(f"⚠️ decision_prayer 타임스탬프 파싱 실패: {raw_text!r}")

    if transcript and normalized and normalized not in transcript:
        print(
            f"⚠️ decision_prayer start_time_text {normalized!r} 가 "
            f"스크립트 원문에 없습니다. 딥링크 오류 가능성 있음."
        )

    parsed_data["decision_prayer"] = prayer
    return parsed_data


def _parse_gemini_json(result_text: str) -> dict:
    result_text = result_text.strip()
    if result_text.startswith("```json"):
        result_text = result_text[7:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
    elif result_text.startswith("```"):
        result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
    return json.loads(result_text.strip())


def _save_result(video_id: str, parsed_data: dict) -> Path:
    output_path = _output_path(video_id)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(parsed_data, f, indent=4, ensure_ascii=False)
    return output_path


def _wait_for_file_active(uploaded_file):
    """업로드된 파일이 Gemini에서 처리 완료될 때까지 대기."""
    file_name = uploaded_file.name
    while uploaded_file.state.name == "PROCESSING":
        time.sleep(2)
        uploaded_file = client.files.get(name=file_name)
    if uploaded_file.state.name == "FAILED":
        raise RuntimeError(f"Gemini 파일 처리 실패: {file_name}")
    return uploaded_file


def analyze_sermon(
    transcript_file_name: str,
    *,
    expected_sermon_date: str | None = None,
    service_type: str | None = None,
    preacher: str | None = None,
) -> bool:
    """[플랜 A] 자막 텍스트 기반 Gemini 분석."""
    video_id = transcript_file_name.replace("transcript_", "").replace(".txt", "")
    input_path = PROJECT_ROOT / "transcripts" / transcript_file_name

    print(f"👀 [플랜 A] {transcript_file_name} → {MODEL_NAME} 텍스트 분석 중...")

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            transcript = f.read()
    except FileNotFoundError:
        print(f"❌ [플랜 A] 파일 없음: {input_path}")
        return False

    if not transcript.strip():
        print(f"❌ [플랜 A] 자막 파일이 비어 있습니다: {input_path}")
        return False

    prompt = _build_json_prompt(
        transcript, expected_sermon_date=expected_sermon_date
    )

    try:
        _sleep_before_gemini("플랜 A")
        response = _generate_with_retry(
            "플랜 A",
            model=MODEL_NAME,
            contents=prompt,
        )
        parsed_data = _parse_gemini_json(response.text)
        parsed_data = _apply_expected_sermon_date(parsed_data, expected_sermon_date)
        parsed_data = _apply_service_metadata(
            parsed_data, service_type=service_type, preacher=preacher
        )
        parsed_data = _enforce_core_bible_verse(parsed_data)
        parsed_data = _normalize_keywords(parsed_data)
        parsed_data = _enforce_point_timestamps(parsed_data, transcript=transcript)
        parsed_data = _enforce_decision_prayer(parsed_data, transcript=transcript)
        parsed_data = _enforce_grace_notes_distinct(parsed_data, transcript=transcript)
        output_path = _save_result(video_id, parsed_data)
        print(f"✅ [플랜 A] 분석 완료 → {output_path}")
        return True
    except Exception as e:
        print(f"❌ [플랜 A] 분석 실패 ({video_id}): {e}")
        return False


def analyze_sermon_from_audio(
    video_id: str,
    audio_path: str | Path,
    *,
    expected_sermon_date: str | None = None,
    service_type: str | None = None,
    preacher: str | None = None,
) -> bool:
    """[플랜 B] 오디오 업로드 후 Gemini 멀티모달 분석."""
    audio_path = Path(audio_path)
    print(f"🎧 [플랜 B] {audio_path.name} → {MODEL_NAME} 오디오 분석 중...")

    if not audio_path.is_file():
        print(f"❌ [플랜 B] 오디오 파일 없음: {audio_path}")
        return False

    uploaded_file = None
    try:
        uploaded_file = client.files.upload(file=str(audio_path))
        uploaded_file = _wait_for_file_active(uploaded_file)

        prompt = _build_json_prompt(
            from_audio=True, expected_sermon_date=expected_sermon_date
        )
        _sleep_before_gemini("플랜 B")
        response = _generate_with_retry(
            "플랜 B",
            model=MODEL_NAME,
            contents=[uploaded_file, prompt],
        )
        parsed_data = _parse_gemini_json(response.text)
        parsed_data = _apply_expected_sermon_date(parsed_data, expected_sermon_date)
        parsed_data = _apply_service_metadata(
            parsed_data, service_type=service_type, preacher=preacher
        )
        parsed_data = _enforce_core_bible_verse(parsed_data)
        parsed_data = _normalize_keywords(parsed_data)
        parsed_data = _enforce_point_timestamps(parsed_data, transcript=None)
        parsed_data = _enforce_decision_prayer(parsed_data, transcript=None)
        parsed_data = _enforce_grace_notes_distinct(parsed_data, transcript=None)
        output_path = _save_result(video_id, parsed_data)
        print(f"✅ [플랜 B] 분석 완료 → {output_path}")
        return True
    except Exception as e:
        print(f"❌ [플랜 B] 분석 실패 ({video_id}): {e}")
        return False
    finally:
        if uploaded_file is not None:
            try:
                client.files.delete(name=uploaded_file.name)
            except Exception:
                pass


if __name__ == "__main__":
    analyze_sermon("transcript_YHYBSmX6fHI.txt")
