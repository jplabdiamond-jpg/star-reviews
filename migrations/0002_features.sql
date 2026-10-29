-- star-reviews 追加機能（2026-10-29）
-- 1) 手動インポート: 既存の声の出所を記録する source 列
-- 2) 簡易アナリティクス: 表示回数などのカウンタ

ALTER TABLE testimonials ADD COLUMN source TEXT;   -- NULL=通常投稿 / 'Google' 'instagram' '手動' など

CREATE TABLE IF NOT EXISTS metrics (
  key        TEXT PRIMARY KEY,                      -- 例: 'wall_view:<wallId>' / 'form_view:<formId>'
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);
