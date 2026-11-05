#!/usr/bin/env node
/*
 * コラムの自動公開スクリプト（GitHub Actions で実行）。free-bizdocs 方式の star-reviews 版。
 * - shared/blog/articles/*.ts の中から「下書き（published: false）」を queueOrder 昇順で1本選ぶ。
 * - その記事を published: true にし、date を本日(JST)へ書き換える＝公開。
 * - 実際の commit / push / デプロイ / IndexNow 通知はワークフロー側。本スクリプトは判定とファイル書換のみ。
 * - 結果を publish-result.json に出力（{ published, slug, title, url, reason }）。
 * - PUBLISH_MODE=dry のときは書き換えず判定だけ（テスト用）。
 */
import fs from "node:fs";
import path from "node:path";

const ARTICLES_DIR = "shared/blog/articles";
const RESULT = "publish-result.json";
const BASE = "https://star-reviews.net";
const DRY = (process.env.PUBLISH_MODE || "").trim() === "dry";

const jst = new Date(Date.now() + 9 * 3600 * 1000);
const today = jst.toISOString().slice(0, 10); // YYYY-MM-DD (JST)

const writeResult = (o) => fs.writeFileSync(RESULT, JSON.stringify(o));

const files = fs
  .readdirSync(ARTICLES_DIR)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => path.join(ARTICLES_DIR, f));

const drafts = [];
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const isDraft = /published\s*:\s*false/.test(src);
  if (!isDraft) continue;
  const slug = (src.match(/slug\s*:\s*["'`]([^"'`]+)["'`]/) || [])[1] || "";
  const title = (src.match(/title\s*:\s*["'`]([^"'`]+)["'`]/) || [])[1] || slug;
  const order = Number((src.match(/queueOrder\s*:\s*(\d+)/) || [])[1] ?? 9999);
  const coverPrompt = (src.match(/coverPrompt\s*:\s*["'`]([^"'`]+)["'`]/) || [])[1] || "";
  const emph = (src.match(/emph\s*:\s*["'`]([^"'`]+)["'`]/) || [])[1] || "";
  drafts.push({ file, src, slug, title, order, coverPrompt, emph });
}

if (drafts.length === 0) {
  writeResult({ published: false, reason: "empty-queue" });
  console.log("キューに下書きがありません。公開なし。");
  process.exit(0);
}

drafts.sort((a, b) => a.order - b.order || a.file.localeCompare(b.file));
const pick = drafts[0];

// published: false -> true、date -> 本日(JST)
let out = pick.src.replace(/published\s*:\s*false/, "published: true");
if (/date\s*:\s*["'`][^"'`]*["'`]/.test(out)) {
  out = out.replace(/date\s*:\s*["'`][^"'`]*["'`]/, `date: "${today}"`);
} else {
  // date が無い場合は title 行の後ろに差し込む（通常は存在する）
  out = out.replace(/(title\s*:\s*["'`][^"'`]*["'`]\s*,)/, `$1\n  date: "${today}",`);
}
// cover（アイキャッチ）が未設定なら設定。実画像はワークフローの gen-eyecatch.py が生成する。
if (!/cover\s*:/.test(out)) {
  const coverLine = `  cover: "/blog/assets/${pick.slug}.png",`;
  if (/author\s*:\s*["'`][^"'`]*["'`]\s*,/.test(out)) {
    out = out.replace(/(author\s*:\s*["'`][^"'`]*["'`]\s*,)/, `$1\n${coverLine}`);
  } else {
    out = out.replace(/(date\s*:\s*["'`][^"'`]*["'`]\s*,)/, `$1\n${coverLine}`);
  }
}

const url = `${BASE}/blog/${encodeURIComponent(pick.slug)}`;
if (DRY) {
  console.log(`[dry] 公開対象: ${pick.slug} (order=${pick.order}) -> date ${today}`);
  writeResult({ published: false, reason: "dry-run", slug: pick.slug, title: pick.title, url });
  process.exit(0);
}

fs.writeFileSync(pick.file, out);
writeResult({
  published: true,
  slug: pick.slug,
  title: pick.title,
  url,
  date: today,
  coverPrompt: pick.coverPrompt,
  emph: pick.emph,
});
console.log(`公開: ${pick.title} (${pick.slug}) -> ${url}`);
