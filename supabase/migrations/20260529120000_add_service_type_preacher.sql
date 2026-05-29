-- 예배 종류(service_type) + 설교자(preacher) — analyze_sermon → upload_to_db
-- Supabase Dashboard → SQL Editor 에서 실행하거나 supabase db push
--
-- service_type: "주일" / "새벽" / "청년" 등. 비어 있으면(기존 데이터) 주일로 취급.
--   - "주일"만 멀티벡터 + 오늘의 말씀 풀에 포함, 나머지는 요약벡터만 + 추천 제외.
-- preacher: 설교자 이름 (주일은 담임목사 고정, 새벽·청년은 매번 다름).

alter table public.sermons
  add column if not exists service_type text;

alter table public.sermons
  add column if not exists preacher text;

comment on column public.sermons.service_type is
  '예배 종류: 주일 / 새벽 / 청년 등. NULL·빈값은 주일(메인)로 취급';
comment on column public.sermons.preacher is
  '설교자 이름 (직함 제외). 새벽·청년처럼 설교자가 바뀌는 예배용';
