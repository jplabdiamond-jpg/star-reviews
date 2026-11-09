-- Google Business Profile 連携（オーナーOAuth・全レビュー取り込み/自動同期）
-- 1店舗=1連携。refresh_token は暗号化して保存。
CREATE TABLE IF NOT EXISTS google_bp (
  business_id     TEXT PRIMARY KEY,
  account_name    TEXT,            -- "accounts/123"
  location_name   TEXT,            -- "locations/456"
  location_title  TEXT,
  refresh_token   TEXT NOT NULL,   -- AES-GCM 暗号化済み
  autosync        INTEGER NOT NULL DEFAULT 0,
  connected_at    INTEGER NOT NULL,
  last_sync_at    INTEGER
);

-- 取り込み重複防止用の外部ID（GoogleのreviewId等）。既存testimonialsに追加。
ALTER TABLE testimonials ADD COLUMN ext_id TEXT;
CREATE INDEX IF NOT EXISTS idx_testi_ext ON testimonials (business_id, source, ext_id);
