"""예배 종류(소스) 레지스트리.

재생목록 URL과 예배 종류(service_type)를 한 곳에서 짝지어 관리한다.
- service_type 값은 DB·임베딩·오늘의 말씀 로직이 공유하는 "꼬리표"다.
- "주일"만 멀티벡터 + 오늘의 말씀 풀에 들어가고, 나머지는 요약벡터만 + 추천 제외.
  (분기 로직은 build_sermon_embeddings.py / lib/service-type.ts 가 담당)

새 예배(청년 등)를 추가할 때 여기 SOURCES 에 한 줄만 더하면 된다.
"""

from __future__ import annotations

# 짧은 키 → 화면/DB에 쓰는 예배 종류 라벨
SERVICE_TYPE_BY_KEY: dict[str, str] = {
    "sunday": "주일",
    "dawn": "새벽",
    "youth": "청년",
}

# 예배 종류별 재생목록 + 메타데이터
SOURCES: dict[str, dict] = {
    "sunday": {
        "playlist_url": "https://www.youtube.com/playlist?list=PLGpyTA6CZTZ18XLynWXBUcHaeJM8nwmYw",
        "service_type": "주일",
        # 풀영상(앞부분 찬양·봉독 포함) 여부. 청년 도입 시 True 예정.
        "full_video": False,
    },
    "dawn": {
        "playlist_url": "https://www.youtube.com/playlist?list=PLGpyTA6CZTZ3kix24eIwtKCuq5DPW9iiM",
        "service_type": "새벽",
        "full_video": False,
    },
    "youth": {
        "playlist_url": "https://www.youtube.com/playlist?list=PLGpyTA6CZTZ0TyMnb8qKjNN-HUzOw5b85",
        "service_type": "청년",
        # 풀영상 — 찬양·기도·봉독 포함. Gemini가 설교 구간을 알아서 찾음.
        "full_video": True,
    },
}


def resolve_service_type(key_or_label: str | None) -> str | None:
    """짧은 키('dawn')나 라벨('새벽')을 표준 라벨로 정규화. 모르면 그대로 반환."""
    if not key_or_label:
        return None
    value = key_or_label.strip()
    if value in SERVICE_TYPE_BY_KEY:
        return SERVICE_TYPE_BY_KEY[value]
    return value


def get_source(key: str) -> dict:
    """소스 키('dawn')로 재생목록 + service_type 묶음 반환."""
    source = SOURCES.get(key.strip())
    if not source:
        valid = ", ".join(sorted(SOURCES))
        raise SystemExit(f"알 수 없는 소스: {key!r} (가능: {valid})")
    return source
