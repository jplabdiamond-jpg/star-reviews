// ブログ記事の型。記事は shared/blog/articles/ 配下に1ファイル1記事で置き、
// shared/blog/posts.ts のレジストリに登録する（DB不要・リポジトリ管理・pushで公開）。
export interface BlogPost {
  slug: string; // URL: /blog/<slug>
  title: string; // 記事タイトル（h1 / og:title）
  description: string; // meta description / og:description（120〜160字目安）
  date: string; // 公開日 'YYYY-MM-DD'（JST想定）
  updated?: string; // 更新日 'YYYY-MM-DD'（任意）
  tags?: string[]; // 表示用タグ
  cover?: string; // カバー画像の絶対パス（例 /blog/assets/xxx.png）。未指定なら /og.png
  bodyHtml: string; // 本文（セマンティックHTML。h2/h3/p/ul/table 等）
  lead?: string; // 冒頭の結論ボックス（40〜80字で記事の問いに直接回答。AEO/スニペット用）
  faq?: { q: string; a: string }[]; // よくある質問（可視FAQ＋FAQPage構造化データを自動出力）
  published?: boolean; // false なら「下書き（キュー待ち）」。自動公開スクリプトが true に切替える（既定 true＝公開）
  queueOrder?: number; // 自動公開の順番（小さいほど先に公開）。published:false の下書きで使う
  author?: string; // 著者表示（既定 'star-reviews 編集部'）
}
