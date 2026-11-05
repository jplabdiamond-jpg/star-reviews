import type { BlogPost } from "../types";

// 記事#3（自動公開キューの先頭・下書き）: ノーコード/CMS別の口コミ埋め込み手順
export const post: BlogPost = {
  slug: "embed-reviews-studio-peraichi-wordpress",
  title: "STUDIO・ペライチ・WordPressに口コミを埋め込む方法",
  description:
    "STUDIO・ペライチ・WordPressそれぞれに、お客様の声（口コミ）を埋め込む手順を解説。どのツールでも「カスタムHTML／コード埋め込み」に1行のコードを貼るだけ。注意点とSEOのポイントも。",
  date: "2026-11-05", // 自動公開スクリプトが公開日に書き換える（下書き中は未来日で非表示）
  published: true,
  queueOrder: 1,
  tags: ["埋め込み", "STUDIO", "WordPress", "ペライチ"],
  author: "star-reviews 編集部",
  cover: "/blog/assets/embed-reviews-studio-peraichi-wordpress.png",
  coverPrompt: "a laptop on a bright desk showing a website builder editor with a customer reviews embed block",
  emph: "埋め込む方法",
  lead: "STUDIO・ペライチ・WordPressのどれでも、口コミの埋め込みは「カスタムHTML／コード埋め込み」のブロックに、ツールが発行した1行のコードを貼るだけ。HTMLを書く必要はありません。",
  faq: [
    {
      q: "STUDIOに口コミを埋め込めますか？",
      a: "埋め込めます。STUDIOの編集画面で「ボックス」を置き、その中に「埋め込み（Embed）」を追加して、レビュー収集ツールのコードを貼り付けます。公開するとサイトに反映されます。",
    },
    {
      q: "WordPressではどうやって貼りますか？",
      a: "ブロックエディタで「カスタムHTML」ブロックを追加し、そこにコードを貼ります。クラシックエディタの場合は「テキスト」タブに切り替えて貼り付けます。テーマは問いません。",
    },
    {
      q: "ペライチでも使えますか？",
      a: "使えます。ブロック追加から「HTML埋め込み」を選び、コードを貼り付けます。無料プランでHTML埋め込みが使えるかはプランにより異なるため、最新の仕様は公式でご確認ください。",
    },
    {
      q: "コードを貼っても表示されないときは？",
      a: "多くは貼る場所の間違い（本文テキスト欄ではなくHTML埋め込み欄に貼る）か、公開・保存のし忘れです。プレビューではなく公開後のページで確認し、キャッシュがあれば再読み込みしてください。",
    },
  ],
  bodyHtml: `
<p>お客様の声は、集めたあとに「自分のサイトへ載せる」ところでつまずきがちです。とくにSTUDIOやペライチのようなノーコードツール、WordPressでは「どこに貼るの？」が分かりにくい。結論はどれも同じで、<strong>「コード埋め込み」用のブロックに1行を貼るだけ</strong>です。ツール別に見ていきます。</p>

<h2>共通の考え方は？</h2>
<p>レビュー収集ツールで集めた声は、管理画面から<strong>埋め込みコード（1行）</strong>として発行されます。やることは、各サイトツールにある「カスタムHTML」「HTML埋め込み」「Embed」といった<span class="mark">コードを貼るための専用ブロック</span>に、そのコードをペーストするだけ。コードの中身は編集しません。</p>

<h2>STUDIOに埋め込む手順は？</h2>
<ol>
<li>STUDIOの編集画面で、声を表示したい位置に「ボックス」を追加する</li>
<li>ボックス内に「埋め込み（Embed / コード）」を追加する</li>
<li>レビュー収集ツールで発行した<strong>コードを貼り付ける</strong></li>
<li>「公開」して、公開後のページで表示を確認する</li>
</ol>

<h2>WordPressに埋め込む手順は？</h2>
<ol>
<li>投稿・固定ページの編集で「＋」から<strong>「カスタムHTML」ブロック</strong>を追加する</li>
<li>そこにコードを貼り付ける（クラシックエディタなら「テキスト」タブに切り替えて貼る）</li>
<li>更新・公開して表示を確認する</li>
</ol>

<h2>ペライチに埋め込む手順は？</h2>
<ol>
<li>ブロック追加から<strong>「HTML埋め込み」</strong>を選ぶ</li>
<li>コードを貼り付けて保存・公開する</li>
</ol>
<p>HTML埋め込みが使えるかは契約プランで異なる場合があるため、最新の仕様は公式でご確認ください。</p>

<h2>埋め込みで気をつけることは？</h2>
<ul>
<li><strong>貼る場所を間違えない</strong>：本文のテキスト欄ではなく「HTML／コード」専用の欄に貼る。</li>
<li><strong>公開後のページで確認</strong>：プレビューと公開後で表示が違うことがある。</li>
<li><strong>表示速度</strong>：声を一度に大量に出すより、件数を絞ってレイアウトを選ぶと軽くて読みやすい。見せ方の選び方は<a href="/blog/embed-customer-reviews-on-website">お客様の声をサイトに埋め込む方法</a>も参考に。</li>
</ul>

<h2>サイトが無い・埋め込みが難しいときは？</h2>
<p>サイト作成ツールの制約で埋め込めない場合も、集めた声を<strong>単独URLのレビューページ</strong>として公開すれば、そのURLを貼るだけで共有できます。各プランの違いは<a href="/plans">プランの詳細</a>、基本の使い方は<a href="/guide">使い方ガイド</a>をご覧ください。</p>
`,
};
