"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DoctorModal from "./DoctorModal.jsx";

const panels = [
  { title: "Eye Disease Detect" },
  { title: "Eyes Exam" },
  { title: "Report" },
  { title: "Find Clinic" },
];

function PlaceholderContent({ title, desc, icon }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 24, padding: "0 40px", textAlign: "center" }}>
      <div style={{ fontSize: 72 }}>{icon}</div>
      <h2 style={{ color: "#fff", fontSize: "clamp(28px, 4vw, 56px)", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>{title}</h2>
      <p style={{ color: "#aaa", fontSize: "clamp(15px, 2vw, 20px)", lineHeight: 1.7, maxWidth: 560, margin: 0 }}>{desc}</p>
      <motion.button
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
        style={{ marginTop: 8, padding: "14px 36px", background: "#fff", color: "#000", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer" }}
      >
        Get Started
      </motion.button>
    </div>
  );
}

const panelContent = {
  0: <PlaceholderContent title="Eye Disease Detect" desc="AI-powered detection of retinal conditions, cataracts, glaucoma and more from fundus images." icon="👁️" />,
  1: <PlaceholderContent title="Eyes Exam" desc="Comprehensive virtual eye exam powered by computer vision. Check visual acuity, colour blindness and more." icon="🔬" />,
  2: <PlaceholderContent title="Report" desc="View your full diagnostic history, export PDF reports and share results directly with your doctor." icon="📋" />,
};

export default function PanelOverlay({ panelIndex, originRect, onClose }) {
  const [doctorOpen, setDoctorOpen] = useState(false);

  const from = originRect
    ? { top: originRect.top, left: originRect.left, width: originRect.width, height: originRect.height, borderRadius: 32 }
    : { top: "50%", left: "50%", width: 0, height: 0, borderRadius: 32 };

  return (
    <>
      <motion.div
        key={panelIndex}
        initial={{ ...from, opacity: 0.6 }}
        animate={{ top: 0, left: 0, width: "100vw", height: "100vh", borderRadius: 0, opacity: 1 }}
        exit={{ ...from, opacity: 0 }}
        transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
        style={{
          position: "fixed",
          zIndex: 150,
          background: "#0a0a0a",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "14px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(12px)",
          }}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10, padding: "8px 16px", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            ← Home
          </motion.button>
          <span style={{ color: "#666", fontSize: 13 }}>{panels[panelIndex]?.title}</span>
        </motion.div>

        <div style={{ flex: 1, overflow: "hidden" }}>
          {panelIndex === 3 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                onClick={() => setDoctorOpen(true)}
                style={{ padding: "14px 36px", background: "#fff", color: "#000", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer" }}
              >
                Open Clinic Finder
              </motion.button>
            </div>
          ) : panelContent[panelIndex]}
        </div>
      </motion.div>

      <AnimatePresence>
        {doctorOpen && <DoctorModal onClose={() => setDoctorOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
