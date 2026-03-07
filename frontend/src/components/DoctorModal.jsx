"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

function DoctorDetailCard({ doctor, onClose }) {
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
      <div style={{ position: "relative", height: 220, flexShrink: 0 }}>
        <img
          src={doctor.image}
          alt={doctor.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }} />
        <motion.button
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={onClose}
          style={{
            position: "absolute", top: 12, left: 12,
            background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%",
            width: 36, height: 36, color: "#fff", fontSize: 18,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          ←
        </motion.button>
        <div style={{ position: "absolute", bottom: 14, left: 16 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>{doctor.name}</div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>{doctor.role}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>About</div>
          <p style={{ margin: 0, fontSize: 14, color: "#333", lineHeight: 1.7 }}>{doctor.bio}</p>
        </div>

        {[
          { icon: "📍", label: "Address", value: doctor.address },
          { icon: "🕐", label: "Hours", value: "Mon–Fri: 9am – 5pm" },
          { icon: "💳", label: "Insurance", value: "Medicare, Blue Cross, Aetna" },
          { icon: "🗣", label: "Languages", value: "English, Spanish" },
        ].map(({ icon, label, value }) => (
          <div key={label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</div>
            <div>
              <div style={{ fontSize: 11, color: "#999", fontWeight: 600, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, color: "#222" }}>{value}</div>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(doctor.address)}`}
            target="_blank"
            rel="noreferrer"
            style={{
              flex: 1, padding: "11px 0", background: "#f0f0f0", color: "#111",
              borderRadius: 12, fontSize: 13, fontWeight: 600, textDecoration: "none",
              textAlign: "center",
            }}
          >
            ↗ Directions
          </a>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            style={{
              flex: 1, padding: "11px 0", background: "#111", color: "#fff",
              border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            Book Appointment
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

const doctors = [
  { name: "Dr. Sarah Chen", role: "Ophthalmologist", bio: "Specialist in retinal diseases and advanced eye surgery.", image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=300&auto=format&fit=crop", address: "4500 S Lancaster Rd, Dallas, TX 75216", lat: 32.6881, lng: -96.7885 },
  { name: "Dr. James Okafor", role: "Optometrist", bio: "Expert in comprehensive eye exams and contact lens fitting.", image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&h=300&auto=format&fit=crop", address: "3600 Gaston Ave, Dallas, TX 75246", lat: 32.7870, lng: -96.7738 },
  { name: "Dr. Amira Hassan", role: "Neuro-Ophthalmologist", bio: "Focuses on vision problems related to the nervous system.", image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=300&h=300&auto=format&fit=crop", address: "8200 Walnut Hill Ln, Dallas, TX 75231", lat: 32.8712, lng: -96.7580 },
  { name: "Dr. Liam Torres", role: "Pediatric Eye Specialist", bio: "Dedicated to children's eye health.", image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&h=300&auto=format&fit=crop", address: "1935 Medical District Dr, Dallas, TX 75235", lat: 32.8107, lng: -96.8370 },
  { name: "Dr. Mei Lin", role: "Cornea Specialist", bio: "Performs corneal transplants and treats dry eye syndrome.", image: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=300&h=300&auto=format&fit=crop", address: "7777 Forest Ln, Dallas, TX 75230", lat: 32.9071, lng: -96.7697 },
  { name: "Dr. Carlos Mendes", role: "Glaucoma Specialist", bio: "Over 15 years managing complex glaucoma cases.", image: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&h=300&auto=format&fit=crop", address: "5201 Harry Hines Blvd, Dallas, TX 75235", lat: 32.8195, lng: -96.8412 },
];

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
        background: selected ? "#111" : "#fff",
        borderRadius: 14,
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: 12,
        flexShrink: 0,
        cursor: "pointer",
        transition: "background 0.2s, box-shadow 0.2s",
        boxShadow: selected ? "0 4px 20px rgba(0,0,0,0.2)" : "0 2px 10px rgba(0,0,0,0.06)",
        border: `2px solid ${selected ? "#111" : "transparent"}`,
      }}
    >
      <img
        src={doctor.image}
        alt={doctor.name}
        style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: selected ? "#fff" : "#111" }}>{doctor.name}</div>
          {distanceKm != null && (
            <div style={{ fontSize: 10, color: selected ? "#aaa" : "#bbb", whiteSpace: "nowrap", marginLeft: 4 }}>
              {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: selected ? "#aaa" : "#888", fontWeight: 500, marginBottom: 6 }}>{doctor.role}</div>
        <a
          href={getDirectionsUrl(doctor.address)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: selected ? "#fff" : "#111",
            color: selected ? "#111" : "#fff",
            borderRadius: 7,
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ↗ Get Directions
        </a>
      </div>
    </motion.div>
  );
}

export default function DoctorModal({ onClose }) {
  const [selected, setSelected] = useState(doctors[0]);
  const [detailDoctor, setDetailDoctor] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [sortedDoctors, setSortedDoctors] = useState(doctors);
  const [zipInput, setZipInput] = useState("");
  const [locStatus, setLocStatus] = useState("");
  const [mapSrc, setMapSrc] = useState(getEmbedUrl(doctors[0].address));
  const zipRef = useRef(null);

  const applyLocation = (lat, lng, label) => {
    setUserLocation({ lat, lng, label });
    setLocStatus(label);
    const withDist = doctors.map((d) => ({ ...d, dist: haversineKm(lat, lng, d.lat, d.lng) }));
    withDist.sort((a, b) => a.dist - b.dist);
    setSortedDoctors(withDist);
    setMapSrc(getUserMapUrl(lat, lng));
    setSelected(null);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) { setLocStatus("Geolocation not supported"); return; }
    setLocStatus("Detecting location…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const label = data.address?.postcode
            ? `Near ${data.address.city || data.address.town || ""} ${data.address.postcode}`
            : "Your location";
          applyLocation(lat, lng, label);
        } catch {
          applyLocation(lat, lng, "Your location");
        }
      },
      () => setLocStatus("Location access denied")
    );
  };

  const handleZipSearch = async (e) => {
    e.preventDefault();
    if (!zipInput.trim()) return;
    setLocStatus("Searching…");
    try {
      const { lat, lng, label } = await geocodeZip(zipInput.trim());
      applyLocation(lat, lng, label.split(",").slice(0, 2).join(","));
    } catch {
      setLocStatus("ZIP code not found");
    }
  };

  const handleSelectDoctor = (doc) => {
    setSelected(doc);
    setMapSrc(getEmbedUrl(doc.address));
    setDetailDoctor(doc);
  };

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
        background: "rgba(0,0,0,0.7)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(6px)",
        padding: 24,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 24 }}
        transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.9 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#f0f0f0",
          borderRadius: 24,
          width: "min(1100px, 95vw)",
          height: "min(700px, 90vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 24px", borderBottom: "1px solid rgba(0,0,0,0.08)",
          background: "#fff", flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111" }}>Find a Doctor</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888" }}>Eye care specialists near you</p>
          </div>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose}
            style={{ background: "#e0e0e0", border: "none", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "#111" }}>
            ×
          </motion.button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <div style={{ width: 310, flexShrink: 0, display: "flex", flexDirection: "column", background: "#f0f0f0", borderRight: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ padding: "12px 14px", background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", gap: 8 }}>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleGeolocate}
                style={{ width: "100%", padding: "9px 0", background: "#111", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <span>📍</span> Use My Location
              </motion.button>
              <form onSubmit={handleZipSearch} style={{ display: "flex", gap: 6 }}>
                <input
                  ref={zipRef}
                  value={zipInput}
                  onChange={(e) => setZipInput(e.target.value)}
                  placeholder="Enter ZIP code…"
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: "1px solid #ddd", fontSize: 13, outline: "none", background: "#f8f8f8" }}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  type="submit"
                  style={{ padding: "8px 14px", background: "#444", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Go
                </motion.button>
              </form>
              {locStatus && (
                <div style={{ fontSize: 11, color: locStatus.includes("denied") || locStatus.includes("not found") ? "#e55" : "#555", paddingLeft: 2 }}>
                  {locStatus.includes("Detecting") || locStatus.includes("Searching") ? "⏳ " : userLocation ? "✓ " : "⚠ "}
                  {locStatus}
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
              <p style={{ margin: "0 0 2px", fontSize: 10, color: "#999", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {sortedDoctors.length} Specialists{userLocation ? " · sorted by distance" : " · Dallas TX"}
              </p>
              {sortedDoctors.map((doc, i) => (
                <DoctorCard
                  key={doc.name}
                  doctor={doc}
                  index={i}
                  selected={selected?.name === doc.name}
                  onSelect={handleSelectDoctor}
                  distanceKm={userLocation ? doc.dist : null}
                />
              ))}
            </div>
          </div>

          <div style={{ flex: 1, position: "relative" }}>
            <AnimatePresence>
              {detailDoctor && (
                <DoctorDetailCard doctor={detailDoctor} onClose={() => setDetailDoctor(null)} />
              )}
            </AnimatePresence>
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
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
