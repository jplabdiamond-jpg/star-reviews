-- 0010: オーナーからの返信（声への公式返信）
-- testimonials に reply と reply_at を追加。声の壁・ウィジェットに「お店からの返信」を表示できる。
-- 本番D1(star-reviews-db = jp.lab.diamond)の D1 コンソールで実行して適用する。

ALTER TABLE testimonials ADD COLUMN reply TEXT;
ALTER TABLE testimonials ADD COLUMN reply_at INTEGER;
