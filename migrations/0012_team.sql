-- 0012: チーム招待（1つの店舗を複数人で運用）
-- business_members: 店舗のメンバー（オーナー以外の参加者）。オーナーは businesses.owner_user_id で表す。
-- business_invites: 招待（メール宛てのトークン）。
-- 本番D1(star-reviews-db = jp.lab.diamond)の D1 コンソールで実行して適用する。

CREATE TABLE IF NOT EXISTS business_members (
  business_id TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (business_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON business_members(user_id);

CREATE TABLE IF NOT EXISTS business_invites (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  email       TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL DEFAULT 'member',
  created_at  INTEGER NOT NULL,
  accepted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_invites_biz ON business_invites(business_id, created_at);
