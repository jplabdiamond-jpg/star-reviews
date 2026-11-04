// GET /blog/:slug  ブログ記事（SSR）
import type { Env } from "../../shared/types";
import { findPost, publishedPosts } from "../../shared/blog/posts";
import { renderArticle, renderList, htmlResponse } from "../../shared/blog/render";

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  const raw = params.slug;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  const post = slug ? findPost(decodeURIComponent(slug)) : null;

  if (!post) {
    // 404: 記事が無ければ一覧を404ステータスで返す（内部リンクを維持）
    return htmlResponse(renderList(publishedPosts(), base), 404);
  }
  return htmlResponse(renderArticle(post, publishedPosts(), base), 200);
};
