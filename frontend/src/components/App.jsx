"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PanelOverlay from "./PanelOverlay.jsx";
import DoctorModal from "./DoctorModal.jsx";
import LoginPanelOverlay from "./LoginPanelOverlay.jsx";
import SignupPanelOverlay from "./SignupPanelOverlay.jsx";

const C = {
  cream: "#f5f2ee",
  ink: "#1a1410",
  inkDim: "#6b5f52",
  brand: "#00c4d4",
};

const featureCards = [
  { title: "Eye Disease Detect", image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&auto=format&fit=crop" },
  { title: "Eyes Exam", image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&auto=format&fit=crop" },
  { title: "Report", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop" },
  { title: "Find Clinic", image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=800&auto=format&fit=crop" },
];

function FeatureCard({ card, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{ scale: hovered ? 1.02 : 1, boxShadow: hovered ? "0 12px 32px rgba(13,27,46,0.12)" : "0 2px 8px rgba(13,27,46,0.06)" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{
        width: 260,
        minHeight: 320,
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        flexShrink: 0,
        background: "#ffffff",
        border: "1px solid #ccd8ee",
      }}
    >
      <div
        style={{
          height: 180,
          backgroundImage: `url(${card.image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div style={{ padding: 24 }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 2, color: "#0d1b2e", lineHeight: 1.2 }}>
          {card.title}
        </div>
        <div style={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#4a6280", marginTop: 8, letterSpacing: 1 }}>
          Tap to explore →
        </div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [activePanelIndex, setActivePanelIndex] = useState(null);
  const [originRect, setOriginRect] = useState(null);
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [loginPanelOpen, setLoginPanelOpen] = useState(false);
  const [signupPanelOpen, setSignupPanelOpen] = useState(false);
  const [loginOriginRect, setLoginOriginRect] = useState(null);
  const [signupOriginRect, setSignupOriginRect] = useState(null);
  const [user, setUser] = useState(null);
  const [isUserOpen, setIsUserOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setIsUserOpen(false);
  };

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f0f5fb; font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.5s ease both; }
        .report-header { padding: 28px 60px; }
        .report-body { padding: 48px 60px; max-width: 860px; margin: 0 auto; }
        .report-footer { padding: 36px 60px; }
        @media (max-width: 900px) {
          .report-header { padding: 20px 24px; }
          .report-body { padding: 28px 20px; }
          .report-footer { padding: 28px 24px; }
        }
      `}</style>

      <div style={{ background: "#f0f5fb", minHeight: "100vh", color: "#0d1b2e", overflowX: "hidden" }}>

        {/* Header — matches disease report */}
        <div className="fade-up report-header" style={{ background: "#0d1526", borderBottom: "1px solid #1e2d45", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: 40, top: -10, fontFamily: "'Bebas Neue'", fontSize: 200, color: "rgba(255,255,255,0.03)", lineHeight: 1, userSelect: "none" }}>IRIS</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="1.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
                <span style={{ fontFamily: "'Bebas Neue'", fontSize: 20, letterSpacing: 4, color: C.cream }}>IRIS</span>
                <span style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>EYE HEALTH PLATFORM</span>
              </div>
              <div style={{ fontFamily: "'Instrument Serif'", fontSize: 32, color: C.cream, lineHeight: 1.1 }}>Welcome</div>
              <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
                Your eye health companion
              </div>
            </div>
            {user ? (
              <div style={{ position: "relative" }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsUserOpen(!isUserOpen)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 12, padding: "10px 16px", color: C.cream, cursor: "pointer",
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono'", fontSize: 11 }}>
                    {initials}
                  </div>
                  <span style={{ fontFamily: "'DM Sans'", fontSize: 13 }}>{user.firstName}</span>
                </motion.button>
                {isUserOpen && (
                  <div style={{
                    position: "absolute", top: "100%", right: 0, marginTop: 8,
                    background: "#1e2d45", border: "1px solid #2d3f5c", borderRadius: 12,
                    overflow: "hidden", minWidth: 200, zIndex: 100,
                  }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid #2d3f5c" }}>
                      <p style={{ margin: 0, color: C.cream, fontFamily: "'DM Sans'", fontSize: 13 }}>{user.firstName} {user.lastName}</p>
                      <p style={{ margin: 0, color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>{user.email}</p>
                    </div>
                    <button onClick={handleLogout} style={{
                      width: "100%", padding: "12px 16px", background: "none", border: "none",
                      color: "#e07a7a", fontFamily: "'DM Mono'", fontSize: 12, cursor: "pointer", textAlign: "left",
                    }}>Logout</button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 12 }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={(e) => {
                    setSignupPanelOpen(false);
                    setLoginOriginRect(e.currentTarget.getBoundingClientRect());
                    setLoginPanelOpen(true);
                  }}
                  style={{
                    padding: "10px 20px", background: "transparent", border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: 12, color: C.cream, fontFamily: "'DM Mono'", fontSize: 12, cursor: "pointer",
                  }}
                >
                  Login
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={(e) => {
                    setLoginPanelOpen(false);
                    setSignupOriginRect(e.currentTarget.getBoundingClientRect());
                    setSignupPanelOpen(true);
                  }}
                  style={{
                    padding: "10px 20px", borderRadius: 12, border: "none", cursor: "pointer",
                    background: `linear-gradient(135deg, ${C.brand}, #0090a0)`,
                    color: "#fff", fontFamily: "'Bebas Neue'", fontSize: 16, letterSpacing: 2,
                  }}
                >
                  Sign Up
                </motion.button>
              </div>
            )}
          </div>
        </div>

        {/* Hero / Description */}
        <div className="report-body" style={{ paddingTop: 48, paddingBottom: 32 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            style={{ background: "#ffffff", borderRadius: 16, padding: 32, border: "1px solid #ccd8ee", boxShadow: "0 1px 4px rgba(13,27,46,0.05)", marginBottom: 40 }}
          >
            <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#4a6280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>About Iris</div>
            <div style={{ fontFamily: "'Instrument Serif'", fontSize: 24, color: "#0d1b2e", lineHeight: 1.4, marginBottom: 16 }}>
              Your AI-powered eye health companion
            </div>
            <p style={{ fontSize: 14, color: "#4a6280", lineHeight: 1.7 }}>
              Iris helps you understand eye symptoms, screen for common conditions, and connect with eye care professionals. Explore disease detection, virtual exams, reports, and find doctors near you.
            </p>
          </motion.div>

          {/* Feature Cards */}
          <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#4a6280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 20 }}>Explore</div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
            {featureCards.map((card, i) => (
              <FeatureCard
                key={i}
                card={card}
                onClick={(e) => {
                  if (i === 3) {
                    setDoctorModalOpen(true);
                  } else {
                    setOriginRect(e.currentTarget.getBoundingClientRect());
                    setActivePanelIndex(i);
                  }
                }}
              />
            ))}
          </div>
        </div>

        {/* Footer — matches disease report */}
        <div className="report-footer" style={{ background: "#ffffff", borderTop: "1px solid #ccd8ee" }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <p style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#8098b8", lineHeight: 1.7, maxWidth: 560 }}>
                Iris is an AI-powered eye health platform. It does not replace professional medical advice. Always consult a qualified eye care professional.
              </p>
              <div style={{ fontFamily: "'DM Mono'", fontSize: 12, color: "#8098b8", letterSpacing: "0.1em" }}>HACKAI © 2026</div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {doctorModalOpen && (
          <DoctorModal onClose={() => setDoctorModalOpen(false)} />
        )}
      </AnimatePresence>

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
    </>
  );
}
