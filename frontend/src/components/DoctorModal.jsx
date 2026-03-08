"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppointmentReceipt from "./AppointmentReceipt.jsx";

const DEFAULT_TIME_SLOTS = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];
const NEXT_DAYS = 14;

/** Parse hours string like "Mon–Fri: 9am – 5pm" and return time slots (e.g. 9:00 AM, 9:30 AM, ... 4:30 PM) */
function getTimeSlotsFromHours(hoursStr) {
  if (!hoursStr || typeof hoursStr !== "string") return DEFAULT_TIME_SLOTS;
  const match = hoursStr.match(/(\d{1,2})\s*:?\s*(\d{2})?\s*(am|pm|AM|PM)/gi);
  if (!match || match.length < 2) return DEFAULT_TIME_SLOTS;
  const start = match[0].trim();
  const end = match[1].trim();
  const parse = (s) => {
    const m = s.match(/(\d{1,2})(?:\s*:\s*(\d{2}))?\s*(am|pm)/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    if (/pm/i.test(m[3]) && h < 12) h += 12;
    if (/am/i.test(m[3]) && h === 12) h = 0;
    return h * 60 + min;
  };
  const startMin = parse(start);
  const endMin = parse(end);
  if (startMin == null || endMin == null || endMin <= startMin) return DEFAULT_TIME_SLOTS;
  const slots = [];
  for (let m = startMin; m < endMin; m += 30) {
    const h = Math.floor(m / 60) % 24;
    const min = m % 60;
    const am = h < 12;
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    slots.push(`${h12}:${min.toString().padStart(2, "0")} ${am ? "AM" : "PM"}`);
  }
  return slots.length > 0 ? slots : DEFAULT_TIME_SLOTS;
}

function getDateOptions() {
  const out = [];
  const today = new Date();
  for (let i = 0; i < NEXT_DAYS; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push(d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }));
  }
  return out;
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

function DoctorDetailCard({ doctor, onClose, onShowMap }) {
  const [step, setStep] = useState("detail"); // 'detail' | 'booking' | 'receipt'
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [appointment, setAppointment] = useState(null);
  const dateOptions = useRef(getDateOptions()).current;

  const hours = doctor.hours ?? "Mon–Fri: 9am – 5pm";
  const insurance = doctor.insurance ?? "Medicare, Blue Cross, Aetna";
  const languages = doctor.languages ?? "English, Spanish";

  const timeSlots = useRef(getTimeSlotsFromHours(doctor.hours)).current;

  const handleBookClick = () => {
    setStep("booking");
    if (!bookingDate) setBookingDate(dateOptions[0]);
    if (!bookingTime) setBookingTime(timeSlots[0]);
  };

  const handleConfirmBooking = () => {
    setAppointment({
      doctor,
      date: bookingDate || dateOptions[0],
      time: bookingTime || timeSlots[0],
    });
    setStep("receipt");
  };

  const handleReceiptClose = () => {
    setAppointment(null);
    setStep("detail");
  };

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
      <AnimatePresence mode="wait">
        {step === "receipt" && appointment && (
          <AppointmentReceipt key="receipt" appointment={appointment} onClose={handleReceiptClose} />
        )}
        {(step === "detail" || step === "booking") && (
          <motion.div
            key="detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
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
                onClick={step === "booking" ? () => setStep("detail") : onClose}
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
              <div style={{ position: "absolute", bottom: 14, left: 16, right: 16 }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>{doctor.name}</div>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>{doctor.role}</div>
                {doctor.rating != null && (
                  <div style={{ marginTop: 6 }}>
                    <StarRating rating={doctor.rating} count={doctor.userRatingCount} size={13} color="#fff" />
                  </div>
                )}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {step === "booking" ? (
                <>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111" }}>Book appointment</h3>
                  <div>
                    <label style={{ fontSize: 11, color: "#999", fontWeight: 600, display: "block", marginBottom: 6 }}>Date</label>
                    <select
                      value={bookingDate || dateOptions[0]}
                      onChange={(e) => setBookingDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        fontSize: 14,
                        background: "#ffffff",
                        color: "#111111",
                        cursor: "pointer",
                      }}
                    >
                      {dateOptions.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "#999", fontWeight: 600, display: "block", marginBottom: 6 }}>Time</label>
                    <select
                      value={bookingTime || timeSlots[0]}
                      onChange={(e) => setBookingTime(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        fontSize: 14,
                        background: "#ffffff",
                        color: "#111111",
                        cursor: "pointer",
                      }}
                    >
                      {timeSlots.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setStep("detail")}
                      style={{ flex: 1, padding: "12px 0", background: "#f0f0f0", color: "#111", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      Back
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={handleConfirmBooking}
                      style={{ flex: 1, padding: "12px 0", background: "#111", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      Confirm booking
                    </motion.button>
                  </div>
                </>
              ) : (
                <>
                  {doctor.rating != null && (
                    <div style={{ marginBottom: 4 }}>
                      <StarRating rating={doctor.rating} count={doctor.userRatingCount} size={14} />
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>About</div>
                    <p style={{ margin: 0, fontSize: 14, color: "#333", lineHeight: 1.7 }}>{doctor.bio}</p>
                  </div>

                  {[
                    { icon: "📍", label: "Address", value: doctor.address },
                    { icon: "🕐", label: "Hours", value: hours },
                    { icon: "💳", label: "Insurance", value: insurance },
                    { icon: "🗣", label: "Languages", value: languages },
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
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={onShowMap}
                      style={{
                        flex: 1, padding: "11px 0", background: "#f0f0f0", color: "#111",
                        border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      Get direction
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={handleBookClick}
                      style={{
                        flex: 1, padding: "11px 0", background: "#111", color: "#fff",
                        border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      Book Appointment
                    </motion.button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const DEFAULT_DOCTORS = [
  { name: "Dr. Sarah Chen", role: "Ophthalmologist", bio: "Specialist in retinal diseases and advanced eye surgery.", image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=300&auto=format&fit=crop", address: "4500 S Lancaster Rd, Dallas, TX 75216", lat: 32.6881, lng: -96.7885, hours: "Mon–Fri: 9am – 5pm", insurance: "Medicare, Blue Cross, Aetna", languages: "English, Spanish" },
  { name: "Dr. James Okafor", role: "Optometrist", bio: "Expert in comprehensive eye exams and contact lens fitting.", image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&h=300&auto=format&fit=crop", address: "3600 Gaston Ave, Dallas, TX 75246", lat: 32.7870, lng: -96.7738, hours: "Mon–Fri: 8am – 6pm", insurance: "Medicare, Blue Cross, UnitedHealthcare", languages: "English, Spanish" },
  { name: "Dr. Amira Hassan", role: "Neuro-Ophthalmologist", bio: "Focuses on vision problems related to the nervous system.", image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=300&h=300&auto=format&fit=crop", address: "8200 Walnut Hill Ln, Dallas, TX 75231", lat: 32.8712, lng: -96.7580, hours: "Mon–Thu: 9am – 4pm", insurance: "Medicare, Aetna, Cigna", languages: "English, Arabic" },
  { name: "Dr. Liam Torres", role: "Pediatric Eye Specialist", bio: "Dedicated to children's eye health.", image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&h=300&auto=format&fit=crop", address: "1935 Medical District Dr, Dallas, TX 75235", lat: 32.8107, lng: -96.8370, hours: "Mon–Fri: 9am – 5pm", insurance: "Medicare, Blue Cross, Medicaid", languages: "English, Spanish" },
  { name: "Dr. Mei Lin", role: "Cornea Specialist", bio: "Performs corneal transplants and treats dry eye syndrome.", image: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=300&h=300&auto=format&fit=crop", address: "7777 Forest Ln, Dallas, TX 75230", lat: 32.9071, lng: -96.7697, hours: "Mon–Fri: 8am – 5pm", insurance: "Medicare, Blue Cross, Aetna", languages: "English, Mandarin" },
  { name: "Dr. Carlos Mendes", role: "Glaucoma Specialist", bio: "Over 15 years managing complex glaucoma cases.", image: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&h=300&auto=format&fit=crop", address: "5201 Harry Hines Blvd, Dallas, TX 75235", lat: 32.8195, lng: -96.8412, hours: "Mon–Fri: 9am – 5pm", insurance: "Medicare, Blue Cross, Aetna, Humana", languages: "English, Spanish, Portuguese" },
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
        <div style={{ fontSize: 11, color: selected ? "#aaa" : "#888", fontWeight: 500, marginBottom: 4 }}>{doctor.role}</div>
        {doctor.rating != null && (
          <div style={{ marginBottom: 2 }}>
            <StarRating rating={doctor.rating} count={doctor.userRatingCount} size={11} color={selected ? "#ccc" : "#666"} />
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

async function fetchDoctorsDefault() {
  const res = await fetch("/api/doctors");
  if (!res.ok) return DEFAULT_DOCTORS;
  const data = await res.json();
  return data.doctors || DEFAULT_DOCTORS;
}

export default function DoctorModal({ onClose }) {
  const [doctors, setDoctors] = useState(DEFAULT_DOCTORS);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(DEFAULT_DOCTORS[0]);
  const [detailDoctor, setDetailDoctor] = useState(null);
  const [viewMode, setViewMode] = useState("detail"); // "detail" | "map"
  const [mapSrc, setMapSrc] = useState(() => getEmbedUrl(DEFAULT_DOCTORS[0].address));
  const [userLocation, setUserLocation] = useState(null);
  const [sortedDoctors, setSortedDoctors] = useState(DEFAULT_DOCTORS);
  const [zipInput, setZipInput] = useState("");
  const [locStatus, setLocStatus] = useState("");
  const [sortBy, setSortBy] = useState("rating_high"); // "distance" | "rating_high" | "rating_low" | "reviews"
  const zipRef = useRef(null);
  const initialFetch = useRef(false);

  if (!initialFetch.current && typeof window !== "undefined") {
    initialFetch.current = true;
    fetchDoctorsDefault().then((list) => {
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
          setLocStatus("Could not load doctors");
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
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 28px",
          borderBottom: "1px solid #1e2d45",
          background: "#0d1526",
          position: "relative",
        }}>
          <div style={{ position: "absolute", right: 32, top: -12, fontFamily: "'Bebas Neue'", fontSize: 140, color: "rgba(255,255,255,0.03)", lineHeight: 1, userSelect: "none" }}>
            IRIS
          </div>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00c4d4" strokeWidth="1.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
              <span style={{ fontFamily: "'Bebas Neue'", fontSize: 20, letterSpacing: 4, color: "#f5f2ee" }}>IRIS</span>
              <span style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>DOCTOR FINDER</span>
            </div>
            <div style={{ fontFamily: "'Instrument Serif'", fontSize: 26, color: "#f5f2ee", lineHeight: 1.2 }}>
              Find an eye doctor near you
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            style={{
              position: "relative",
              zIndex: 1,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 999,
              padding: "6px 14px",
              color: "#f5f2ee",
              fontSize: 12,
              fontFamily: "'DM Mono'",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>Close</span>
            <span style={{ fontSize: 16 }}>×</span>
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
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 9,
                    border: "1px solid #ccc",
                    fontSize: 13,
                    outline: "none",
                    background: "#ffffff",
                    color: "#111111",
                  }}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  type="submit"
                  style={{ padding: "8px 14px", background: "#444", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Go
                </motion.button>
              </form>
              {(loading || locStatus) && (
                <div style={{ fontSize: 11, color: locStatus.includes("denied") || locStatus.includes("not found") || locStatus.includes("Could not") ? "#e55" : "#555", paddingLeft: 2 }}>
                  {loading || locStatus.includes("Detecting") || locStatus.includes("Searching") ? "⏳ " : userLocation ? "✓ " : "⚠ "}
                  {loading ? "Loading doctors…" : locStatus}
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 4 }}>
                <p style={{ margin: 0, fontSize: 10, color: "#999", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {currentList.length} Specialists
                </p>
                <label style={{ fontSize: 11, color: "#777", marginBottom: 2 }}>
                  Sort doctors
                </label>
                <select
                  value={sortBy}
                  onChange={handleSortChange}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    fontSize: 12,
                    background: "#ffffff",
                    color: "#111111",
                    cursor: "pointer",
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
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "#111",
                  color: "#fff",
                }}
              >
                {viewMode === "map" || !detailDoctor ? "Get detail" : "Get direction"}
              </motion.button>
            </div>

            <AnimatePresence>
              {viewMode === "detail" && detailDoctor && (
                <DoctorDetailCard
                  doctor={detailDoctor}
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
