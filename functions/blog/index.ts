// GET /blog  ブログ一覧（SSR）
import type { Env } from "../../shared/types";
import { publishedPosts } from "../../shared/blog/posts";
import { renderList, htmlResponse } from "../../shared/blog/render";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  return htmlResponse(renderList(publishedPosts(), base), 200);
};
