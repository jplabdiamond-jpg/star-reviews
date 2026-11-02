-- 0009: 自動フォローアップ（レビュー依頼の自動送信）
-- 顧客に「指定日後」にレビュー依頼メールを自動送信するためのキュー。
-- 本番D1(star-reviews-db = jp.lab.diamond)の D1 コンソールで実行して適用する。

CREATE TABLE IF NOT EXISTS followups (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  form_id     TEXT NOT NULL,
  to_email    TEXT NOT NULL,
  to_name     TEXT,
  send_at     INTEGER NOT NULL,                 -- 送信予定時刻(epoch秒)
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed | canceled
  created_at  INTEGER NOT NULL,
  sent_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_followups_due ON followups(status, send_at);
CREATE INDEX IF NOT EXISTS idx_followups_biz ON followups(business_id, created_at);
