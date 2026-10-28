# star-reviews

お客様の声（Testimonial）収集・掲載 SaaS の MVP。
**Supabaseを使わず Cloudflare ネイティブ**（Pages + Functions + D1 + R2 + KV）で構成。

- 匿名OK・特典で集める設計（出し方レベル × 返礼）
- 投稿リンク（LINE/メールに貼る）→ 投稿 → 事業者が承認・選別 → サイトに1行で埋め込み
- お客様はログイン不要。ログインするのは事業者のみ（自前の軽量セッション認証）

## 構成

```
public/            静的フロント（Pagesが配信）
  index.html         事業者ランディング＋ログイン/登録
  app.html           ダッシュボード（フォーム/受信トレイ/返礼設定/埋め込み）
  submit.html        お客様の投稿ページ（/f/<slug> から遷移）
  widget.js          埋め込み「声の壁」ウィジェット（Shadow DOMで隔離）
functions/         Pages Functions（API・認証）
  _middleware.ts     公開API以外は認証必須
  api/public/*       認証不要：フォーム設定・投稿・写真アップロード
  api/auth/*         登録・ログイン・ログアウト・me
  api/forms/*        フォームCRUD（事業者）
  api/testimonials/* 受信トレイ一覧・承認/却下
  api/rewards/*      返礼ルール設定
  api/wall/[token]   承認済みの声（ウィジェット用・CORS許可）
  api/media/[[key]]  R2画像の配信
  f/[slug].ts        /f/<slug> → /submit?f=<slug> リダイレクト
shared/            共通ライブラリ（認証・ユーティリティ・型）
migrations/        D1スキーマ
```

## セットアップ（Cloudflare: jp.lab.diamond@gmail.com / Account ID 7969ecaa0a1b9bacae1861547c2ec3fe）

> リソース作成は本番アカウントへの変更です。下記コマンドは `CLOUDFLARE_API_TOKEN` を持つ環境で実行します。

```bash
# 1) リソース作成
npx wrangler d1 create star-reviews-db            # 出力の database_id を控える
npx wrangler kv namespace create SESSIONS         # 出力の id を控える
npx wrangler r2 bucket create star-reviews-media

# 2) wrangler.toml の REPLACE_WITH_... を上記IDで置き換える

# 3) スキーマ適用（本番D1）
npx wrangler d1 migrations apply star-reviews-db --remote
```

## デプロイ（GitHub → Cloudflare Pages 自動）

- GitHub Secret に `CLOUDFLARE_API_TOKEN`（権限: Pages / D1 / R2 / KV の Edit）を登録。
- Account ID は `.github/workflows/deploy.yml` に直書き済み。
- `main` への push で `.github/workflows/deploy.yml` が `wrangler pages deploy` を実行し本番公開。
  （バインディングは `wrangler.toml` から適用されます）

> ⚠️ `main` への push = 本番反映。安全運用のため、本番対象を明記した承認を得てから push します。

ローカル確認:
```bash
npm install
npm run dev     # wrangler pages dev（D1/R2/KVはローカルエミュレート）
```

## 使い方の流れ
1. 事業者が登録 → フォーム作成（投稿リンク発行）
2. リンクをLINE/メール/サンクスメールに貼る → お客様が投稿（星・一言・任意で名前/写真）
3. 返礼ルールがあれば、投稿後にクーポンコードを自動発行
4. 事業者が受信トレイで「掲載する」を選別 → 承認分が「声の壁」に載る
5. `widget.js` の1行をサイト/LPに貼る → 承認済みの声が表示

## 本MVPに含む / 含まない
- 含む：テキスト＋写真の収集、出し方レベル（Lv1匿名/Lv2実名写真）、返礼自動発行、承認フロー、埋め込み、事業者認証
- 含まない（次フェーズ）：Lv3動画、Stripe課金、独自ドメイン/ブランド削除、Google誘導トラック、SNS取込、制作会社向けOEM
