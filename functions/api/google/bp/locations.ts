// GET /api/google/bp/locations  連携アカウントの店舗一覧（Pro・要ログイン）
import { json } from "../../../../shared/util";
import { decToken, refreshAccessToken, listAccounts, listLocations } from "../../../../shared/googlebp";
import { getBpConn } from "../../../../shared/googlebp-sync";
import type { Env, AppData } from "../../../../shared/types";

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const { businessId } = data.session!;
  const conn = await getBpConn(env, businessId);
  if (!conn) return json({ error: "未連携です" }, 400);
  try {
    const access = await refreshAccessToken(env, await decToken(env, conn.refresh_token));
    const accounts = await listAccounts(access);
    const locations: { account: string; name: string; title: string }[] = [];
    for (const acc of accounts) {
      for (const l of await listLocations(access, acc)) locations.push(l);
      if (locations.length >= 200) break;
    }
    return json({ locations, selected: conn.location_name || null });
  } catch (e) {
    return json({ error: "Googleから店舗一覧を取得できませんでした。権限とAPI有効化をご確認ください。", detail: String(e).slice(0, 160) }, 502);
  }
};
