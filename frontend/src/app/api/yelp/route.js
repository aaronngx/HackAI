import { NextResponse } from "next/server";

/**
 * Try to get the direct Yelp business page URL for a clinic from search.
 * Yelp may block scrapers - falls back to search URL if fetch fails.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();
  const location = searchParams.get("location")?.trim();

  if (!name) {
    return NextResponse.json({ url: null, error: "Missing name" }, { status: 400 });
  }

  const searchUrl = `https://www.yelp.com/search?find_desc=${encodeURIComponent(name)}&find_loc=${encodeURIComponent(location || "United States")}`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return NextResponse.json({ url: searchUrl, source: "search" });

    const html = await res.text();
    const bizMatch = html.match(/href="(\/biz\/[^"]+)"/);
    if (bizMatch) {
      const path = bizMatch[1].split("?")[0];
      return NextResponse.json({ url: `https://www.yelp.com${path}`, source: "direct" });
    }
  } catch (_) {
    // Yelp may block - return search URL
  }

  return NextResponse.json({ url: searchUrl, source: "search" });
}
