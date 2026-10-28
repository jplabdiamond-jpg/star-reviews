// Cloudflare バインディング型
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  SESSIONS: KVNamespace;
}

// セッション（KVに保存する中身）
export interface Session {
  userId: string;
  businessId: string;
  email: string;
}

// _middleware が context.data に載せる型
export interface AppData {
  session?: Session;
}
