const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";

function readGeminiApiKey(): string {
  const key = (
    process.env.GEMINI_API_KEY ??
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ??
    ""
  ).trim();
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았습니다. .env.local에 추가해 주세요.",
    );
  }
  return key;
}

export function readEmbeddingModel(): string {
  return (
    process.env.GEMINI_EMBEDDING_MODEL ?? ""
  ).trim() || DEFAULT_EMBEDDING_MODEL;
}

type EmbedContentResponse = {
  embedding?: { values?: number[] };
};

/** 단일 텍스트 → 벡터 (고민 검색 1회 호출) */
export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("임베딩할 텍스트가 비어 있습니다.");
  }

  const model = readEmbeddingModel();
  const apiKey = readGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text: trimmed }] },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Gemini 임베딩 API 오류 (${response.status}): ${detail.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as EmbedContentResponse;
  const values = payload.embedding?.values;
  if (!values?.length) {
    throw new Error("임베딩 응답에 벡터가 없습니다.");
  }
  return values;
}

/** 코사인 유사도 (0~1, 클수록 유사) */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
