// 全Functionルートの前段。公開API以外は認証を要求する。
import { getSession } from "../shared/auth";
import { json } from "../shared/util";
import type { Env, AppData } from "../shared/types";

function isPublicPath(path: string): boolean {
  return (
    path.startsWith("/api/public/") ||
    path.startsWith("/api/auth/") ||
    path.startsWith("/api/wall/") ||
    path.startsWith("/api/media/")
  );
}

export const onRequest: PagesFunction<Env, string, AppData> = async (context) => {
  const { request, env, next, data } = context;
  const path = new URL(request.url).pathname;

  // 埋め込みウィジェットは別オリジンから /api/wall/* を叩くのでCORSプリフライトを通す
  if (request.method === "OPTIONS" && path.startsWith("/api/wall/")) {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
      },
    });
  }

  // 認証必須API
  if (path.startsWith("/api/") && !isPublicPath(path)) {
    const session = await getSession(request, env);
    if (!session) return json({ error: "unauthorized" }, 401);
    data.session = session;
  }

  return next();
};
