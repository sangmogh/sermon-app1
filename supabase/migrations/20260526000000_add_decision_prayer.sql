-- 결단의 기도 (analyze_sermon → upload_to_db)
-- Supabase Dashboard → SQL Editor 에서 실행하거나 supabase db push

alter table public.sermons
  add column if not exists decision_prayer jsonb;

comment on column public.sermons.decision_prayer is
  '결단의 기도: { prayer_text, start_time_text, start_time_seconds }';
