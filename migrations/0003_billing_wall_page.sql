-- Phase14: 課金(Stripe)＋ホワイトラベル＋ホスト型・声の壁ページ
-- businesses に既にある: plan ('free'|'starter'|'pro'), stripe_customer_id
-- 追加するもの:
ALTER TABLE businesses ADD COLUMN stripe_subscription_id TEXT;   -- StripeサブスクリプションID
ALTER TABLE businesses ADD COLUMN plan_until INTEGER;            -- 現在の課金期間末(epoch秒)。失効判定に使用

-- 声の壁の「ホスト型公開ページ」用の読みやすいURLスラッグ（任意・pro特典）
ALTER TABLE walls ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_walls_slug ON walls(slug);
