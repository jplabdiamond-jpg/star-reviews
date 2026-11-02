-- 0011: 新着通知の配信モード（日次ダイジェスト対応）
-- notify_digest: 'instant'(都度) | 'daily'(1日1回まとめ) | 'off'
-- digest_last_at: 最後にダイジェストを送った時刻(epoch秒)。重複送信防止。
-- 本番D1(star-reviews-db = jp.lab.diamond)の D1 コンソールで実行して適用する。

ALTER TABLE businesses ADD COLUMN notify_digest TEXT NOT NULL DEFAULT 'instant';
ALTER TABLE businesses ADD COLUMN digest_last_at INTEGER;
