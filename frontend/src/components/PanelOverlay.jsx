"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DoctorModal from "./DoctorModal.jsx";
import EyeDiseaseClassifierPanel from "./EyeDiseaseClassifierPanel.jsx";

const panels = [
  { title: "Eye Disease Detect" },
  { title: "Eyes Exam" },
  { title: "Report" },
  { title: "Doctor Find" },
];

// ── Shared button ─────────────────────────────────────────────────────────────
function ActionButton({ children, onClick, style = {} }) {
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        padding: "14px 36px", background: "#fff", color: "#000",
        border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700,
        cursor: "pointer", ...style,
      }}
    >
      {children}
    </motion.button>
  );
}

// ── Iris TTS helper ───────────────────────────────────────────────────────────
async function speakIris(text) {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const buf = await res.arrayBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch { /* silently ignore TTS errors */ }
}

// ── 1: Eyes Exam ──────────────────────────────────────────────────────────────
function EyesExamPanel() {
  const [consented, setConsented] = useState(null); // null=deciding, true=allowed, false=skipped
  const [introPlaying, setIntroPlaying] = useState(false);

  const steps = [
    { icon:"🖥️", label:"Calibrate display" },
    { icon:"🤚", label:"Cover one eye" },
    { icon:"〰️", label:"Axis search (~6 trials)" },
    { icon:"🔬", label:"Resolution staircase" },
    { icon:"↔️", label:"Far-point walk-back" },
    { icon:"📊", label:"Refraction estimate" },
  ];

  const handleAllow = async () => {
    localStorage.setItem("irisGuidanceEnabled", "true");
    setConsented(true);
    setIntroPlaying(true);
    await speakIris(
      "Hi, I'm Iris! I'll guide you through your astigmatism screening step by step. " +
      "This test takes about one minute per eye and uses your webcam. " +
      "You'll need a quiet, well-lit space. " +
      "When you're ready, click Start Exam and I'll walk you through each phase."
    );
    setIntroPlaying(false);
  };

  const handleSkip = () => {
    localStorage.setItem("irisGuidanceEnabled", "false");
    setConsented(false);
  };

  // Consent modal
  if (consented === null) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        height:"100%", gap:0, padding:"0 40px", textAlign:"center" }}>

        {/* Iris avatar */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ width:96, height:96, borderRadius:"50%",
            background:"rgba(0,196,212,0.12)", border:"2px solid rgba(0,196,212,0.4)",
            display:"flex", alignItems:"center", justifyContent:"center", marginBottom:28 }}
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#00c4d4" strokeWidth="1.4">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </motion.div>

        <motion.h2
          initial={{ opacity:0, y:12 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.15, duration:0.4 }}
          style={{ color:"#fff", fontSize:"clamp(22px,3vw,38px)", fontWeight:700, margin:"0 0 12px" }}
        >
          Would you like Iris to guide you?
        </motion.h2>

        <motion.p
          initial={{ opacity:0, y:10 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.25, duration:0.4 }}
          style={{ color:"#aaa", fontSize:"clamp(13px,1.6vw,17px)", lineHeight:1.7,
            maxWidth:480, margin:"0 0 36px" }}
        >
          Iris can narrate each step of your eye screening — explaining what you'll see
          and what to do — so you always know exactly what's happening.
        </motion.p>

        <motion.div
          initial={{ opacity:0, y:10 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.35, duration:0.4 }}
          style={{ display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center" }}
        >
          <motion.button
            whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
            onClick={handleAllow}
            style={{ padding:"14px 36px", background:"linear-gradient(135deg,#00c4d4,#0090a0)",
              color:"#fff", border:"none", borderRadius:14, fontSize:16, fontWeight:700,
              cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 010 7.07"/>
              <path d="M19.07 4.93a10 10 0 010 14.14"/>
            </svg>
            Allow Iris to Guide Me
          </motion.button>

          <motion.button
            whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
            onClick={handleSkip}
            style={{ padding:"14px 36px", background:"rgba(255,255,255,0.07)",
              color:"#888", border:"1px solid rgba(255,255,255,0.12)",
              borderRadius:14, fontSize:15, fontWeight:600, cursor:"pointer" }}
          >
            Skip, just start
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Main panel — shown after consent decision
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      height:"100%", gap:28, padding:"0 40px", textAlign:"center" }}>

      {/* Iris intro playing indicator */}
      <AnimatePresence>
        {introPlaying && (
          <motion.div
            initial={{ opacity:0, y:-10 }}
            animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-10 }}
            style={{ position:"absolute", top:80, left:"50%", transform:"translateX(-50%)",
              background:"rgba(0,196,212,0.12)", border:"1px solid rgba(0,196,212,0.3)",
              borderRadius:12, padding:"10px 20px", display:"flex", alignItems:"center", gap:10 }}
          >
            <motion.div
              animate={{ scale:[1,1.3,1] }}
              transition={{ repeat:Infinity, duration:0.8 }}
              style={{ width:8, height:8, borderRadius:"50%", background:"#00c4d4" }}
            />
            <span style={{ color:"#00c4d4", fontSize:13, fontWeight:600 }}>Iris is speaking…</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ fontSize:72 }}>🔬</div>
      <h2 style={{ color:"#fff", fontSize:"clamp(28px,4vw,52px)", fontWeight:700, margin:0 }}>
        Astigmatism Screening
      </h2>
      <p style={{ color:"#aaa", fontSize:"clamp(14px,1.8vw,18px)", lineHeight:1.7, maxWidth:560, margin:0 }}>
        A fully automated psychophysical exam using your webcam. Measures axis, spatial
        frequency resolution, and far-point distance to estimate your prescription.
      </p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6,
            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:10, padding:"8px 16px", fontSize:13, color:"#ccc" }}>
            <span>{s.icon}</span><span>{s.label}</span>
          </div>
        ))}
      </div>
      <ActionButton onClick={() => { window.location.href = '/astig'; }}>
        Start Exam →
      </ActionButton>
      <p style={{ color:"#555", fontSize:12, maxWidth:400, margin:0 }}>
        Takes ~1 minute per eye · No special equipment · Webcam required
      </p>
    </div>
  );
}

// ── 2: Report ─────────────────────────────────────────────────────────────────
function ReportPanel() {
  const [exams, setExams]     = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) { setError("Please log in to view your reports."); setLoading(false); return; }
    fetch(`/api/get-exams?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setExams(d.exams);
        else setError(d.error || "Failed to load.");
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#555" }}>
      Loading reports…
    </div>
  );

  if (error) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      height:"100%", gap:16, color:"#aaa", textAlign:"center", padding:"0 40px" }}>
      <div style={{ fontSize:48 }}>📋</div>
      <p>{error}</p>
      {error.includes("log in") && (
        <ActionButton onClick={() => window.location.href = "/"}>
          Go to Login
        </ActionButton>
      )}
    </div>
  );

  if (!exams.length) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      height:"100%", gap:20, color:"#aaa", textAlign:"center", padding:"0 40px" }}>
      <div style={{ fontSize:64 }}>📋</div>
      <h2 style={{ color:"#fff", fontSize:28, fontWeight:700, margin:0 }}>No exams yet</h2>
      <p>Complete your first screening to see results here.</p>
      <ActionButton onClick={() => { window.location.href = "/astig"; }}>
        Take Exam Now →
      </ActionButton>
    </div>
  );

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"24px 32px" }}>
      <div style={{ maxWidth:860, margin:"0 auto" }}>
        <h2 style={{ color:"#fff", fontSize:22, fontWeight:700, marginBottom:20 }}>Your Exam History</h2>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {exams.map(exam => <ExamCard key={exam._id} exam={exam} />)}
        </div>
      </div>
    </div>
  );
}

function ExamCard({ exam }) {
  const [open, setOpen] = useState(false);
  const date = new Date(exam.createdAt).toLocaleDateString("en-US", {
    year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit",
  });
  const eye  = exam.testedEye ? exam.testedEye.charAt(0).toUpperCase() + exam.testedEye.slice(1) : "—";
  const ref  = exam.refraction;
  const q    = exam.quality ?? "—";
  const qColor = q >= 80 ? "#00FF88" : q >= 60 ? "#FFD700" : "#FF4444";

  return (
    <motion.div
      layout
      style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)",
        borderRadius:14, overflow:"hidden", cursor:"pointer" }}
      onClick={() => setOpen(o => !o)}
    >
      {/* Summary row */}
      <div style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 20px", flexWrap:"wrap" }}>
        <span style={{ fontSize:22 }}>👁</span>
        <div style={{ flex:1 }}>
          <div style={{ color:"#fff", fontWeight:700, fontSize:14 }}>{eye} Eye — {date}</div>
          <div style={{ color:"#666", fontSize:12, marginTop:2 }}>
            Axis {exam.axis ?? "?"}° · MDSF {exam.mdsf1?.toFixed(1)} / {exam.mdsf2?.toFixed(1)} CPD
          </div>
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <span style={{ color: qColor, fontWeight:700, fontSize:13 }}>Quality {q}%</span>
          {ref && (
            <span style={{ background:"rgba(0,255,136,0.1)", border:"1px solid rgba(0,255,136,0.3)",
              borderRadius:8, padding:"4px 10px", fontSize:12, color:"#00FF88", fontWeight:600 }}>
              SPH {ref.sph}D / CYL {ref.cyl}D
            </span>
          )}
          <span style={{ color:"#444", fontSize:16 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height:0, opacity:0 }}
            animate={{ height:"auto", opacity:1 }}
            exit={{ height:0, opacity:0 }}
            transition={{ duration:0.25 }}
            style={{ overflow:"hidden" }}
          >
            <div style={{ padding:"0 20px 16px", display:"flex", gap:16, flexWrap:"wrap" }}>
              {[
                ["Axis", `${exam.axis ?? "?"}°`],
                ["MDSF 1", `${exam.mdsf1?.toFixed(2)} CPD`],
                ["MDSF 2", `${exam.mdsf2?.toFixed(2)} CPD`],
                ["Snellen 1", `20/${exam.sn1}`],
                ["Snellen 2", `20/${exam.sn2}`],
                ["Far-Point 1", exam.fp1Mm ? `${(exam.fp1Mm/10).toFixed(1)} cm` : "skipped"],
                ["Far-Point 2", exam.fp2Mm ? `${(exam.fp2Mm/10).toFixed(1)} cm` : "skipped"],
                ref && ["SPH", `${ref.sph} D`],
                ref && ["CYL", `${ref.cyl} D`],
                ref && ["AXIS", `${ref.axis}°`],
              ].filter(Boolean).map(([label, val]) => (
                <div key={label} style={{ background:"rgba(255,255,255,0.05)", borderRadius:8,
                  padding:"8px 14px", minWidth:100 }}>
                  <div style={{ color:"#555", fontSize:10, letterSpacing:"0.1em", marginBottom:2 }}>{label}</div>
                  <div style={{ color:"#fff", fontWeight:700, fontSize:14 }}>{val}</div>
                </div>
              ))}
              {ref?.note && (
                <div style={{ width:"100%", color:"#FFD700", fontSize:12, marginTop:4 }}>{ref.note}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────
export default function PanelOverlay({ panelIndex, originRect, onClose }) {
  if (panelIndex === 3) {
    return <DoctorModal onClose={onClose} />;
  }

  const from = originRect
    ? { top: originRect.top, left: originRect.left, width: originRect.width, height: originRect.height, borderRadius: 32 }
    : { top: "50%", left: "50%", width: 0, height: 0, borderRadius: 32 };

  const content = {
    0: <EyeDiseaseClassifierPanel onBack={onClose} />,
    1: <EyesExamPanel />,
    2: <ReportPanel />,
  };

  return (
    <motion.div
      key={panelIndex}
      initial={{ ...from, opacity: 0.6 }}
      animate={{ top: 0, left: 0, width: "100vw", height: "100vh", borderRadius: 0, opacity: 1 }}
      exit={{ ...from, opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
      style={{ position:"fixed", zIndex:150, background:"#0a0a0a",
        display:"flex", flexDirection:"column", overflow:"hidden" }}
    >
      {/* Header — hidden for panel 0 since EyeDiseaseClassifierPanel has its own back button */}
      {panelIndex !== 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 24px",
            borderBottom:"1px solid rgba(255,255,255,0.08)", flexShrink:0,
            background:"rgba(0,0,0,0.6)", backdropFilter:"blur(12px)" }}
        >
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={onClose}
            style={{ display:"flex", alignItems:"center", gap:8,
              background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)",
              borderRadius:10, padding:"8px 16px", color:"#fff",
              fontSize:13, fontWeight:600, cursor:"pointer" }}
          >
            ← Home
          </motion.button>
          <span style={{ color:"#666", fontSize:13 }}>{panels[panelIndex]?.title}</span>
        </motion.div>
      )}

      <div style={{ flex:1, overflow:"hidden" }}>
        {content[panelIndex]}
      </div>
    </motion.div>
  );
}
