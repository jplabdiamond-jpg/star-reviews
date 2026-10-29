// Cloudflare バインディング型
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  SESSIONS: KVNamespace;
  // 任意: Google Places APIキー（未設定ならGoogle連携は無効）
  GOOGLE_MAPS_API_KEY?: string;
}

// セッション（KVに保存する中身）
export interface Session {
  userId: string;
  businessId: string;
  email: string;
}

// _middleware が context.data に載せる型
// PagesFunction の data 型は Record<string, unknown> 制約を満たす必要があるため index signature を付ける
export interface AppData {
  session?: Session;
  [key: string]: unknown;
}
