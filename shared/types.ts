// Cloudflare バインディング型
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  SESSIONS: KVNamespace;
  // 任意: Google Places APIキー（未設定ならGoogle連携は無効）
  GOOGLE_MAPS_API_KEY?: string;
  // 任意: Stripe課金（未設定なら課金は無効 = setup_required）
  STRIPE_SECRET_KEY?: string;      // sk_live_... / sk_test_...
  STRIPE_PRICE_ID?: string;        // 月額プランの price_...
  STRIPE_WEBHOOK_SECRET?: string;  // whsec_...（Webhook署名検証）
  PUBLIC_BASE_URL?: string;        // 任意: 本番URL(未設定ならリクエストoriginを使用)
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
