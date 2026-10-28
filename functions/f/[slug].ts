// GET /f/:slug   投稿ページへのきれいなURL。/submit?f=slug にリダイレクト（?t=検証トークンは引き継ぐ）
export const onRequestGet: PagesFunction = async ({ request, params }) => {
  const url = new URL(request.url);
  const slug = encodeURIComponent(String(params.slug));
  const t = url.searchParams.get("t");
  const dest = `/submit?f=${slug}${t ? `&t=${encodeURIComponent(t)}` : ""}`;
  return Response.redirect(url.origin + dest, 302);
};
