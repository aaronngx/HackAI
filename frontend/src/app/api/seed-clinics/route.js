import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=300&auto=format&fit=crop";

/** DFW grid points for Google Places search (lat, lng) */
const DFW_GRID = [
  [32.78, -96.80], // Dallas
  [32.76, -97.33], // Fort Worth
  [33.02, -96.70], // Plano
  [32.74, -97.11], // Arlington
  [33.21, -97.13], // Denton
  [33.15, -96.82], // Frisco
  [33.20, -96.64], // McKinney
  [32.95, -96.89], // Irving
  [32.75, -97.33], // Fort Worth south
  [32.85, -96.75], // North Dallas
];

/** Fetch website and phone from Place Details (Google Maps). */
async function fetchPlaceDetails(placeId, apiKey) {
  if (!placeId) return {};
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=website,formatted_phone_number&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const data = await res.json();
    const r = data?.result;
    if (!r) return {};
    return {
      website: r.website || null,
      phone: r.formatted_phone_number || null,
    };
  } catch {
    return {};
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch clinics from Google Places at one point */
async function fetchAtPoint(lat, lng, apiKey) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=eye+clinic+optometrist+ophthalmologist&location=${lat},${lng}&radius=32200&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (data.status !== "OK") return [];
  const results = data.results || [];
  const clinics = [];
  for (const r of results) {
    const loc = r.geometry?.location;
    const details = await fetchPlaceDetails(r.place_id, apiKey);
    await sleep(100);
    const query = `${r.name} ${r.formatted_address || ""}`.trim();
    const enc = encodeURIComponent(query);
    clinics.push({
      placeId: r.place_id,
      name: r.name,
      address: r.formatted_address || "",
      lat: loc?.lat ? parseFloat(loc.lat) : null,
      lng: loc?.lng ? parseFloat(loc.lng) : null,
      rating: r.rating ?? null,
      userRatingCount: r.user_ratings_total ?? null,
      image: DEFAULT_IMAGE,
      role: "Eye care",
      bio: "View reviews on Google Maps.",
      hours: "Contact office",
      insurance: "Contact office",
      languages: "Contact office",
      website: details.website ?? null,
      phone: details.phone ?? null,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${enc}`,
      googleSearchUrl: `https://www.google.com/search?q=${enc}`,
    });
  }
  return clinics;
}

/**
 * POST /api/seed-clinics
 * Seeds the clinics collection with DFW eye clinics from Google Places.
 * Requires GOOGLE_PLACES_API_KEY and MONGODB_URI.
 */
export async function POST() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY required" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const coll = db.collection("clinics");

    const seen = new Set();
    const all = [];

    for (const [lat, lng] of DFW_GRID) {
      const batch = await fetchAtPoint(lat, lng, apiKey);
      for (const c of batch) {
        if (!c.placeId || seen.has(c.placeId)) continue;
        seen.add(c.placeId);
        if (c.lat != null && c.lng != null) {
          all.push({
            ...c,
            location: { type: "Point", coordinates: [c.lng, c.lat] },
          });
        }
      }
    }

    if (all.length === 0) {
      return NextResponse.json({ message: "No clinics found", seeded: 0 });
    }

    await coll.deleteMany({});
    const result = await coll.insertMany(all);

    await coll.createIndex({ location: "2dsphere" }).catch(() => {});

    return NextResponse.json({
      message: "Clinics seeded",
      seeded: result.insertedCount,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
