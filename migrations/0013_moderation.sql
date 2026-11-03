-- 0013: AIモデレーション（不適切投稿の自動フラグ）
-- flagged: 1=要確認（AIが不適切の可能性と判定）。ブロックはせず、オーナーが受信トレイで確認する。
-- 本番D1(star-reviews-db = jp.lab.diamond)の D1 コンソールで実行して適用する。

ALTER TABLE testimonials ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0;
ALTER TABLE testimonials ADD COLUMN flag_reason TEXT;
