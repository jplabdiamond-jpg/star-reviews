// 動画の文字起こし → VTT字幕生成（Cloudflare Workers AI / Whisper）
// AIがバインドされていない・失敗した場合は何もしない（best-effort）。
import type { Env } from "./types";

// Whisperのタイムスタンプ秒 → VTT時刻 "HH:MM:SS.mmm"
function ts(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${p2(h)}:${p2(m)}:${p2(ss)}.${String(ms).padStart(3, "0")}`;
}

// Whisper結果からVTTを組み立てる。segmentsがあれば優先、無ければwordsを塊にする。
function buildVtt(result: any): string | null {
  if (result?.vtt && typeof result.vtt === "string" && result.vtt.includes("-->")) return result.vtt;

  const cues: Array<{ start: number; end: number; text: string }> = [];
  if (Array.isArray(result?.segments) && result.segments.length) {
    for (const seg of result.segments) {
      const t = (seg.text || "").trim();
      if (t) cues.push({ start: Number(seg.start) || 0, end: Number(seg.end) || 0, text: t });
    }
  } else if (Array.isArray(result?.words) && result.words.length) {
    // 語を ~12語ごと / 最長6秒でまとめる
    let cur: { start: number; end: number; text: string } | null = null;
    let count = 0;
    for (const w of result.words) {
      const word = (w.word || "").toString();
      const start = Number(w.start) || 0;
      const end = Number(w.end) || start;
      if (!cur) { cur = { start, end, text: word }; count = 1; continue; }
      cur.text += word;
      cur.end = end;
      count++;
      if (count >= 12 || end - cur.start >= 6) { cues.push(cur); cur = null; count = 0; }
    }
    if (cur) cues.push(cur);
  }
  if (!cues.length) return null;

  let out = "WEBVTT\n\n";
  cues.forEach((c, i) => {
    out += `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text.trim()}\n\n`;
  });
  return out;
}

const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024; // 25MBまで（メモリ保護）

// video_key の動画をR2から読み、文字起こしして <video_key>.vtt を同じR2に保存。
export async function transcribeAndStore(env: Env, videoKey: string): Promise<void> {
  if (!env.AI) return; // AI未バインドなら字幕生成しない
  try {
    const head = await env.MEDIA.head(videoKey);
    if (!head || head.size > MAX_TRANSCRIBE_BYTES) return;
    const obj = await env.MEDIA.get(videoKey);
    if (!obj) return;
    const buf = await obj.arrayBuffer();
    const audio = [...new Uint8Array(buf)];

    const result: any = await (env.AI as any).run("@cf/openai/whisper-large-v3-turbo", { audio });
    const vtt = buildVtt(result);
    if (!vtt) return;

    await env.MEDIA.put(`${videoKey}.vtt`, vtt, {
      httpMetadata: { contentType: "text/vtt; charset=utf-8" },
    });
  } catch {
    /* 文字起こし失敗時は字幕なしで継続 */
  }
}
