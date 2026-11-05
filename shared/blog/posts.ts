// ブログ記事レジストリ。新しい記事は articles/ に1ファイル追加し、ここに import して ALL に並べる。
import type { BlogPost } from "./types";
import { post as senjaAlt } from "./articles/senja-testimonial-to-alternative";
import { post as embedGuide } from "./articles/embed-customer-reviews-on-website";
import { post as embedPlatforms } from "./articles/embed-reviews-studio-peraichi-wordpress";

// 登録済みの全記事（公開・非公開を含む生リスト）
const REGISTERED: BlogPost[] = [senjaAlt, embedGuide, embedPlatforms];

function isLive(p: BlogPost): boolean {
  if (p.published === false) return false;
  // 未来日は未公開扱い（JSTの当日まで）
  const today = new Date().toISOString().slice(0, 10);
  return p.date <= today;
}

// 公開中の記事を新しい順で返す
export function publishedPosts(): BlogPost[] {
  return REGISTERED.filter(isLive).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// slug から公開中の記事を取得（無ければ null）
export function findPost(slug: string): BlogPost | null {
  const p = REGISTERED.find((x) => x.slug === slug);
  return p && isLive(p) ? p : null;
}
