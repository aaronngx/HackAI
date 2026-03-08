"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

const BRAND  = "#00c4d4";
const FONTS  = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');`;

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? `${Math.round(n)}%` : v || "—";
}

function isNormalResult(likelyDisease) {
  const s = String(likelyDisease || "").toLowerCase().trim();
  return s === "normal" || s === "n/a" || s === "";
}

// ── main component ────────────────────────────────────────────────────────────
export default function EyeDiseaseClassifierPanel({ onBack }) {
  const fileInputRef              = useRef(null);
  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState("");
  const [dragging, setDragging]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [result, setResult]       = useState(null);

  // preview URL lifecycle
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // drag handlers
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true);  };
  const onDragLeave = ()  => setDragging(false);
  const onDrop      = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) { setFile(f); setResult(null); setError(""); }
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setResult(null); setError(""); }
  };

  const reset = () => { setFile(null); setPreview(""); setResult(null); setError(""); };

  // analyse
  async function handleAnalyze() {
    if (!file) return;
    setError(""); setResult(null); setLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const token = sessionStorage.getItem("token");
      const res   = await fetch("/api/eye-disease/classify", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error || "Analysis failed."); return; }

      const r = data.result || null;
      setResult(r);

      if (r) {
        const conf = Number.parseFloat(String(r.confidence ?? ""));
        localStorage.setItem("irisDetectionResults", JSON.stringify({
          result:        isNormalResult(r.likely_disease) ? "normal" : "condition_detected",
          conditionName: r.likely_disease || undefined,
          confidence:    Number.isFinite(conf) ? conf : undefined,
          affectedEye:   "both",
          imageDate:     new Date().toISOString(),
          shortReport:   r.short_report || undefined,
          visibleFindings: Array.isArray(r.visible_findings) ? r.visible_findings : [],
          medicalDisclaimer: r.medical_disclaimer || undefined,
          diagnosticId:  data.diagnosticId || null,
          saved:         Boolean(data.saved),
        }));
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const goToReport = () => {
    sessionStorage.setItem("irisIntroSeen", "1");
    window.location.href = "/report/disease";
  };

  const normal      = result && isNormalResult(result.likely_disease);
  const statusColor = normal ? "#22d46a" : "#f5a623";
  const findings    = Array.isArray(result?.visible_findings)
    ? result.visible_findings.filter(Boolean)
    : [];

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "36px 40px 60px" }}>
      <style>{FONTS}</style>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* ── Page title ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, letterSpacing: 4, color: "#fff", lineHeight: 1 }}>
            Eye Disease Detection
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 2, marginTop: 6 }}>
            UPLOAD AN EYE IMAGE · AI-POWERED ANALYSIS
          </div>
        </div>

        {/* ── Upload zone ── */}
        {!result && (
          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div
                key="dropzone"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? BRAND : "rgba(255,255,255,0.14)"}`,
                  borderRadius: 20,
                  padding: "56px 32px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragging ? `${BRAND}10` : "rgba(255,255,255,0.02)",
                  transition: "all 0.2s",
                  userSelect: "none",
                }}
              >
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${BRAND}18`, border: `1px solid ${BRAND}40`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 8 }}>
                  Drop your eye image here
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>
                  or click to browse · PNG, JPG, WEBP supported
                </div>
                <div style={{ display: "inline-block", padding: "10px 28px", background: `linear-gradient(135deg, ${BRAND}, #0090a0)`, borderRadius: 10, fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2, color: "#fff" }}>
                  CHOOSE IMAGE
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={pickFile} style={{ display: "none" }} />
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {/* Image preview */}
                <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)" }}>
                  <Image
                    src={preview}
                    alt="Eye image preview"
                    width={1200} height={800}
                    unoptimized
                    style={{ width: "100%", maxHeight: 300, objectFit: "contain", display: "block" }}
                  />
                  <button
                    onClick={reset}
                    style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                {/* File name */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5 }}>{file.name}</span>
                </div>

                {/* Error */}
                {error && (
                  <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#fca5a5" }}>
                    {error}
                  </div>
                )}

                {/* Analyse button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAnalyze}
                  disabled={loading}
                  style={{
                    padding: "14px 0", width: "100%", border: "none", borderRadius: 12, cursor: loading ? "not-allowed" : "pointer",
                    background: loading ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg, ${BRAND}, #0090a0)`,
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 3, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    opacity: loading ? 0.7 : 1, transition: "background 0.2s",
                  }}
                >
                  {loading ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2" style={{ animation: "spin 1.2s linear infinite" }}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      ANALYSING…
                    </>
                  ) : "ANALYSE IMAGE"}
                </motion.button>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* ── Results summary ── */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              style={{ display: "flex", flexDirection: "column", gap: 20 }}
            >
              {/* Status banner */}
              <div style={{ borderRadius: 16, border: `1px solid ${statusColor}40`, background: `${statusColor}0e`, padding: "24px 28px", display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${statusColor}20`, border: `1px solid ${statusColor}50`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="1.5">
                    {normal
                      ? <><polyline points="20 6 9 17 4 12"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                    }
                  </svg>
                </div>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: "#fff", lineHeight: 1, marginBottom: 4 }}>
                    {normal ? "No Condition Detected" : (result.likely_disease || "Condition Detected")}
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: statusColor, letterSpacing: 1 }}>
                    {normal ? "RESULT: NORMAL" : `CONFIDENCE: ${fmt(result.confidence)}`}
                  </div>
                </div>
              </div>

              {/* Short report */}
              {result.short_report && (
                <div style={{ borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "20px 24px" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 2, marginBottom: 10 }}>SUMMARY</div>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, margin: 0 }}>
                    {result.short_report}
                  </p>
                </div>
              )}

              {/* Findings */}
              {findings.length > 0 && (
                <div style={{ borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "20px 24px" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 2, marginBottom: 12 }}>VISIBLE FINDINGS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {findings.map((f, i) => (
                      <span key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "5px 12px", color: "rgba(255,255,255,0.65)" }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={goToReport}
                  style={{ flex: 1, minWidth: 180, padding: "14px 0", border: "none", borderRadius: 12, cursor: "pointer", background: `linear-gradient(135deg, ${BRAND}, #0090a0)`, fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  VIEW FULL REPORT
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={reset}
                  style={{ padding: "14px 24px", borderRadius: 12, cursor: "pointer", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: 1, color: "rgba(255,255,255,0.6)" }}
                >
                  ANALYSE ANOTHER
                </motion.button>
              </div>

              {/* Disclaimer */}
              <div style={{ display: "flex", gap: 8, padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.28)", lineHeight: 1.6, margin: 0, letterSpacing: 0.3 }}>
                  {result.medical_disclaimer || "This result is AI-generated and is for informational purposes only. It does not constitute medical advice. Please consult a licensed eye care professional."}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
