# Iris – Recent process & changes

Summary of the latest development process and decisions.

---

## 1. Main page design (disease report style)

- **Goal:** Make the home page match the design of `/report/disease`.
- **Done:**
  - Replaced dark starfield hero with a light layout using the same design system.
  - Header: dark navy (#0d1526), IRIS branding, eye icon, “Welcome”.
  - Background: #f0f5fb.
  - Typography: Bebas Neue, DM Mono, Instrument Serif, DM Sans.
  - Feature cards: white cards, borders, hover; “About Iris” hero card; footer aligned with disease report.

---

## 2. Find Clinic (formerly Find Doctor)

- **Goal:** One-click to open the finder; match disease report styling.
- **Done:**
  - Clicking “Find Clinic” opens the clinic modal directly (no intermediate “Open Doctor Finder” step).
  - Modal uses same header, colors, and fonts as the disease report.
  - Copy updated to “Find a Clinic” and “Eye clinics near you”.

---

## 3. Real clinic data only (no fake data)

- **Goal:** Use only real clinic data; remove individual-doctor fake data.
- **Done:**
  - **Google Places:** Search for “eye clinic optometry ophthalmology vision center” (clinics, not individuals). Optional; requires `GOOGLE_PLACES_API_KEY`.
  - **NPPES:** Organizations only (NPI-2) for Ophthalmology and Optometrist; free, no API key. Search by ZIP and/or state; if ZIP returns nothing, fallback to state-only search.
  - **Scrape:** Optional, via `?scrapeUrl=...`.
  - **Removed:** All fake/fallback doctor lists (`FALLBACK_DOCTORS`, `DEFAULT_DOCTORS`). When no source returns results, API returns `doctors: []` and UI shows an empty state with instructions (ZIP or “Use My Location”).

---

## 4. Clinic-focused flow (no in-app booking)

- **Goal:** Show clinic info and send users to the clinic (or Google) to book; no booking inside the app.
- **Done:**
  - Removed date/time picker, confirm booking, and receipt from the modal.
  - One primary action: **Visit website** (if we have it) or **Find online** (Google search for “[clinic name] [address] eye clinic book”).
  - NPPES doesn’t provide websites; Google Places can (when key is set and `websiteUri` is returned).

---

## 5. Review links (Google & Yelp)

- **Goal:** Link to where users can see reviews (Google, Yelp).
- **Done:**
  - Every clinic gets `googleMapsUrl` and `yelpUrl` (built from name + address).
  - **Google Maps & Reviews:** Opens Google Maps for the clinic (reviews, photos).
  - **Find on Yelp:** Opens Yelp search; optional `/api/yelp` scraper tries to resolve the direct Yelp business page when viewing a clinic.
  - Clinic detail shows these buttons above the “About” section.

---

## 6. Tech stack (for reference)

- **Frontend:** Next.js 16, React 19, Tailwind CSS, Framer Motion.
- **Data:** NPPES API (clinics), Google Places API (optional), Nominatim (geocode/reverse).
- **APIs used:** `/api/doctors` (clinics + links), `/api/yelp` (optional Yelp page resolution).

---

## 7. Files touched recently

| Area              | Files |
|-------------------|--------|
| Main page design  | `frontend/src/components/App.jsx` |
| Clinic finder     | `frontend/src/components/DoctorModal.jsx` |
| Clinic data + links | `frontend/src/app/api/doctors/route.js` |
| Yelp link helper  | `frontend/src/app/api/yelp/route.js` |
| Copy / panels     | `frontend/src/components/PanelOverlay.jsx` |

---

*Last updated: March 2026*
