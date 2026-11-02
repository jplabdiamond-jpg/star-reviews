-- 0007: 詳しいアナリティクス用
-- 日次ロールアップ表（閲覧・投稿開始/完了・壁表示などの時系列カウント。PIIは持たない）
-- 本番D1(star-reviews-db = jp.lab.diamond)の D1 コンソールで実行して適用する。

CREATE TABLE IF NOT EXISTS metric_daily (
  business_id TEXT NOT NULL,
  metric_key  TEXT NOT NULL,   -- 'form_view' | 'submit_start' | 'submit_done' | 'wall_view'
  day         TEXT NOT NULL,   -- 'YYYY-MM-DD'(JST)
  count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, metric_key, day)
);

-- 投稿推移の集計を速くする（submitted_at の範囲 + business_id）
CREATE INDEX IF NOT EXISTS idx_testi_biz_submitted ON testimonials(business_id, submitted_at);
