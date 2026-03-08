"use client";
import { useState, useEffect, useLayoutEffect } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');`;
import { motion, AnimatePresence } from "framer-motion";
import Starsfield from "./Starsfield.js";
import PanelOverlay from "./PanelOverlay.jsx";
import LoginPanelOverlay from "./LoginPanelOverlay.jsx";
import SignupPanelOverlay from "./SignupPanelOverlay.jsx";
import DoctorModal from "./DoctorModal.jsx";

const logo = "/logo.png";
const utd = "/utd.png";

const featureCards = [
  {
    title: "Eye Disease Detect",
    image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&auto=format&fit=crop",
  },
  {
    title: "Eye Screening",
    image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&auto=format&fit=crop",
  },
  {
    title: "Report",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop",
  },
  {
    title: "Doctor Find",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=800&auto=format&fit=crop",
  },
];

function FeatureCard({ card, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        width: 300,
        height: 400,
        borderRadius: 32,
        overflow: "hidden",
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <motion.div
        animate={{ scale: hovered ? 1.06 : 1 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${card.image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: 28,
          right: 28,
        }}
      >
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          {card.title}
        </div>
        <motion.div
          animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 6 }}
          transition={{ duration: 0.25 }}
          style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 6, fontWeight: 500 }}
        >
          Tap to explore →
        </motion.div>
      </div>
    </motion.div>
  );
}

function TypingHero({ onAnimationComplete }) {
  const word = "IRIS";
  const [count, setCount] = useState(0);
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    if (count < word.length) {
      const t = setTimeout(() => setCount(c => c + 1), 210);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => onAnimationComplete?.(), 950);
      return () => clearTimeout(t);
    }
  }, [count, onAnimationComplete]);

  useEffect(() => {
    const t = setInterval(() => setCursor(c => !c), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(80px, 18vw, 160px)", color: "rgba(255,255,255,0.88)", letterSpacing: "0.22em" }}>
      {word.slice(0, count).split("").map((ch, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {ch}
        </motion.span>
      ))}
      <span style={{
        display: "inline-block",
        width: "0.055em",
        height: "0.72em",
        background: "rgba(255,255,255,0.75)",
        marginLeft: "0.06em",
        borderRadius: 2,
        verticalAlign: "middle",
        opacity: cursor ? 1 : 0,
        transition: "opacity 0.08s",
      }} />
    </div>
  );
}

export default function App() {
  const [clicked, setClicked] = useState(false);
  const [activePanelIndex, setActivePanelIndex] = useState(null);
  const [originRect, setOriginRect] = useState(null);
  const [loginPanelOpen, setLoginPanelOpen] = useState(false);
  const [signupPanelOpen, setSignupPanelOpen] = useState(false);
  const [loginOriginRect, setLoginOriginRect] = useState(null);
  const [signupOriginRect, setSignupOriginRect] = useState(null);
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isUserOpen, setIsUserOpen] = useState(false);

  // Run synchronously before first paint so the hero never flashes
  useLayoutEffect(() => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      const storedUser = sessionStorage.getItem("user");
      if (storedUser) setUser(JSON.parse(storedUser));

      // Skip intro animation on back-navigation
      if (sessionStorage.getItem("irisIntroSeen")) {
        setClicked(true);
      }

      // Open doctor modal if requested from another page
      if (sessionStorage.getItem("irisOpenDoctor")) {
        sessionStorage.removeItem("irisOpenDoctor");
        setDoctorModalOpen(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleHeroClick = () => {
    sessionStorage.setItem("irisIntroSeen", "1");
    setClicked(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setIsUserOpen(false);
  };

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : null;

  return (
    <div style={{ background: "#000", overflowX: "hidden" }}>
      <style>{FONTS}</style>
      {/* Top Navigation Bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          padding: "14px 36px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(8,14,26,0.72)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(0,196,212,0.15)", border: "1px solid rgba(0,196,212,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00c4d4" strokeWidth="1.5">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 5, color: "#ffffff", lineHeight: 1 }}>IRIS</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 2, lineHeight: 1, marginTop: 2 }}>EYE HEALTH PLATFORM</div>
          </div>
        </div>

        {/* Right side */}
        {user ? (
          <div style={{ position: "relative" }}>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setIsUserOpen(!isUserOpen)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 10, padding: "7px 14px",
                color: "#fff", cursor: "pointer",
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "linear-gradient(135deg, #00c4d4, #0090a0)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, color: "#fff",
              }}>
                {initials}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1 }}>{user.firstName}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginTop: 2 }}>LOGGED IN</div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </motion.button>

            {isUserOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                background: "#0d1526",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14, overflow: "hidden", minWidth: 220,
                boxShadow: "0 20px 48px rgba(0,0,0,0.5)",
              }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", color: "#fff", fontSize: 13, fontWeight: 600 }}>
                    {user.firstName} {user.lastName}
                  </p>
                  <p style={{ margin: 0, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 4, letterSpacing: 0.5 }}>{user.email}</p>
                </div>
                <motion.button
                  whileHover={{ background: "rgba(255,255,255,0.05)" }}
                  onClick={handleLogout}
                  style={{
                    width: "100%", padding: "12px 18px",
                    background: "none", border: "none",
                    color: "#ff6b6b",
                    fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: 1,
                    cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  LOG OUT
                </motion.button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={(e) => {
                setSignupPanelOpen(false);
                setLoginOriginRect(e.currentTarget.getBoundingClientRect());
                setLoginPanelOpen(true);
              }}
              style={{
                padding: "8px 20px",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 9,
                color: "rgba(255,255,255,0.85)",
                fontFamily: "'DM Mono', monospace",
                fontSize: 11, letterSpacing: 1,
                cursor: "pointer",
              }}
            >
              LOG IN
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={(e) => {
                setLoginPanelOpen(false);
                setSignupOriginRect(e.currentTarget.getBoundingClientRect());
                setSignupPanelOpen(true);
              }}
              style={{
                padding: "8px 20px",
                background: "linear-gradient(135deg, #00c4d4, #0090a0)",
                border: "none",
                borderRadius: 9,
                color: "#fff",
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 16, letterSpacing: 2,
                cursor: "pointer",
              }}
            >
              SIGN UP
            </motion.button>
          </div>
        )}
      </div>
      <AnimatePresence>
        {!clicked && (
          <motion.div
            key="hero"
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            style={{ position: "fixed", inset: 0, zIndex: 50 }}
          >
            <Starsfield
              starCount={150}
              speed={0.2}
              trail={0.3}
              twinkle={0.3}
              starSize={3}
              bgColor="#000000"
              starColor="#ffffff"
              starImage={logo}
              preserveImageColors
            />
            <div style={{ position: "absolute", inset: 0 }}>
              <Starsfield
                starCount={150}
                speed={0.2}
                trail={0.3}
                twinkle={0.3}
                starSize={3}
                bgColor="rgba(0,0,0,0)"
                starColor="#ffffff"
                starImage={utd}
                preserveImageColors
              />
            </div>

            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                gap: 32,
              }}
            >
              <motion.div
                animate={clicked ? { scale: 2.5, opacity: 0 } : { scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                onClick={handleHeroClick}
                style={{ cursor: "pointer" }}
              />

              <AnimatePresence>
                {!clicked && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    style={{ pointerEvents: "none" }}
                  >
                    <TypingHero onAnimationComplete={handleHeroClick} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {!clicked && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4, y: [0, 8, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 1.5, duration: 1.5, repeat: Infinity }}
                  style={{
                    position: "absolute",
                    bottom: 32,
                    left: "50%",
                    transform: "translateX(-50%)",
                    color: "#fff",
                    fontSize: 22,
                    zIndex: 10,
                  }}
                >
                  ↓
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Description Section */}
      <div
        style={{
          width: "100vw",
          minHeight: "100vh",
          background: "#f0f5fb",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 24px",
          gap: 72,
        }}
      >
        {/* Slogan */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={{ maxWidth: 760, textAlign: "center" }}
        >
          <p style={{ fontFamily: "'DM Mono', monospace", color: "#8098b8", fontSize: 11, letterSpacing: "0.25em", marginBottom: 24, textTransform: "uppercase" }}>
            Our Mission
          </p>
          <h2
            style={{
              fontFamily: "'Instrument Serif', serif",
              color: "#0d1b2e",
              fontSize: "clamp(28px, 5vw, 58px)",
              fontWeight: 400,
              lineHeight: 1.2,
              fontStyle: "italic",
            }}
          >
            "The eyes are the windows of the soul."
          </h2>
        </motion.div>

        {/* Three feature cards */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            {
              accent: "#00c4d4",
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00c4d4" strokeWidth="1.6">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  <path d="M11 8v6M8 11h6"/>
                </svg>
              ),
              label: "Eye Disease Detection",
              desc: "AI-powered analysis of eye images to identify potential conditions early.",
            },
            {
              accent: "#60c8f5",
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60c8f5" strokeWidth="1.6">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              ),
              label: "Eye Screening",
              desc: "Comprehensive vision tests including acuity, astigmatism and gaze tracking.",
            },
            {
              accent: "#a78bfa",
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.6">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              ),
              label: "Iris — AI Assistant",
              desc: "A personalized AI companion that explains your results and guides your eye health.",
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.12 }}
              style={{
                width: 230,
                background: "#fff",
                border: "1px solid #ccd8ee",
                borderRadius: 20,
                padding: "28px 24px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                boxShadow: "0 2px 16px rgba(13,27,46,0.06)",
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${item.accent}15`, border: `1px solid ${item.accent}35`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {item.icon}
              </div>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: "#0d1b2e", fontSize: 18, letterSpacing: 2, margin: 0 }}>
                {item.label}
              </p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#4a6280", fontSize: 13, margin: 0, lineHeight: 1.65 }}>
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Feature Cards */}
      <div
        style={{
          width: "100vw",
          background: "#f0f5fb",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "80px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {featureCards.map((card, i) => (
            <FeatureCard
              key={i}
              card={card}
              onClick={(e) => {
                if (i === 3) {
                  setDoctorModalOpen(true);
                  return;
                }
                setOriginRect(e.currentTarget.getBoundingClientRect());
                setActivePanelIndex(i);
              }}
            />
          ))}
        </div>
      </div>

      {/* Doctor finder modal on top of home */}
      <AnimatePresence>
        {doctorModalOpen && (
          <DoctorModal onClose={() => setDoctorModalOpen(false)} />
        )}
      </AnimatePresence>

      {/* Panel Overlay */}
      <AnimatePresence>
        {activePanelIndex !== null && (
          <PanelOverlay
            key={activePanelIndex}
            panelIndex={activePanelIndex}
            originRect={originRect}
            onClose={() => setActivePanelIndex(null)}
          />
        )}
      </AnimatePresence>

      {/* Message dropdown */}
      <AnimatePresence>
      </AnimatePresence>

      {/* Fixed social menu is in the global layout */}

      {/* Footer */}
      <div
        style={{
          padding: "24px 40px",
          background: "#f0f5fb",
          borderTop: "1px solid #ccd8ee",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#8098b8", lineHeight: 1.7, display: "flex", gap: 8, alignItems: "flex-start", margin: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8098b8" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          This platform provides AI-generated estimates only and does not constitute medical advice. Always consult a qualified eye care professional.
        </p>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#8098b8", letterSpacing: "0.1em" }}>HACKAI © 2026</div>
      </div>

      {/* Auth Panels */}
      <AnimatePresence>
        {loginPanelOpen && (
          <LoginPanelOverlay
            originRect={loginOriginRect}
            onClose={() => setLoginPanelOpen(false)}
            onSwitchToSignup={() => {
              setLoginPanelOpen(false);
              setSignupOriginRect(loginOriginRect || { top: "50%", left: "50%", width: 0, height: 0 });
              setSignupPanelOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {signupPanelOpen && (
          <SignupPanelOverlay
            originRect={signupOriginRect}
            onClose={() => setSignupPanelOpen(false)}
            onSwitchToLogin={() => {
              setSignupPanelOpen(false);
              setLoginOriginRect(signupOriginRect || { top: "50%", left: "50%", width: 0, height: 0 });
              setLoginPanelOpen(true);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
