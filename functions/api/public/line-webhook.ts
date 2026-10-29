// POST /api/public/line-webhook  LINE Messaging API のWebフック（認証なし・署名検証）
// オーナーが公式アカウントに「連携コード」を送ると、そのuserIdを businesses.line_user_id に保存。
import type { Env } from "../../../shared/types";

async function verifyLineSignature(raw: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // 長さ一致 + 定数時間比較
  if (b64.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < b64.length; i++) diff |= b64.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function lineReply(env: Env, replyToken: string, text: string): Promise<void> {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return;
  try {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
    });
  } catch { /* noop */ }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // 未設定なら200で素通し（LINE側の再送ループ回避）
  if (!env.LINE_CHANNEL_SECRET || !env.LINE_CHANNEL_ACCESS_TOKEN) {
    return new Response("line not configured", { status: 200 });
  }
  const raw = await request.text();
  const ok = await verifyLineSignature(raw, request.headers.get("x-line-signature"), env.LINE_CHANNEL_SECRET);
  if (!ok) return new Response("invalid signature", { status: 400 });

  let payload: any = null;
  try { payload = JSON.parse(raw); } catch { return new Response("ok", { status: 200 }); }

  const events: any[] = Array.isArray(payload?.events) ? payload.events : [];
  for (const ev of events) {
    try {
      if (ev.type === "message" && ev.message?.type === "text" && ev.source?.userId) {
        const code = String(ev.message.text || "").toUpperCase().replace(/[\s-]/g, "");
        const userId = ev.source.userId as string;
        // 連携コードに一致する事業者を探す
        const biz = await env.DB.prepare("SELECT id FROM businesses WHERE line_link_code = ? LIMIT 1")
          .bind(code)
          .first<{ id: string }>();
        if (biz) {
          await env.DB.prepare("UPDATE businesses SET line_user_id = ?, line_link_code = NULL WHERE id = ?")
            .bind(userId, biz.id)
            .run();
          if (ev.replyToken) await lineReply(env, ev.replyToken, "✅ 連携が完了しました。これから新しいレビューが届くとここに通知します。");
        } else if (ev.replyToken) {
          await lineReply(env, ev.replyToken, "連携コードが見つかりませんでした。管理画面の「通知」タブに表示されているコードを送ってください。");
        }
      }
    } catch { /* 個別イベントの失敗は無視 */ }
  }
  return new Response("ok", { status: 200 });
};
