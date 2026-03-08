import * as cheerio from "cheerio";
import { NextResponse } from "next/server";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=300&auto=format&fit=crop";

/** Fallback list when Google Places is not configured or fails. Includes rating for sort. */
const FALLBACK_DOCTORS = [
  { name: "Dr. Sarah Chen", role: "Ophthalmologist", bio: "Specialist in retinal diseases and advanced eye surgery.", image: DEFAULT_IMAGE, address: "4500 S Lancaster Rd, Dallas, TX 75216", lat: 32.6881, lng: -96.7885, hours: "Mon–Fri: 9am – 5pm", insurance: "Medicare, Blue Cross, Aetna", languages: "English, Spanish", rating: 4.8, userRatingCount: 124 },
  { name: "Dr. James Okafor", role: "Optometrist", bio: "Expert in comprehensive eye exams and contact lens fitting.", image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&h=300&auto=format&fit=crop", address: "3600 Gaston Ave, Dallas, TX 75246", lat: 32.7870, lng: -96.7738, hours: "Mon–Fri: 8am – 6pm", insurance: "Medicare, Blue Cross, UnitedHealthcare", languages: "English, Spanish", rating: 4.6, userRatingCount: 89 },
  { name: "Dr. Amira Hassan", role: "Neuro-Ophthalmologist", bio: "Focuses on vision problems related to the nervous system.", image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=300&h=300&auto=format&fit=crop", address: "8200 Walnut Hill Ln, Dallas, TX 75231", lat: 32.8712, lng: -96.7580, hours: "Mon–Thu: 9am – 4pm", insurance: "Medicare, Aetna, Cigna", languages: "English, Arabic", rating: 4.9, userRatingCount: 67 },
  { name: "Dr. Liam Torres", role: "Pediatric Eye Specialist", bio: "Dedicated to children's eye health.", image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&h=300&auto=format&fit=crop", address: "1935 Medical District Dr, Dallas, TX 75235", lat: 32.8107, lng: -96.8370, hours: "Mon–Fri: 9am – 5pm", insurance: "Medicare, Blue Cross, Medicaid", languages: "English, Spanish", rating: 4.7, userRatingCount: 156 },
  { name: "Dr. Mei Lin", role: "Cornea Specialist", bio: "Performs corneal transplants and treats dry eye syndrome.", image: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=300&h=300&auto=format&fit=crop", address: "7777 Forest Ln, Dallas, TX 75230", lat: 32.9071, lng: -96.7697, hours: "Mon–Fri: 8am – 5pm", insurance: "Medicare, Blue Cross, Aetna", languages: "English, Mandarin", rating: 4.5, userRatingCount: 43 },
  { name: "Dr. Carlos Mendes", role: "Glaucoma Specialist", bio: "Over 15 years managing complex glaucoma cases.", image: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&h=300&auto=format&fit=crop", address: "5201 Harry Hines Blvd, Dallas, TX 75235", lat: 32.8195, lng: -96.8412, hours: "Mon–Fri: 9am – 5pm", insurance: "Medicare, Blue Cross, Aetna, Humana", languages: "English, Spanish, Portuguese", rating: 4.4, userRatingCount: 98 },
];

/** Format Google's regularOpeningHours to a short string (e.g. "Mon–Fri: 9am – 5pm") */
function formatOpeningHours(periods) {
  if (!periods?.length) return null;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const parts = periods.map((p) => {
    const open = p.open;
    const close = p.close;
    if (!open || !close) return null;
    const dayOpen = dayNames[open.day ?? 0] ?? "";
    const dayClose = dayNames[close.day ?? 0] ?? "";
    const timeOpen = formatHour(open.hour, open.minute);
    const timeClose = formatHour(close.hour, close.minute);
    if (dayOpen === dayClose) return `${dayOpen} ${timeOpen}–${timeClose}`;
    return `${dayOpen}–${dayClose} ${timeOpen}–${timeClose}`;
  }).filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}
function formatHour(h, m) {
  if (h == null) return "";
  const hour = Number(h) % 24;
  const min = Number(m) || 0;
  const am = hour < 12;
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${min.toString().padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

/** Fetch real doctors from Google Places API (eye doctors / ophthalmologists near location) */
async function fetchDoctorsFromGooglePlaces(lat, lng, apiKey) {
  const url = "https://places.googleapis.com/v1/places:searchText";
  const body = {
    textQuery: "ophthalmologist eye doctor optometrist",
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 50000,
      },
    },
    maxResultCount: 20,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const places = data.places || [];
  const doctors = places.map((p) => {
    const name = p.displayName?.text || "Eye Care Provider";
    const address = p.formattedAddress || "";
    const location = p.location;
    const latP = location?.latitude ?? 0;
    const lngP = location?.longitude ?? 0;
    return {
      name,
      role: "Eye care provider",
      bio: "Practice information from Google. Contact office for insurance and languages.",
      image: DEFAULT_IMAGE,
      address,
      lat: latP,
      lng: lngP,
      hours: "See booking for availability",
      insurance: "Contact office",
      languages: "Contact office",
      rating: p.rating != null ? Number(p.rating) : null,
      userRatingCount: p.userRatingCount != null ? Number(p.userRatingCount) : null,
      placeId: p.id,
    };
  }).filter((d) => d.lat && d.lng && d.address);

  if (doctors.length === 0) return null;

  for (let i = 0; i < Math.min(doctors.length, 10); i++) {
    const d = doctors[i];
    if (!d.placeId) continue;
    try {
      const detailRes = await fetch(
        `https://places.googleapis.com/v1/places/${d.placeId}?fields=regularOpeningHours`,
        { headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "regularOpeningHours" } }
      );
      if (!detailRes.ok) continue;
      const detail = await detailRes.json();
      const hours = detail.regularOpeningHours;
      if (hours?.periods?.length) {
        const formatted = formatOpeningHours(hours.periods);
        if (formatted) d.hours = formatted;
      }
    } catch (_) {
      // keep default hours
    }
  }
  return doctors;
}

/** Geocode an address to lat/lng using Nominatim */
async function geocodeAddress(address) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { "Accept-Language": "en", "User-Agent": "HackAI-EyeHealth/1.0" } }
    );
    const data = await res.json();
    if (!data?.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

/** Scrape a provider-directory-style page for doctor info. Tries common patterns. */
async function scrapeDoctorsFromUrl(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; HackAI-EyeHealth/1.0)" },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = cheerio.load(html);
  const doctors = [];

  // Pattern 1: Cards with .doctor, .provider, .physician, [data-type="doctor"], etc.
  const cardSelectors = [
    "[class*='doctor']", "[class*='provider']", "[class*='physician']",
    "[class*='Doctor']", ".profile-card", ".team-member", "article",
  ];
  let cards = [];
  for (const sel of cardSelectors) {
    $(sel).each((_, el) => {
      const $el = $(el);
      const text = $el.text();
      if (text.length > 50 && text.length < 2000) cards.push($el);
    });
    if (cards.length > 0) break;
  }

  // Pattern 2: List items or divs that contain "Dr." and an address-like string
  if (cards.length === 0) {
    $("p, li, div").each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      const hasDr = /\bDr\.\s+[A-Za-z]/.test(text);
      const hasAddress = /\d+[\s\w.]+,?\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s+\d{5}/.test(text) || /,\s*TX\s+\d{5}/.test(text);
      if (hasDr && (hasAddress || text.length > 80) && text.length < 800) {
        cards.push($el);
      }
    });
  }

  for (const $card of cards.slice(0, 20)) {
    const fullText = $card.text().trim();
    const nameMatch = fullText.match(/(?:Dr\.|Doctor)\s+([A-Za-z\s]+?)(?:\s*[-–|,]|\s{2}|$)/);
    const name = nameMatch ? `Dr. ${nameMatch[1].trim()}` : fullText.slice(0, 40).trim() || "Doctor";
    const addressMatch = fullText.match(/(\d+[\s\w.]+,?\s*[A-Za-z\s]+(?:,\s*[A-Z]{2})?\s*\d{5}(?:-\d{4})?)/);
    const address = addressMatch ? addressMatch[1].trim() : "";
    const roleMatch = fullText.match(/(?:Ophthalmologist|Optometrist|Eye\s+Specialist|MD|DO)/i);
    const role = roleMatch ? roleMatch[0] : "Eye Care Provider";
    const insuranceMatch = fullText.match(/(?:Insurance|Accepts?):?\s*([^.]+?)(?:\n|$|\.|Languages)/i);
    const insurance = insuranceMatch ? insuranceMatch[1].trim().slice(0, 120) : "Contact office";
    const langMatch = fullText.match(/(?:Languages?|Speaks?):?\s*([^.]+?)(?:\n|$)/i);
    const languages = langMatch ? langMatch[1].trim().slice(0, 80) : "English";

    if (!address && fullText.length < 30) continue;

    const img = $card.find("img").attr("src");
    const image = img && (img.startsWith("http") || img.startsWith("//")) ? (img.startsWith("//") ? `https:${img}` : img) : DEFAULT_IMAGE;

    doctors.push({
      name: name.slice(0, 60),
      role,
      bio: fullText.slice(0, 300).replace(/\s+/g, " ").trim(),
      image,
      address: address || "Address on request",
      hours: "Contact office",
      insurance,
      languages,
      rating: null,
      userRatingCount: null,
    });
  }

  return doctors;
}

/** Haversine distance in km */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, d = Math.PI / 180;
  const dLat = (lat2 - lat1) * d;
  const dLng = (lng2 - lng1) * d;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d) * Math.cos(lat2 * d) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get("zip")?.trim();
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const scrapeUrl = searchParams.get("scrapeUrl")?.trim();

  let userLat = null;
  let userLng = null;

  if (zip) {
    const geo = await geocodeAddress(zip);
    if (geo) {
      userLat = geo.lat;
      userLng = geo.lng;
    }
  } else if (latParam != null && lngParam != null) {
    userLat = parseFloat(latParam);
    userLng = parseFloat(lngParam);
  }

  const centerLat = userLat ?? 32.7767;
  const centerLng = userLng ?? -96.7970;
  const googleKey = process.env.GOOGLE_PLACES_API_KEY;

  let doctors = [];
  let source = "fallback";

  if (googleKey) {
    try {
      const fromGoogle = await fetchDoctorsFromGooglePlaces(centerLat, centerLng, googleKey);
      if (fromGoogle?.length > 0) {
        doctors = fromGoogle;
        source = "google_places";
      }
    } catch (_) {
      // fall through to fallback or scrape
    }
  }

  if (doctors.length === 0 && scrapeUrl && scrapeUrl.startsWith("http")) {
    try {
      const scraped = await scrapeDoctorsFromUrl(scrapeUrl);
      if (scraped.length > 0) {
        for (const d of scraped) {
          if (!d.lat || !d.lng) {
            const coords = await geocodeAddress(d.address);
            if (coords) {
              d.lat = coords.lat;
              d.lng = coords.lng;
            }
          }
        }
        const valid = scraped.filter((d) => d.lat && d.lng);
        if (valid.length > 0) {
          doctors = valid;
          source = "scrape";
        }
      }
    } catch (_) {}
  }

  if (doctors.length === 0) {
    doctors = [...FALLBACK_DOCTORS];
    source = "fallback";
  }

  // Geocode any doctor missing lat/lng
  for (const d of doctors) {
    if (d.lat != null && d.lng != null) continue;
    const coords = await geocodeAddress(d.address);
    if (coords) {
      d.lat = coords.lat;
      d.lng = coords.lng;
    }
  }

  const withCoords = doctors.filter((d) => d.lat != null && d.lng != null);
  if (withCoords.length === 0) {
    return NextResponse.json({ doctors: FALLBACK_DOCTORS, source: "fallback" });
  }

  if (userLat != null && userLng != null) {
    const withDist = withCoords.map((d) => ({ ...d, dist: haversineKm(userLat, userLng, d.lat, d.lng) }));
    withDist.sort((a, b) => a.dist - b.dist);
    return NextResponse.json({ doctors: withDist, source });
  }

  return NextResponse.json({ doctors: withCoords, source });
}
