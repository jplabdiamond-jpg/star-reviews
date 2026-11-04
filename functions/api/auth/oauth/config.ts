// GET /api/auth/oauth/config
// 設定済み(環境変数あり)のソーシャルプロバイダを返す。フロントはこれを見てボタンを出し分ける。
import { json } from "../../../../shared/util";
import { isEnabled } from "../../../../shared/oauth";
import type { Env } from "../../../../shared/types";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return json({
    google: isEnabled(env, "google"),
    line: isEnabled(env, "line"),
  });
};
