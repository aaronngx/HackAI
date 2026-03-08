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

// ── 2: Report hub ─────────────────────────────────────────────────────────────

const BRAND = "#00c4d4";

function ReportPanel() {
  const [tab, setTab]                   = useState("disease");
  const [diseaseHistory, setDiseaseHistory] = useState(null);
  const [screeningReport, setScreeningReport] = useState(null);
  const [screeningInput, setScreeningInput]   = useState(null);
  const [loading, setLoading]           = useState(true);
  const [loggedIn, setLoggedIn]         = useState(false);

  useEffect(() => {
    const load = async () => {
      const token = sessionStorage.getItem("token");
      setLoggedIn(!!token);

      // Disease detection history (requires auth)
      if (token) {
        try {
          const res = await fetch(`/api/eye-diagnostic/history?t=${Date.now()}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = res.ok ? await res.json() : {};
          setDiseaseHistory(Array.isArray(data.history) ? data.history : []);
        } catch { setDiseaseHistory([]); }
      } else {
        setDiseaseHistory([]);
      }

      // Screening report (localStorage)
      try {
        const rawReport = localStorage.getItem("irisExamReport");
        const rawInput  = localStorage.getItem("irisExamResults");
        if (rawReport) setScreeningReport(JSON.parse(rawReport));
        if (rawInput)  setScreeningInput(JSON.parse(rawInput));
      } catch {}

      setLoading(false);
    };
    load();
  }, []);

  const openDiseaseReport = (item) => {
    const payload = {
      result: String(item.likely_disease || "").toLowerCase() === "normal" ? "normal" : "condition_detected",
      conditionName: item.likely_disease || undefined,
      confidence: parseFloat(item.confidence) || undefined,
      affectedEye: "both",
      imageDate: item.createdAt,
    };
    localStorage.setItem("irisDetectionResults", JSON.stringify(payload));
    sessionStorage.setItem("irisIntroSeen", "1");
    window.location.href = "/report/disease";
  };

  const openScreeningReport = () => {
    sessionStorage.setItem("irisIntroSeen", "1");
    window.location.href = "/report/screening";
  };

  const tabs = [
    { id: "disease",   label: "Disease Detection", color: BRAND },
    { id: "screening", label: "Eye Screening",      color: "#60c8f5" },
  ];

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"32px 36px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>
      <div style={{ maxWidth:860, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:32, letterSpacing:4, color:"#fff", lineHeight:1 }}>Reports</div>
          <div style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"rgba(255,255,255,0.35)", letterSpacing:2, marginTop:4 }}>YOUR IRIS HEALTH HISTORY</div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:8, marginBottom:28 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding:"8px 20px", borderRadius:10, border:"none", cursor:"pointer",
                fontFamily:"'DM Mono', monospace", fontSize:11, letterSpacing:1,
                background: tab === t.id ? t.color : "rgba(255,255,255,0.07)",
                color: tab === t.id ? "#000" : "rgba(255,255,255,0.5)",
                transition:"all 0.18s",
              }}
            >
              {t.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display:"flex", justifyContent:"center", padding:60 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="1.5" style={{ animation:"spin 1.5s linear infinite" }}>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── Disease Detection tab ── */}
        {!loading && tab === "disease" && (
          diseaseHistory.length === 0 ? (
            <EmptyReportState
              icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="1.3"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>}
              title="No disease detection reports"
              desc={loggedIn ? "Upload an eye image to run your first detection." : "Log in to see your detection history."}
              actionLabel={loggedIn ? "Run Detection →" : "Log In"}
              onAction={() => { window.location.href = loggedIn ? "/" : "/"; }}
            />
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {diseaseHistory.map((item, i) => (
                <DiseaseReportCard key={item.id || i} item={item} onClick={() => openDiseaseReport(item)} />
              ))}
            </div>
          )
        )}

        {/* ── Eye Screening tab ── */}
        {!loading && tab === "screening" && (
          !screeningReport ? (
            <EmptyReportState
              icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60c8f5" strokeWidth="1.3"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              title="No screening report yet"
              desc="Complete an eye screening to generate your first screening report."
              actionLabel="Take Exam →"
              onAction={() => { window.location.href = "/astig"; }}
            />
          ) : (
            <ScreeningReportCard report={screeningReport} input={screeningInput} onClick={openScreeningReport} />
          )
        )}

      </div>
    </div>
  );
}

function EmptyReportState({ icon, title, desc, actionLabel, onAction }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", padding:"60px 40px", gap:16 }}>
      <div style={{ width:72, height:72, borderRadius:"50%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {icon}
      </div>
      <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:17, fontWeight:600, color:"rgba(255,255,255,0.7)" }}>{title}</div>
      <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:13, color:"rgba(255,255,255,0.35)", maxWidth:340, lineHeight:1.65 }}>{desc}</div>
      <button
        onClick={onAction}
        style={{ marginTop:8, padding:"10px 24px", background:BRAND, border:"none", borderRadius:10, cursor:"pointer", fontFamily:"'Bebas Neue', sans-serif", fontSize:16, letterSpacing:2, color:"#fff" }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function DiseaseReportCard({ item, onClick }) {
  const date   = new Date(item.createdAt).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" });
  const isNormal = String(item.likely_disease || "").toLowerCase() === "normal";
  const conf   = parseFloat(item.confidence);
  const confPct = Number.isFinite(conf) ? `${Math.round(conf)}%` : item.confidence || "—";
  const statusColor = isNormal ? "#22d46a" : "#f5a623";

  return (
    <motion.div
      whileHover={{ scale:1.012, boxShadow:"0 8px 32px rgba(0,0,0,0.3)" }}
      onClick={onClick}
      style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:16, padding:"20px 24px", cursor:"pointer", display:"flex", alignItems:"center", gap:18, transition:"border-color 0.2s" }}
    >
      <div style={{ width:44, height:44, borderRadius:12, background:`${statusColor}18`, border:`1px solid ${statusColor}40`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="1.5">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:15, fontWeight:600, color:"#fff", marginBottom:4 }}>
          {isNormal ? "No Condition Detected" : (item.likely_disease || "Condition Detected")}
        </div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          <span style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"rgba(255,255,255,0.35)", letterSpacing:0.5 }}>{date}</span>
          {!isNormal && <span style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:statusColor, letterSpacing:0.5 }}>Confidence {confPct}</span>}
        </div>
        {item.visible_findings?.length > 0 && (
          <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
            {item.visible_findings.slice(0,3).map((f, i) => (
              <span key={i} style={{ fontFamily:"'DM Mono', monospace", fontSize:9, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:5, padding:"2px 8px", color:"rgba(255,255,255,0.45)", letterSpacing:0.5 }}>{f}</span>
            ))}
          </div>
        )}
      </div>
      <div style={{ color:"rgba(255,255,255,0.25)", flexShrink:0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </motion.div>
  );
}

function ScreeningReportCard({ report, input, onClick }) {
  const topDiag  = report?.diagnoses?.[0];
  const urgency  = report?.urgency ?? "low";
  const urgColor = urgency === "critical" ? "#ef4444" : urgency === "high" ? "#f5a623" : urgency === "moderate" ? "#facc15" : "#22d46a";
  const date     = input ? "Latest screening" : "Screening report";

  return (
    <motion.div
      whileHover={{ scale:1.012, boxShadow:"0 8px 32px rgba(0,0,0,0.3)" }}
      onClick={onClick}
      style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:16, padding:"20px 24px", cursor:"pointer", display:"flex", alignItems:"center", gap:18 }}
    >
      <div style={{ width:44, height:44, borderRadius:12, background:"rgba(96,200,245,0.12)", border:"1px solid rgba(96,200,245,0.3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60c8f5" strokeWidth="1.5">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
          <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:15, fontWeight:600, color:"#fff" }}>{date}</span>
          <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, background:`${urgColor}18`, border:`1px solid ${urgColor}40`, borderRadius:5, padding:"2px 8px", color:urgColor, letterSpacing:1 }}>{urgency.toUpperCase()}</span>
        </div>
        {topDiag && (
          <div style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"rgba(255,255,255,0.4)", letterSpacing:0.5 }}>
            {topDiag.condition} · {topDiag.confidence}% confidence
          </div>
        )}
        {report?.summary && (
          <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:6, lineHeight:1.5, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
            {report.summary}
          </div>
        )}
      </div>
      <div style={{ color:"rgba(255,255,255,0.25)", flexShrink:0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>
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
      style={{ position:"fixed", zIndex:500, background:"#0a0a0a",
        display:"flex", flexDirection:"column", overflow:"hidden" }}
    >
      {/* Persistent header with back button — shown for all panels */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        style={{ display:"flex", alignItems:"center", gap:16, padding:"16px 28px",
          borderBottom:"1px solid rgba(255,255,255,0.07)", flexShrink:0,
          background:"rgba(8,14,26,0.90)", backdropFilter:"blur(16px)",
          WebkitBackdropFilter:"blur(16px)", zIndex:10 }}
      >
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          onClick={onClose}
          style={{ display:"inline-flex", alignItems:"center", gap:8,
            background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.22)",
            borderRadius:10, padding:"8px 16px", color:"#fff",
            fontFamily:"'DM Mono', monospace", fontSize:11, letterSpacing:1, cursor:"pointer" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          HOME
        </motion.button>
        <span style={{ fontFamily:"'DM Mono', monospace", color:"rgba(255,255,255,0.35)", fontSize:10, letterSpacing:2 }}>
          {panels[panelIndex]?.title?.toUpperCase()}
        </span>
      </motion.div>

      <div style={{ flex:1, overflow:"hidden" }}>
        {content[panelIndex]}
      </div>
    </motion.div>
  );
}
