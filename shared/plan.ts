// プラン判定の共通ロジック
import { nowSec } from "./util";

export interface PlanRow {
  plan?: string | null;
  plan_until?: number | null;
}

// 有料プラン(= ホワイトラベル等の特典が有効)か判定
// plan が 'free' 以外で、期限(plan_until)が切れていなければ有料とみなす。
// plan_until 未設定(NULL)の場合は期限なしとして有効扱い（手動付与などを許容）。
export function isPaid(biz: PlanRow | null | undefined): boolean {
  if (!biz) return false;
  const plan = (biz.plan || "free").toLowerCase();
  if (plan === "free" || !plan) return false;
  const until = biz.plan_until;
  if (until == null) return true;
  // 1日の猶予（期限切れ直後のフラップ防止）
  return until + 86400 >= nowSec();
}

// 表示用のプラン名
export function planLabel(plan?: string | null): string {
  switch ((plan || "free").toLowerCase()) {
    case "pro":
      return "Pro";
    case "starter":
      return "Starter";
    default:
      return "Free";
  }
}
