-- 0005: メールアドレス確認（サインアップ時の本人確認・完全必須）
-- users に email_verified を追加。既存ユーザーは認証済み扱いにしてロックアウトを防ぐ。
-- 本番D1(star-reviews-db = jp.lab.diamond アカウント)へは Cloudflare ダッシュボードの
-- D1 → star-reviews-db → コンソール で以下2文を実行して適用する。

ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
UPDATE users SET email_verified = 1;  -- 既存アカウントは認証済み扱い（新規登録分のみ0=要認証）
