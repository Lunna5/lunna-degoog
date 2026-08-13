export const type = "Manga";

const BASE_URL = "https://api.mangadex.org";
const LIMIT = 20;

const _stripHtml = (str) => {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]+>/g, "").trim();
};

const _title = (attrs) => {
  const t = attrs?.title ?? {};
  return t.en ?? t["ja-ro"] ?? t.ja ?? Object.values(t)[0] ?? "";
};

export default class MangaDexEngine {
  isClientExposed = false;
  name = "MangaDex";
  bangShortcut = "mangadex";

  async executeSearch(query, page = 1, _timeFilter, context) {
    const offset = (Math.max(1, Number(page)) - 1) * LIMIT;
    const params = new URLSearchParams({
      title: query.trim(),
      limit: String(LIMIT),
      offset: String(offset),
      "includes[]": "cover_art",
    });
    const url = `${BASE_URL}/manga?${params.toString()}`;
    const doFetch = context?.fetch ?? fetch;
    try {
      const response = await doFetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; degoog/1.0)",
        },
      });
      context?.sentinel?.(response, this.name);
      const data = await response.json();
      const list = data?.data ?? [];
      const included = data?.included ?? [];
      const coverMap = new Map(
        included.filter((i) => i.type === "cover_art").map((c) => [c.id, c.attributes?.fileName])
      );
      return list.map((item) => {
        const coverRel = (item.relationships ?? []).find((r) => r.type === "cover_art");
        const fileName = coverRel ? coverMap.get(coverRel.id) : null;
        const attrs = item.attributes ?? {};
        const title = _title(attrs);
        const id = item.id;
        const resultUrl = `https://mangadex.org/title/${id}`;
        const desc = _stripHtml(attrs.description?.en ?? "").slice(0, 250);
        const meta = [
          attrs.publicationDemographic,
          attrs.status,
          attrs.year ? String(attrs.year) : null,
        ]
          .filter(Boolean)
          .join(" · ");
        const snippet = meta + (desc ? ` — ${desc}${desc.length >= 250 ? "..." : ""}` : "");
        const thumbnail = fileName
          ? `https://uploads.mangadex.org/covers/${id}/${fileName}.256.jpg`
          : undefined;
        return { title, url: resultUrl, snippet, source: this.name, thumbnail };
      });
    } catch (e) {
      if (e?.name === "SentinelBreach") throw e;
      return [];
    }
  }
}
