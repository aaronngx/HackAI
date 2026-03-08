import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * POST /api/clinics-pick-top
 * 1. Fetches clinics via web scraper (calls /api/doctors)
 * 2. Saves scraped data to data/scraped-clinics-{zip}.json
 * 3. Uses Gemini to pick top 3 best candidates
 * 4. Returns { top3, all, geminiReason, userLocation }
 */
export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  let body = {};
  try {
    body = await request.json();
  } catch (_) {}

  const zip = body.zip?.trim();
  const searchQuery = body.searchQuery?.trim() || "eye clinic optometrist ophthalmologist";

  if (!zip) {
    return NextResponse.json({ error: "ZIP code required" }, { status: 400 });
  }

  try {
    const origin = new URL(request.url).origin;
    const doctorsUrl = `${origin}/api/doctors?zip=${encodeURIComponent(zip)}&q=${encodeURIComponent(searchQuery)}`;
    const res = await fetch(doctorsUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch clinics" }, { status: 502 });
    }
    const data = await res.json();
    const all = Array.isArray(data.doctors) ? data.doctors : [];

    if (all.length === 0) {
      return NextResponse.json({
        top3: [],
        all: [],
        geminiReason: null,
        userLocation: null,
        message: data.message || "No clinics found",
      });
    }

    // Geocode ZIP for userLocation (disambiguate US ZIP to avoid Pakistan/other matches)
    let userLocation = null;
    try {
      const geoQuery = /^\d{5}(-\d{4})?$/.test(String(zip).trim()) ? `${zip}, Texas, USA` : zip;
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geoQuery)}&format=json&limit=1`,
        { headers: { "Accept-Language": "en", "User-Agent": "HackAI-EyeHealth/1.0" } }
      );
      const geoData = await geoRes.json();
      if (geoData?.length) {
        userLocation = {
          lat: parseFloat(geoData[0].lat),
          lng: parseFloat(geoData[0].lon),
          label: geoData[0].display_name?.split(",").slice(0, 2).join(",") || zip,
        };
      }
    } catch (_) {}

    // Save scraped data to file
    const dataDir = path.join(process.cwd(), "data");
    await mkdir(dataDir, { recursive: true });
    const safeZip = zip.replace(/[^a-zA-Z0-9-]/g, "_");
    const filePath = path.join(dataDir, `scraped-clinics-${safeZip}.json`);
    await writeFile(
      filePath,
      JSON.stringify(
        {
          zip,
          searchQuery,
          scrapedAt: new Date().toISOString(),
          count: all.length,
          clinics: all,
        },
        null,
        2
      ),
      "utf-8"
    );

    // Use Gemini to pick top 3
    let top3 = all.slice(0, 3);
    let geminiReason = null;

    if (apiKey && all.length >= 3) {
      const clinicSummary = all.map((c, i) => {
        const dist = c.dist != null ? `${(c.dist * 0.621371).toFixed(1)} mi` : "—";
        return `${i + 1}. ${c.name} | Address: ${c.address || "—"} | Rating: ${c.rating ?? "—"} | Distance: ${dist} | Bio: ${(c.bio || "").slice(0, 100)}`;
      }).join("\n");

      const prompt = `You are an eye health assistant. Given this list of eye clinics near ZIP ${zip}, pick the TOP 3 best candidates for a patient.

Consider: ratings, reviews count, distance, relevance of name/bio to eye care, and overall trustworthiness.

Clinics (one per line):
${clinicSummary}

Return ONLY valid JSON, no markdown:
{
  "indices": [a, b, c],
  "reason": "One short sentence explaining why these 3 were chosen"
}
Where indices are 1-based (1 = first clinic). Pick exactly 3.`;

      const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
        }),
      });

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const cleaned = text.replace(/```json|```/g, "").trim();
        try {
          const parsed = JSON.parse(cleaned || "{}");
          if (Array.isArray(parsed.indices) && parsed.indices.length >= 3) {
            const idx1 = Math.max(0, Math.min(parsed.indices[0] - 1, all.length - 1));
            const idx2 = Math.max(0, Math.min(parsed.indices[1] - 1, all.length - 1));
            const idx3 = Math.max(0, Math.min(parsed.indices[2] - 1, all.length - 1));
            const seen = new Set();
            const order = [idx1, idx2, idx3].filter((i) => {
              if (seen.has(i)) return false;
              seen.add(i);
              return true;
            });
            top3 = order.map((i) => all[i]).filter(Boolean);
            if (top3.length < 3) {
              const remaining = all.filter((_, i) => !order.includes(i));
              while (top3.length < 3 && remaining.length) top3.push(remaining.shift());
            }
            geminiReason = parsed.reason || "AI-selected based on ratings, distance, and relevance.";
          }
        } catch (_) {}
      }
    }

    return NextResponse.json({
      top3,
      all,
      geminiReason,
      userLocation,
      message: data.message,
    });
  } catch (e) {
    console.error("clinics-pick-top error:", e);
    return NextResponse.json({ error: "Failed to process clinics" }, { status: 500 });
  }
}
