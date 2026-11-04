-- ソーシャルログイン/登録（Google / LINE）
-- プロバイダのアカウントと star-reviews ユーザーの紐付け。
-- (provider, provider_uid) が一意。1ユーザーが複数プロバイダを紐付け可能。
CREATE TABLE IF NOT EXISTS oauth_accounts (
  provider      TEXT NOT NULL,     -- 'google' | 'line'
  provider_uid  TEXT NOT NULL,     -- プロバイダの安定したユーザーID（id_token の sub）
  user_id       TEXT NOT NULL,     -- users.id
  email         TEXT,              -- プロバイダから取得したメール（任意・参考用）
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_uid)
);

CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id);
