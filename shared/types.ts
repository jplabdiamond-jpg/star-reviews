// Cloudflare バインディング型
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  SESSIONS: KVNamespace;
  // 任意: Google Places APIキー（未設定ならGoogle連携は無効）
  GOOGLE_MAPS_API_KEY?: string;
  // 任意: Stripe課金（未設定なら課金は無効 = setup_required）
  STRIPE_SECRET_KEY?: string;      // sk_live_... / sk_test_...
  STRIPE_PRICE_STARTER?: string;   // Starterプランの price_...（¥1,980/月）
  STRIPE_PRICE_PRO?: string;       // Proプランの price_...（¥3,980/月）
  STRIPE_PRICE_ID?: string;        // 旧: 単一プラン用（互換のためProのフォールバックとして参照）
  STRIPE_WEBHOOK_SECRET?: string;  // whsec_...（Webhook署名検証）
  // 任意: 新着通知メール(Resend)。未設定ならメール通知は無効
  RESEND_API_KEY?: string;         // re_...
  RESEND_FROM?: string;            // 送信元 "star-reviews <no-reply@yourdomain>"
  // 任意: LINE通知(Messaging API)。未設定ならLINE通知は無効
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  LINE_CHANNEL_SECRET?: string;
  // Workers AI（動画の文字起こし・字幕）。未バインドなら字幕生成は無効
  AI?: Ai;
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
