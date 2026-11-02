// 店舗(business)へのアクセス判定（オーナー or メンバー）。
// business_members 未適用(0012前)でも落とさない。
import type { Env } from "./types";

export async function isOwner(env: Env, userId: string, businessId: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT 1 AS x FROM businesses WHERE id = ? AND owner_user_id = ?")
    .bind(businessId, userId)
    .first<{ x: number }>();
  return !!row;
}

export async function isMember(env: Env, userId: string, businessId: string): Promise<boolean> {
  try {
    const row = await env.DB.prepare("SELECT 1 AS x FROM business_members WHERE business_id = ? AND user_id = ?")
      .bind(businessId, userId)
      .first<{ x: number }>();
    return !!row;
  } catch {
    return false; // 未適用
  }
}

export async function canAccessBusiness(env: Env, userId: string, businessId: string): Promise<boolean> {
  if (await isOwner(env, userId, businessId)) return true;
  return isMember(env, userId, businessId);
}

// ユーザーが参加している（メンバーの）business_id 一覧。未適用なら []。
export async function memberBusinessIds(env: Env, userId: string): Promise<string[]> {
  try {
    const { results } = await env.DB.prepare("SELECT business_id FROM business_members WHERE user_id = ?")
      .bind(userId)
      .all<{ business_id: string }>();
    return (results || []).map((r) => r.business_id);
  } catch {
    return [];
  }
}
