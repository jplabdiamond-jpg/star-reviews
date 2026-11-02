-- 0008: 成長施策（評価の振り分け）
-- 事業者のGoogleクチコミ投稿URL。投稿完了画面でGoogleへの投稿を案内するのに使う。
-- 本番D1(star-reviews-db = jp.lab.diamond)の D1 コンソールで実行して適用する。

ALTER TABLE businesses ADD COLUMN google_url TEXT;
