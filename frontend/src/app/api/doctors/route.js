import * as cheerio from "cheerio";
import { NextResponse } from "next/server";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=300&auto=format&fit=crop";

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

/** Build review/search links for a clinic (no scraping - direct links to review sites) */
function buildClinicLinks(name, address) {
  const query = `${name} ${address || ""}`.trim();
  const encoded = encodeURIComponent(query);
  return {
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    yelpUrl: `https://www.yelp.com/search?find_desc=${encodeURIComponent(name)}&find_loc=${encodeURIComponent(address || "")}`,
    googleSearchUrl: `https://www.google.com/search?q=${encoded}`,
  };
}

/** Fetch eye clinics from Google Places API (clinics/practices with ratings, website) */
async function fetchClinicsFromGooglePlaces(lat, lng, apiKey) {
  const url = "https://places.googleapis.com/v1/places:searchText";
  const body = {
    textQuery: "eye clinic optometry ophthalmology vision center",
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
  const clinics = places.map((p) => {
    const name = p.displayName?.text || "Eye Care Clinic";
    const address = p.formattedAddress || "";
    const location = p.location;
    const latP = location?.latitude ?? 0;
    const lngP = location?.longitude ?? 0;
    const links = buildClinicLinks(name, address);
    return {
      name,
      role: "Eye care clinic",
      bio: "Eye care clinic from Google. View reviews on Google Maps or Yelp.",
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
      ...links,
    };
  }).filter((d) => d.lat && d.lng && d.address);

  if (clinics.length === 0) return null;

  for (let i = 0; i < Math.min(clinics.length, 10); i++) {
    const d = clinics[i];
    if (!d.placeId) continue;
    try {
      const detailRes = await fetch(
        `https://places.googleapis.com/v1/places/${d.placeId}`,
        { headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "regularOpeningHours,websiteUri" } }
      );
      if (!detailRes.ok) continue;
      const detail = await detailRes.json();
      const hours = detail.regularOpeningHours;
      if (hours?.periods?.length) {
        const formatted = formatOpeningHours(hours.periods);
        if (formatted) d.hours = formatted;
      }
      if (detail.websiteUri) d.website = detail.websiteUri;
    } catch (_) {
      // keep default hours
    }
  }
  return clinics;
}

/** Fetch eye clinics from NPPES (organizations only - NPI-2) - free, no API key */
async function fetchClinicsFromNPPES(postalCode, state) {
  const params = new URLSearchParams({
    version: "2.1",
    limit: "50",
    enumeration_type: "NPI-2",
  });
  if (postalCode) params.set("postal_code", postalCode.slice(0, 5));
  if (state) params.set("state", state);

  const clinics = [];
  const taxonomies = ["Ophthalmology", "Optometrist"];

  for (const tax of taxonomies) {
    try {
      const p = new URLSearchParams(params);
      p.set("taxonomy_description", tax);
      const res = await fetch(
        `https://npiregistry.cms.hhs.gov/api/?${p.toString()}`,
        { headers: { "User-Agent": "HackAI-EyeHealth/1.0" } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (data.Errors?.length) continue;
      const results = data.results || [];
      for (const r of results) {
        const addr = r.addresses?.find((a) => a.address_purpose === "LOCATION") || r.addresses?.[0];
        if (!addr?.address_1) continue;
        const parts = [addr.address_1, addr.address_2, addr.city, addr.state, addr.postal_code?.slice(0, 5)].filter(Boolean);
        const address = parts.join(", ").replace(/\s+/g, " ");
        const phone = addr.telephone_number || null;
        const name = r.basic?.organization_name || "Eye Care Clinic";
        const role = tax === "Ophthalmology" ? "Ophthalmology clinic" : "Optometry clinic";
        const links = buildClinicLinks(name, address);
        clinics.push({
          name,
          role,
          bio: `Licensed eye care clinic from NPI registry. View reviews on Google Maps or Yelp.`,
          image: DEFAULT_IMAGE,
          address,
          phone,
          hours: "Contact office for hours",
          insurance: "Contact office",
          languages: "Contact office",
          rating: null,
          userRatingCount: null,
          website: null,
          npi: r.number,
          ...links,
        });
      }
    } catch (_) {
      // continue with next taxonomy
    }
  }

  if (clinics.length === 0) return null;

  const seen = new Set();
  let filtered = clinics;
  if (state) {
    const stateUpper = state.toUpperCase();
    filtered = clinics.filter((d) => d.address?.toUpperCase().includes(`, ${stateUpper},`) || d.address?.toUpperCase().endsWith(` ${stateUpper}`));
    if (filtered.length === 0) filtered = clinics;
  }
  const deduped = filtered.filter((d) => {
    const key = `${d.name}|${d.address}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped;
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

/** Reverse geocode lat/lng to get state and postal code */
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en", "User-Agent": "HackAI-EyeHealth/1.0" } }
    );
    const data = await res.json();
    if (!data?.address) return null;
    const addr = data.address;
    return {
      state: addr.state?.slice(0, 2) || addr["ISO3166-2-lvl4"]?.split("-")[1],
      postal_code: addr.postcode || addr.postal_code,
    };
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

    const links = buildClinicLinks(name.slice(0, 60), address || "Address on request");
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
      ...links,
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
      const fromGoogle = await fetchClinicsFromGooglePlaces(centerLat, centerLng, googleKey);
      if (fromGoogle?.length > 0) {
        doctors = fromGoogle;
        source = "google_places";
      }
    } catch (_) {
      // fall through to NPPES or scrape
    }
  }

  if (doctors.length === 0) {
    try {
      let postalCode = zip?.slice(0, 5);
      let state = "TX";
      if (userLat != null && userLng != null && !postalCode) {
        const rev = await reverseGeocode(userLat, userLng);
        if (rev) {
          state = rev.state || state;
          postalCode = rev.postal_code?.slice(0, 5) || postalCode;
        }
      }
      if (!postalCode) postalCode = "75201";
      let fromNPPES = await fetchClinicsFromNPPES(postalCode, state);
      if (fromNPPES?.length === 0 && state) {
        fromNPPES = await fetchClinicsFromNPPES(null, state);
      }
      if (fromNPPES?.length > 0) {
        doctors = fromNPPES;
        source = "nppes";
      }
    } catch (_) {
      // fall through to scrape
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

  // No fake fallback - only real data from Google Places, NPPES, or scrape

  // Geocode any clinic missing lat/lng
  for (const d of doctors) {
    if (d.lat != null && d.lng != null) continue;
    const coords = await geocodeAddress(d.address);
    if (coords) {
      d.lat = coords.lat;
      d.lng = coords.lng;
    }
  }

  // Ensure all clinics have review links (Google Maps, Yelp)
  for (const d of doctors) {
    if (!d.googleMapsUrl || !d.yelpUrl) {
      const links = buildClinicLinks(d.name, d.address);
      d.googleMapsUrl = d.googleMapsUrl ?? links.googleMapsUrl;
      d.yelpUrl = d.yelpUrl ?? links.yelpUrl;
      d.googleSearchUrl = d.googleSearchUrl ?? links.googleSearchUrl;
    }
  }

  const withCoords = doctors.filter((d) => d.lat != null && d.lng != null);
  if (withCoords.length === 0) {
    return NextResponse.json({ doctors: [], source: source || "none" });
  }

  if (userLat != null && userLng != null) {
    const withDist = withCoords.map((d) => ({ ...d, dist: haversineKm(userLat, userLng, d.lat, d.lng) }));
    withDist.sort((a, b) => a.dist - b.dist);
    return NextResponse.json({ doctors: withDist, source });
  }

  return NextResponse.json({ doctors: withCoords, source });
}
