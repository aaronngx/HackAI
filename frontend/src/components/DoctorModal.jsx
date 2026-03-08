"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const C = {
  cream: "#f5f2ee",
  brand: "#00c4d4",
};

/** Open clinic website, or Google search to find and book. */
function getBookUrl(clinic) {
  if (clinic.website) return clinic.website;
  return clinic.googleSearchUrl || `https://www.google.com/search?q=${encodeURIComponent(clinic.name + " " + (clinic.address || "") + " eye clinic book")}`;
}

function StarRating({ rating, count, size = 14, color = "#111" }) {
  if (rating == null) return null;
  const r = Number(rating).toFixed(1);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: size, color, fontWeight: 600 }}>
      <span style={{ color: "#f59e0b" }}>★</span> {r}
      {count != null && count > 0 && (
        <span style={{ fontWeight: 500, opacity: 0.85, fontSize: size - 2 }}>({count} reviews)</span>
      )}
    </span>
  );
}

function ClinicDetailCard({ clinic, onClose, onShowMap }) {
  const [yelpUrl, setYelpUrl] = useState(clinic.yelpUrl);
  const hours = clinic.hours ?? "Mon–Fri: 9am – 5pm";
  const insurance = clinic.insurance ?? "Medicare, Blue Cross, Aetna";
  const languages = clinic.languages ?? "English, Spanish";
  const bookUrl = getBookUrl(clinic);
  const hasReviewLinks = clinic.googleMapsUrl || yelpUrl;

  useEffect(() => {
    if (!clinic.yelpUrl) return;
    fetch(`/api/yelp?name=${encodeURIComponent(clinic.name)}&location=${encodeURIComponent(clinic.address || "")}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.url && data.source === "direct") setYelpUrl(data.url);
      })
      .catch(() => {});
  }, [clinic.name, clinic.address, clinic.yelpUrl]);

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.9 }}
      style={{
        position: "absolute",
        inset: 0,
        background: "#fff",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ position: "relative", height: 220, flexShrink: 0 }}>
          <img
            src={clinic.image}
            alt={clinic.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }} />
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={onClose}
            style={{
              position: "absolute", top: 12, left: 12,
              background: "rgba(13,21,38,0.8)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10,
              width: 36, height: 36, color: C.cream, fontSize: 18,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(4px)", fontFamily: "'DM Mono'",
            }}
          >
            ←
          </motion.button>
          <div style={{ position: "absolute", bottom: 14, left: 16, right: 16 }}>
            <div style={{ color: "#fff", fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 2 }}>{clinic.name}</div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontFamily: "'DM Mono'", fontSize: 12 }}>{clinic.role}</div>
            {clinic.rating != null && (
              <div style={{ marginTop: 6 }}>
                <StarRating rating={clinic.rating} count={clinic.userRatingCount} size={13} color="#fff" />
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {clinic.rating != null && (
            <div style={{ marginBottom: 4 }}>
              <StarRating rating={clinic.rating} count={clinic.userRatingCount} size={14} />
            </div>
          )}
          {hasReviewLinks && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {clinic.googleMapsUrl && (
                <a href={clinic.googleMapsUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  <motion.span
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
                      background: "#f0f5fb", border: "1px solid #ccd8ee", borderRadius: 10,
                      fontSize: 12, color: "#0d1b2e", fontFamily: "'DM Mono'",
                    }}
                  >
                    📍 Google Maps & Reviews
                  </motion.span>
                </a>
              )}
              {yelpUrl && (
                <a href={yelpUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  <motion.span
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
                      background: "#f0f5fb", border: "1px solid #ccd8ee", borderRadius: 10,
                      fontSize: 12, color: "#0d1b2e", fontFamily: "'DM Mono'",
                    }}
                  >
                    ⭐ Find on Yelp
                  </motion.span>
                </a>
              )}
            </div>
          )}
          <div>
            <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#4a6280", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>About</div>
            <p style={{ margin: 0, fontSize: 14, color: "#0d1b2e", lineHeight: 1.7, fontFamily: "'DM Sans'" }}>{clinic.bio}</p>
          </div>

          {[
            { icon: "📍", label: "Address", value: clinic.address },
            ...(clinic.phone ? [{ icon: "📞", label: "Phone", value: clinic.phone }] : []),
            { icon: "🕐", label: "Hours", value: hours },
            { icon: "💳", label: "Insurance", value: insurance },
            { icon: "🗣", label: "Languages", value: languages },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</div>
              <div>
                <div style={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#4a6280", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, color: "#0d1b2e", fontFamily: "'DM Sans'" }}>{value}</div>
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={onShowMap}
              style={{
                flex: 1, padding: "11px 0", background: "#fff", color: "#0d1b2e",
                border: "1px solid #ccd8ee", borderRadius: 12, fontSize: 13, cursor: "pointer",
                fontFamily: "'DM Mono'",
              }}
            >
              Get direction
            </motion.button>
            <motion.a
              href={bookUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, textDecoration: "none", display: "block" }}
            >
              <motion.span
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                style={{
                  display: "block", width: "100%", padding: "11px 0", textAlign: "center",
                  background: `linear-gradient(135deg, ${C.brand}, #0090a0)`, color: "#fff",
                  border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'Bebas Neue'", letterSpacing: 2,
                }}
              >
                {clinic.website ? "Visit website" : "Find online"}
              </motion.span>
            </motion.a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, d = Math.PI / 180;
  const dLat = (lat2 - lat1) * d;
  const dLng = (lng2 - lng1) * d;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d) * Math.cos(lat2 * d) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getDirectionsUrl(address) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

function getEmbedUrl(address) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}

function getUserMapUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
}

async function geocodeZip(zip) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(zip)}&format=json&limit=1`,
    { headers: { "Accept-Language": "en" } }
  );
  const data = await res.json();
  if (!data.length) throw new Error("ZIP not found");
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
}

function DoctorCard({ doctor, index, selected, onSelect, distanceKm }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
      onClick={() => onSelect(doctor)}
      style={{
        background: selected ? "#0d1526" : "#fff",
        borderRadius: 12,
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: 12,
        flexShrink: 0,
        cursor: "pointer",
        transition: "background 0.2s, box-shadow 0.2s",
        boxShadow: selected ? "0 4px 16px rgba(13,21,38,0.2)" : "0 2px 8px rgba(13,27,46,0.06)",
        border: `1px solid ${selected ? C.brand : "#ccd8ee"}`,
      }}
    >
      <img
        src={doctor.image}
        alt={doctor.name}
        style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 13, color: selected ? C.cream : "#0d1b2e" }}>{doctor.name}</div>
          {distanceKm != null && (
            <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: selected ? "rgba(255,255,255,0.6)" : "#4a6280", whiteSpace: "nowrap", marginLeft: 4 }}>
              {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}
            </div>
          )}
        </div>
        <div style={{ fontFamily: "'DM Mono'", fontSize: 11, color: selected ? "rgba(255,255,255,0.7)" : "#4a6280", marginBottom: 4 }}>{doctor.role}</div>
        {doctor.rating != null && (
          <div style={{ marginBottom: 2 }}>
            <StarRating rating={doctor.rating} count={doctor.userRatingCount} size={11} color={selected ? "rgba(255,255,255,0.9)" : "#666"} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

async function fetchDoctorsByZip(zip) {
  const res = await fetch(`/api/doctors?zip=${encodeURIComponent(zip)}`);
  if (!res.ok) throw new Error("Failed to load doctors");
  const data = await res.json();
  return data.doctors || [];
}

async function fetchDoctorsByLatLng(lat, lng) {
  const res = await fetch(`/api/doctors?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error("Failed to load doctors");
  const data = await res.json();
  return data.doctors || [];
}

async function fetchClinicsDefault() {
  const res = await fetch("/api/doctors");
  if (!res.ok) return [];
  const data = await res.json();
  return data.doctors || [];
}

export default function DoctorModal({ onClose }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailDoctor, setDetailDoctor] = useState(null);
  const [viewMode, setViewMode] = useState("map");
  const [mapSrc, setMapSrc] = useState(() => "https://www.google.com/maps?q=eye+clinic+USA&output=embed");
  const [userLocation, setUserLocation] = useState(null);
  const [sortedDoctors, setSortedDoctors] = useState([]);
  const [zipInput, setZipInput] = useState("");
  const [locStatus, setLocStatus] = useState("");
  const [sortBy, setSortBy] = useState("rating_high"); // "distance" | "rating_high" | "rating_low" | "reviews"
  const zipRef = useRef(null);
  const initialFetch = useRef(false);

  if (!initialFetch.current && typeof window !== "undefined") {
    initialFetch.current = true;
    fetchClinicsDefault().then((list) => {
      if (list.length > 0) {
        const byRating = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        setDoctors(list);
        setSortedDoctors(byRating);
        setSelected(byRating[0]);
        setDetailDoctor(byRating[0]);
        setMapSrc(getEmbedUrl(byRating[0].address));
      }
    });
  }

  const applyLocation = (lat, lng, label, doctorsList) => {
    setUserLocation({ lat, lng, label });
    setLocStatus(label);
    setSortBy("distance");
    const list = doctorsList || doctors;
    const withDist = list.map((d) => ({ ...d, dist: haversineKm(lat, lng, d.lat, d.lng) }));
    withDist.sort((a, b) => a.dist - b.dist);
    setSortedDoctors(withDist);
    setDoctors(withDist);
    setMapSrc(getUserMapUrl(lat, lng));
    setSelected(null);
    setDetailDoctor(null);
    setViewMode("map");
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) { setLocStatus("Geolocation not supported"); return; }
    setLocStatus("Detecting location…");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const list = await fetchDoctorsByLatLng(lat, lng);
          setLoading(false);
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
              { headers: { "Accept-Language": "en" } }
            );
            const data = await res.json();
            const label = data.address?.postcode
              ? `Near ${data.address.city || data.address.town || ""} ${data.address.postcode}`
              : "Your location";
            applyLocation(lat, lng, label, list);
          } catch {
            applyLocation(lat, lng, "Your location", list);
          }
        } catch {
          setLocStatus("Could not load clinics");
          setLoading(false);
        }
      },
      () => { setLocStatus("Location access denied"); setLoading(false); }
    );
  };

  const handleZipSearch = async (e) => {
    e.preventDefault();
    if (!zipInput.trim()) return;
    setLocStatus("Searching…");
    setLoading(true);
    try {
      const list = await fetchDoctorsByZip(zipInput.trim());
      const { lat, lng, label } = await geocodeZip(zipInput.trim());
      setLoading(false);
      applyLocation(lat, lng, label.split(",").slice(0, 2).join(","), list);
    } catch {
      setLocStatus("ZIP code not found");
      setLoading(false);
    }
  };

  const handleSelectDoctor = (doc) => {
    setSelected(doc);
    setDetailDoctor(doc);
    setMapSrc(getEmbedUrl(doc.address));
    setViewMode("detail");
  };

  const applySort = (list, order) => {
    const arr = [...list];
    if (order === "distance" && userLocation) {
      arr.sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0));
    } else if (order === "rating_high") {
      arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (order === "rating_low") {
      arr.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
    } else if (order === "reviews") {
      arr.sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0));
    }
    return arr;
  };

  const handleSortChange = (e) => {
    const value = e.target.value;
    setSortBy(value);
    const base = sortedDoctors.length > 0 ? sortedDoctors : doctors;
    setSortedDoctors(applySort(base, value));
  };

  const currentList = sortedDoctors.length > 0 ? sortedDoctors : doctors;
  const hasClinics = currentList.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,14,26,0.72)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(6px)",
        padding: 24,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.9 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#f0f5fb",
          borderRadius: 20,
          width: "min(1100px, 95vw)",
          height: "min(700px, 90vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
        }}
      >
        {/* Header — matches disease report */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "20px 28px", background: "#0d1526", borderBottom: "1px solid #1e2d45", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="1.5">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
            <div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 18, letterSpacing: 3, color: C.cream }}>IRIS</div>
              <div style={{ fontFamily: "'Instrument Serif'", fontSize: 22, color: C.cream, lineHeight: 1.2 }}>Find a Clinic</div>
              <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Eye clinics near you — view reviews on Google & Yelp</div>
            </div>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10,
              width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: C.cream, fontFamily: "'DM Mono'", fontSize: 18,
            }}>
            ×
          </motion.button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <div style={{ width: 310, flexShrink: 0, display: "flex", flexDirection: "column", background: "#ffffff", borderRight: "1px solid #ccd8ee" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #ccd8ee", display: "flex", flexDirection: "column", gap: 10 }}>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleGeolocate}
                style={{
                  width: "100%", padding: "10px 0", border: "none", borderRadius: 12, cursor: "pointer",
                  background: `linear-gradient(135deg, ${C.brand}, #0090a0)`, color: "#fff",
                  fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <span>📍</span> Use My Location
              </motion.button>
              <form onSubmit={handleZipSearch} style={{ display: "flex", gap: 8 }}>
                <input
                  ref={zipRef}
                  value={zipInput}
                  onChange={(e) => setZipInput(e.target.value)}
                  placeholder="Enter ZIP code…"
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: "1px solid #ccd8ee",
                    fontSize: 13,
                    outline: "none",
                    background: "#fff",
                    color: "#0d1b2e",
                    fontFamily: "'DM Sans'",
                  }}
                />
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  type="submit"
                  style={{
                    padding: "9px 16px", border: "none", borderRadius: 10, cursor: "pointer",
                    background: "#0d1526", color: C.cream, fontFamily: "'DM Mono'", fontSize: 12,
                  }}
                >
                  Go
                </motion.button>
              </form>
              {(loading || locStatus) && (
                <div style={{ fontFamily: "'DM Mono'", fontSize: 11, color: locStatus.includes("denied") || locStatus.includes("not found") || locStatus.includes("Could not") ? "#c0392b" : "#4a6280", paddingLeft: 2 }}>
                  {loading || locStatus.includes("Detecting") || locStatus.includes("Searching") ? "⏳ " : userLocation ? "✓ " : "⚠ "}
                  {loading ? "Loading clinics…" : locStatus}
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
              {hasClinics ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 4 }}>
                    <p style={{ margin: 0, fontFamily: "'DM Mono'", fontSize: 10, color: "#4a6280", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {currentList.length} Clinics
                    </p>
                    <label style={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#4a6280", marginBottom: 2 }}>Sort clinics</label>
                    <select
                      value={sortBy}
                      onChange={handleSortChange}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #ccd8ee",
                        fontSize: 12,
                        background: "#fff",
                        color: "#0d1b2e",
                        cursor: "pointer",
                        fontFamily: "'DM Sans'",
                      }}
                    >
                      {userLocation && <option value="distance">Sort by distance</option>}
                      <option value="rating_high">Sort by rating (high first)</option>
                      <option value="rating_low">Sort by rating (low first)</option>
                      <option value="reviews">Sort by most reviews</option>
                    </select>
                  </div>
                  {currentList.map((doc, i) => (
                    <DoctorCard
                      key={`${doc.name}-${doc.npi || i}`}
                      doctor={doc}
                      index={i}
                      selected={selected?.name === doc.name}
                      onSelect={handleSelectDoctor}
                      distanceKm={userLocation ? doc.dist : null}
                    />
                  ))}
                </>
              ) : (
                <div style={{ padding: 20, textAlign: "center" }}>
                  <p style={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#4a6280", marginBottom: 12 }}>
                    Enter a ZIP code above or tap “Use My Location” to find real eye clinics near you.
                  </p>
                  <p style={{ fontSize: 13, color: "#0d1b2e", lineHeight: 1.6 }}>
                    Results come from the official NPI registry and Google — no fake data.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div style={{ flex: 1, position: "relative" }}>
            <AnimatePresence mode="wait">
              <motion.iframe
                key={mapSrc}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                src={mapSrc}
                width="100%"
                height="100%"
                style={{ border: "none", display: "block" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </AnimatePresence>

            {hasClinics && (
            <div style={{ position: "absolute", top: 12, right: 12, zIndex: 20 }}>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (viewMode === "map") {
                    const baseDoctor = detailDoctor || selected || currentList[0];
                    if (baseDoctor) {
                      setDetailDoctor(baseDoctor);
                    }
                    setViewMode("detail");
                  } else {
                    setViewMode("map");
                  }
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 12,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "#0d1526",
                  color: C.cream,
                  fontFamily: "'DM Mono'",
                }}
              >
                {viewMode === "map" || !detailDoctor ? "Get detail" : "Get direction"}
              </motion.button>
            </div>
            )}

            <AnimatePresence>
              {viewMode === "detail" && detailDoctor && (
                <ClinicDetailCard
                  clinic={detailDoctor}
                  onClose={() => {
                    setDetailDoctor(null);
                    setViewMode("map");
                  }}
                  onShowMap={() => setViewMode("map")}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
