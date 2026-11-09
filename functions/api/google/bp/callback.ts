// GET /api/google/bp/callback  認可コード受領→refresh_token保存→店舗一覧を試行→/app へ戻す
import { nowSec } from "../../../../shared/util";
import { bpRedirectUri, exchangeCode, encToken, listAccounts, listLocations } from "../../../../shared/googlebp";
import type { Env, AppData } from "../../../../shared/types";

function back(origin: string, env: Env, q: string): Response {
  const base = (env.PUBLIC_BASE_URL || origin).replace(/\/+$/, "");
  return new Response(null, { status: 302, headers: { location: `${base}/app?bp=${q}` } });
}

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const origin = new URL(request.url).origin;
  const { businessId } = data.session!;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  if (url.searchParams.get("error") || !code) return back(origin, env, "denied");

  const stRaw = await env.SESSIONS.get(`bpstate:${state}`);
  if (!stRaw) return back(origin, env, "expired");
  await env.SESSIONS.delete(`bpstate:${state}`);
  const st = JSON.parse(stRaw) as { businessId: string };
  if (st.businessId !== businessId) return back(origin, env, "mismatch");

  let refreshToken: string | null = null;
  let accessToken = "";
  try {
    const t = await exchangeCode(env, code, bpRedirectUri(env, origin));
    refreshToken = t.refreshToken;
    accessToken = t.accessToken;
  } catch {
    return back(origin, env, "token_error");
  }
  if (!refreshToken) return back(origin, env, "no_refresh"); // 再同意が必要

  const enc = await encToken(env, refreshToken);

  // 連携を保存（location は後で選択 or 自動）
  try {
    await env.DB.prepare(
      `INSERT INTO google_bp (business_id, refresh_token, connected_at, autosync)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(business_id) DO UPDATE SET refresh_token = excluded.refresh_token, connected_at = excluded.connected_at`
    )
      .bind(businessId, enc, nowSec())
      .run();
  } catch {
    return back(origin, env, "db"); // 0015未適用
  }

  // 店舗が1つなら自動選択
  try {
    const accounts = await listAccounts(accessToken);
    let picked: { account: string; name: string; title: string } | null = null;
    let count = 0;
    for (const acc of accounts) {
      const locs = await listLocations(accessToken, acc);
      count += locs.length;
      if (locs.length && !picked) picked = locs[0];
      if (count > 1) break;
    }
    if (picked && count === 1) {
      await env.DB.prepare(
        "UPDATE google_bp SET account_name = ?, location_name = ?, location_title = ? WHERE business_id = ?"
      )
        .bind(picked.account, picked.name, picked.title, businessId)
        .run();
      return back(origin, env, "connected");
    }
  } catch {
    /* 一覧失敗でも連携自体は成功。UIで選択/再試行 */
  }
  return back(origin, env, "pick"); // 複数店舗 → UIで選択
};
