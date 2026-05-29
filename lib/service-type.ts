/**
 * 예배 종류(service_type) 공용 헬퍼.
 *
 * - "주일"(또는 빈값/NULL=기존 데이터)만 "메인"으로 취급한다.
 *   메인 설교만 "오늘의 말씀" 추천 풀과 날짜 보관함(아카이브)에 등장한다.
 * - 새벽·청년 등은 고민 검색(요약 벡터)에서만 노출된다.
 */

export const MAIN_SERVICE_TYPE = "주일";

/** 주일(메인) 설교 여부. service_type 비어 있으면 주일로 본다. */
export function isMainSermon(serviceType?: string | null): boolean {
  const value = (serviceType ?? "").trim();
  return value === "" || value === MAIN_SERVICE_TYPE;
}

/** 화면 배지에 쓸 라벨. 메인(주일)이면 null(배지 숨김). */
export function serviceTypeLabel(serviceType?: string | null): string | null {
  const value = (serviceType ?? "").trim();
  if (value === "" || value === MAIN_SERVICE_TYPE) {
    return null;
  }
  return value;
}
