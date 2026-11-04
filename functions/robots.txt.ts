// GET /robots.txt
import type { Env } from "../shared/types";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");

  // 非公開パス（管理画面・API・本人限定ページ）。全ボット共通で除外する。
  const disallow = [
    "/app",
    "/api/",
    "/reset",
    "/verify",
    "/join",
    "/delete-request",
  ];
  const disallowBlock = disallow.map((p) => `Disallow: ${p}`).join("\n");

  // 一般の検索エンジン（Google / Bing など）はすべて許可（非公開パスのみ除外）。
  const general = `User-agent: *\nAllow: /\n${disallowBlock}`;

  // GEO（Generative Engine Optimization）:
  // ChatGPT / Claude / Perplexity / Google AI / Apple Intelligence などの
  // 生成AI・AI検索クローラを「明示的に許可」して、回答に引用されやすくする。
  // （既定の * でも許可だが、意図を明示し将来のブロック既定化にも備える）
  const aiBots = [
    "GPTBot", // OpenAI 学習・検索インデックス
    "OAI-SearchBot", // ChatGPT Search
    "ChatGPT-User", // ChatGPT 閲覧（ユーザー操作時）
    "ClaudeBot", // Anthropic クロール
    "Claude-User", // Claude 閲覧
    "Claude-SearchBot", // Claude 検索
    "anthropic-ai",
    "PerplexityBot", // Perplexity インデックス
    "Perplexity-User", // Perplexity 閲覧
    "Google-Extended", // Gemini / AI Overviews 学習許可
    "Applebot-Extended", // Apple Intelligence 学習許可
    "Amazonbot",
    "cohere-ai",
    "CCBot", // Common Crawl（多くのLLMの学習基盤）
    "DuckAssistBot",
    "MistralAI-User",
    "Meta-ExternalAgent",
    "Bytespider",
  ];
  const aiBlocks = aiBots
    .map((ua) => `User-agent: ${ua}\nAllow: /\n${disallowBlock}`)
    .join("\n\n");

  const body =
    `# star-reviews robots.txt\n` +
    `# 一般検索エンジン・生成AIクローラともに歓迎（非公開パスのみ除外）\n\n` +
    `${general}\n\n` +
    `${aiBlocks}\n\n` +
    `Sitemap: ${base}/sitemap.xml\n`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
};
