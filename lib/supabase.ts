import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SermonPoint = {
  point_title: string;
  start_time: string;
  description: string;
};

export type GraceNote = {
  quote: string;
  start_time_text?: string;
  start_time_seconds?: number;
};

export type DecisionPrayer = {
  prayer_text: string;
  start_time_text?: string;
  start_time_seconds?: number;
};

export type Sermon = {
  id: string;
  title: string;
  core_bible_verse: string;
  keywords: string[];
  summary: string;
  points: SermonPoint[];
  grace_notes?: GraceNote[] | null;
  decision_prayer?: DecisionPrayer | null;
  sermon_date?: string | null;
  /** 예배 종류: "주일" / "새벽" / "청년" 등. NULL·빈값은 주일(메인)로 취급 */
  service_type?: string | null;
  /** 설교자 이름 (새벽·청년처럼 매번 다를 수 있음) */
  preacher?: string | null;
  created_at: string;
};

let supabaseInstance: SupabaseClient | null = null;

function readEnv(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

export function getSupabase(): SupabaseClient {
  const supabaseUrl = readEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = readEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }

  if (
    supabaseUrl.includes("여기에") ||
    supabaseAnonKey.includes("여기에")
  ) {
    throw new Error(
      "Supabase 환경 변수를 설정해 주세요. .env.local 파일의 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY에 실제 값을 입력해야 합니다.",
    );
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }

  return supabaseInstance;
}
