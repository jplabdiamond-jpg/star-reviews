-- 0004: 新着通知（メール/LINE）設定カラム
-- 動画字幕(VTT)はR2に <video_key>.vtt として保存するためスキーマ追加は不要。

ALTER TABLE businesses ADD COLUMN notify_email    TEXT;                 -- 通知先メール(未設定ならオーナーのログインメールへ)
ALTER TABLE businesses ADD COLUMN notify_enabled  INTEGER NOT NULL DEFAULT 1; -- 新着通知のON/OFF
ALTER TABLE businesses ADD COLUMN line_user_id    TEXT;                 -- LINE通知先(オーナーのuserId・連携後に保存)
ALTER TABLE businesses ADD COLUMN line_link_code  TEXT;                 -- LINE連携用の一度きりコード
