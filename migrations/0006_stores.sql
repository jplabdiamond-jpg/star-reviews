-- 0006: 複数店舗の管理
-- businesses に archived を追加（店舗のアーカイブ＝非表示。ハード削除はしない運用）。
-- 既存店舗は archived=0（表示）。
-- 本番D1(star-reviews-db = jp.lab.diamond)の D1 コンソールで実行して適用する。

ALTER TABLE businesses ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
