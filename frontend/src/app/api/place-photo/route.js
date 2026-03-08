import { NextResponse } from "next/server";

/**
 * Proxy for Google Place Photos. Keeps API key server-side.
 * GET /api/place-photo?photo_reference=XXX
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const photoRef = searchParams.get("photo_reference")?.trim();
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=300&auto=format&fit=crop";

  if (!photoRef) {
    return NextResponse.json({ error: "Missing photo_reference" }, { status: 400 });
  }
  if (!key) {
    return NextResponse.redirect(DEFAULT_IMAGE, 302);
  }

  const url = `https://maps.googleapis.com/maps/api/place/photo?maxheight=400&photo_reference=${encodeURIComponent(photoRef)}&key=${key}`;

  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch photo" }, { status: 502 });
  }
}
