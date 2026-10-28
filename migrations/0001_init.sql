-- star-reviews MVP 初期スキーマ (Cloudflare D1 / SQLite)
-- お客様はログイン不要。ログインするのは事業者のみ。

-- 事業者ログインユーザー
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,          -- PBKDF2 (salt$hash)
  created_at    INTEGER NOT NULL
);

-- 事業者（テナント）。MVPでは 1ユーザー = 1事業者
CREATE TABLE businesses (
  id                 TEXT PRIMARY KEY,
  owner_user_id      TEXT NOT NULL,
  name               TEXT NOT NULL,
  plan               TEXT NOT NULL DEFAULT 'free',   -- free|starter|pro
  stripe_customer_id TEXT,
  created_at         INTEGER NOT NULL
);
CREATE INDEX idx_businesses_owner ON businesses(owner_user_id);

-- 投稿フォーム（= space / プロジェクト）
CREATE TABLE forms (
  id               TEXT PRIMARY KEY,
  business_id      TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,            -- 公開URL: /f/<slug>
  title            TEXT NOT NULL,
  intro            TEXT,                            -- 投稿前の案内文
  thanks_message   TEXT,                            -- 投稿後のお礼メッセージ
  levels_enabled   TEXT NOT NULL DEFAULT '1,2',     -- MVPは 1,2（3=動画はPhase1）
  require_verified INTEGER NOT NULL DEFAULT 0,      -- 1=検証済みのみ返礼
  created_at       INTEGER NOT NULL
);
CREATE INDEX idx_forms_business ON forms(business_id);

-- 検証トークン（購入者リンク経由を「検証済み」にする・返礼の不正防止）
CREATE TABLE submission_tokens (
  token        TEXT PRIMARY KEY,
  form_id      TEXT NOT NULL,
  customer_ref TEXT,                                -- 注文番号・顧客識別（任意）
  used         INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_tokens_form ON submission_tokens(form_id);

-- お客様の声
CREATE TABLE testimonials (
  id              TEXT PRIMARY KEY,
  business_id     TEXT NOT NULL,
  form_id         TEXT NOT NULL,
  level           INTEGER NOT NULL,                 -- 1=匿名/2=実名写真/3=動画
  rating          INTEGER,                          -- 1..5
  body            TEXT,
  author_name     TEXT,                             -- 匿名ならNULL
  author_label    TEXT,                             -- 表示用 "S.K様（30代）"
  photo_key       TEXT,                             -- R2キー（level>=2）
  video_key       TEXT,                             -- Phase1
  verified        INTEGER NOT NULL DEFAULT 0,
  consent_display INTEGER NOT NULL DEFAULT 0,       -- 掲載・肖像の同意
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending|approved|rejected
  submitted_at    INTEGER NOT NULL,
  approved_at     INTEGER
);
CREATE INDEX idx_testi_business_status ON testimonials(business_id, status);
CREATE INDEX idx_testi_form ON testimonials(form_id);

-- レベル別の返礼ルール
CREATE TABLE reward_rules (
  id           TEXT PRIMARY KEY,
  form_id      TEXT NOT NULL,
  level        INTEGER NOT NULL,                    -- 対象レベル
  reward_type  TEXT NOT NULL,                       -- amount|percent|code|content
  reward_value TEXT NOT NULL,                       -- "100" "10%" "限定PDF" など
  code_prefix  TEXT DEFAULT 'SR',
  active       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_rules_form_level ON reward_rules(form_id, level);

-- 発行済みクーポン/返礼コード
CREATE TABLE reward_codes (
  id             TEXT PRIMARY KEY,
  testimonial_id TEXT NOT NULL,
  rule_id        TEXT NOT NULL,
  code           TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'issued',    -- issued|redeemed|expired
  issued_at      INTEGER NOT NULL,
  expires_at     INTEGER,
  redeemed_at    INTEGER
);
CREATE INDEX idx_codes_testi ON reward_codes(testimonial_id);

-- 声の壁
CREATE TABLE walls (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name        TEXT NOT NULL,
  layout      TEXT NOT NULL DEFAULT 'grid',         -- grid|carousel|list
  theme       TEXT,                                 -- JSON
  embed_token TEXT NOT NULL UNIQUE,                 -- 埋め込み公開用トークン
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_walls_business ON walls(business_id);

-- 壁への掲載・並び順（手動キュレーション）
CREATE TABLE wall_testimonials (
  wall_id        TEXT NOT NULL,
  testimonial_id TEXT NOT NULL,
  position       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (wall_id, testimonial_id)
);
