"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Starsfield from "@/components/Starsfield.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EyeRefraction {
  sph: number;
  cyl: number;
  axis: number;
  note?: string | null;
  colorNote?: string | null;
}

interface EyeData {
  testedEye: "left" | "right";
  coveredEye: "left" | "right";
  axis?: number | null;
  axisConf?: number | null;
  mdsf1?: number | null;    // MDSF along-axis threshold (CPD)
  mdsf2?: number | null;    // MDSF perp threshold (CPD)
  sn1?: number | null;      // Snellen denominator from mdsf1
  sn2?: number | null;      // Snellen denominator from mdsf2
  fp1Mm?: number | null;    // far-point 1 (mm)
  fp2Mm?: number | null;    // far-point 2 (mm)
  refraction?: EyeRefraction | null;
  quality?: number | null;  // 0-100
  protocol?: string;
}

// { left?: EyeData, right?: EyeData } — written by astig-test.html
type ExamInput = { left?: EyeData; right?: EyeData };

interface Diagnosis {
  condition: string;
  icd10: string;
  confidence: number;
  estimatedRx?: string;
}

interface ExamReport {
  summary: string;
  diagnoses: Diagnosis[];
  urgency: "low" | "moderate" | "high" | "critical";
  urgencyReason: string;
}

// ── Mock fallback ─────────────────────────────────────────────────────────────

const MOCK_INPUT: ExamInput = {
  left: {
    testedEye: "left", coveredEye: "right",
    axis: 120, axisConf: 1.0, protocol: "v4-lca",
    mdsf1: 6.0, mdsf2: 6.0, sn1: 100, sn2: 100,
    fp1Mm: 894, fp2Mm: 1081,
    refraction: { sph: -1.15, cyl: -0.19, axis: 30, note: "Primarily spherical myopia, little astigmatism.", colorNote: "· LCA-corrected (red)" },
    quality: 70,
  },
};

const MOCK_REPORT: ExamReport = {
  summary:
    "Your left eye screening suggests mild myopia at an estimated −1.15 D sphere with minimal astigmatism (−0.19 D cyl). Visual acuity measured 20/100 on the primary grating test. These are screening estimates only — a licensed eye care professional can confirm and refine these measurements.",
  diagnoses: [
    { condition: "Myopia (left eye)", icd10: "H52.1", confidence: 82, estimatedRx: "Est. −1.15 D sphere" },
    { condition: "Astigmatism (left eye)", icd10: "H52.2", confidence: 65, estimatedRx: "Est. −0.19 D cyl, 30° axis" },
  ],
  urgency: "moderate",
  urgencyReason: "Reduced visual acuity detected — consider booking a professional eye exam to confirm these estimates.",
};

// ── Stat formatting helpers ───────────────────────────────────────────────────

function snellen(sn: number | null | undefined): string {
  return sn != null ? `20/${sn}` : "—";
}

function fmtCpd(v: number | null | undefined): string {
  return v != null ? `${v.toFixed(2)} CPD` : "—";
}

function fmtMm(mm: number | null | undefined): string {
  if (mm == null) return "skipped";
  return `${(mm / 10).toFixed(1)} cm`;
}

function fmtD(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)} D`;
}

function qualityLabel(q: number | null | undefined): string {
  if (q == null) return "—";
  if (q >= 80) return "Excellent";
  if (q >= 60) return "Good";
  if (q >= 40) return "Fair";
  return "Poor";
}

function axisConfLabel(conf: number | null | undefined): string {
  if (conf == null) return "—";
  if (conf >= 1.0) return "High (3/3 wins)";
  if (conf >= 0.5) return "Medium (2/3 wins)";
  return "Low (1/3 wins)";
}

function qualityColor(q: number | null | undefined): string {
  if (q == null) return "#8098b8";
  if (q >= 80) return "#2d7a4f";
  if (q >= 60) return "#d4870a";
  return "#c0392b";
}

function eyeTitle(eye: "left" | "right"): string {
  return eye === "left" ? "Left Eye" : "Right Eye";
}

// ── Colours ───────────────────────────────────────────────────────────────────

const C = {
  cream: "#f5f2ee", paper: "#fffdf9", ink: "#1a1410", inkDim: "#6b5f52",
  inkFaint: "#b8aa9a", rule: "#e8e2d9", red: "#c0392b", amber: "#d4870a",
  green: "#2d7a4f", blue: "#1a5a8a",
  // Brand accent: cyan — retinal scanner / eye-tech palette
  brand: "#00c4d4",
};

// ── Gemini report generator ───────────────────────────────────────────────────

function buildExamSummaryText(input: ExamInput): string {
  const lines: string[] = [];
  for (const side of ["left", "right"] as const) {
    const e = input[side];
    if (!e) continue;
    const ref = e.refraction;
    lines.push(`${eyeTitle(side)} eye:`);
    lines.push(`  Axis: ${e.axis ?? "?"}°, Axis confidence: ${axisConfLabel(e.axisConf)}`);
    lines.push(`  Quality score: ${e.quality ?? "?"}% (${qualityLabel(e.quality)})`);
    lines.push(`  MDSF along-axis: ${fmtCpd(e.mdsf1)} → ${snellen(e.sn1)} Snellen`);
    lines.push(`  MDSF perpendicular: ${fmtCpd(e.mdsf2)} → ${snellen(e.sn2)} Snellen`);
    if (ref) {
      lines.push(`  Refraction estimate: SPH ${fmtD(ref.sph)}, CYL ${fmtD(ref.cyl)}, AXIS ${ref.axis}°`);
      lines.push(`  Far-point 1: ${fmtMm(e.fp1Mm)}, Far-point 2: ${fmtMm(e.fp2Mm)}`);
      if (ref.note) lines.push(`  Note: ${ref.note}${ref.colorNote ?? ""}`);
    } else {
      lines.push("  Refraction: far-point step skipped");
    }
  }
  return lines.join("\n");
}

async function generateReport(input: ExamInput): Promise<ExamReport> {
  const systemPrompt = `You are an ophthalmology AI assistant. You generate structured eye screening reports from raw optometric measurement data (MDSF gratings, far-point refraction, astigmatic axis). You do not diagnose — you provide estimations and guidance only. Return ONLY valid JSON, no markdown or code fences.`;

  const summary = buildExamSummaryText(input);
  const prompt = `Generate an eye screening report from these raw measurements:

${summary}

Interpret the Snellen acuity, refraction SPH/CYL values, and axis to identify possible refractive conditions (myopia, hyperopia, astigmatism). Phrase everything as estimates, not diagnoses. List only conditions supported by the data.

Return this exact JSON (diagnoses array may have 0–3 items):
{
  "summary": "2-3 sentence plain-language summary phrased as estimates and guidance, not diagnoses",
  "diagnoses": [{ "condition": "name + affected eye", "icd10": "code", "confidence": <0-100>, "estimatedRx": "optional e.g. Est. -1.15 D sphere" }],
  "urgency": "low"|"moderate"|"high"|"critical",
  "urgencyReason": "one sentence guidance, not a diagnosis"
}`;

  try {
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parts: [{ text: prompt }], systemPrompt }),
    });
    if (!res.ok) throw new Error("Gemini failed");
    const data = await res.json();
    const cleaned = data.text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as ExamReport;
  } catch (e) {
    console.warn("Gemini failed, using mock report:", e);
    return MOCK_REPORT;
  }
}

// ── Narration script builder ──────────────────────────────────────────────────

function buildNarrationScript(report: ExamReport, input: ExamInput): string[] {
  const acuityParts: string[] = [];
  for (const side of ["left", "right"] as const) {
    const e = input[side];
    if (!e) continue;
    const sn = snellen(e.sn1);
    acuityParts.push(`Your ${side} eye measured ${sn} visual acuity`);
  }
  const acuityNote = acuityParts.length
    ? acuityParts.join("; ") + "."
    : "Visual acuity data was not available for this session.";

  const refractionParts: string[] = [];
  for (const side of ["left", "right"] as const) {
    const e = input[side];
    if (!e?.refraction) continue;
    const r = e.refraction;
    refractionParts.push(
      `${eyeTitle(side)} refraction estimate: SPH ${fmtD(r.sph)}, CYL ${fmtD(r.cyl)}, axis ${r.axis}°.`
    );
  }

  const conditionExplanations: Record<string, string> = {
    myopia: "Myopia, or nearsightedness, means distant objects appear blurry because the eyeball is slightly too long.",
    hyperopia: "Hyperopia, or farsightedness, means nearby objects may appear blurry because the eyeball is slightly shorter than normal.",
    astigmatism: "Astigmatism means the cornea is slightly irregular in shape, causing blurry or distorted vision at various distances.",
  };

  const diagnosisLines = report.diagnoses.slice(0, 2).flatMap((d, i) => {
    const key = d.condition.toLowerCase().replace(/[^a-z]/g, "");
    const matchedKey = Object.keys(conditionExplanations).find(k => key.includes(k));
    const explanation = matchedKey ? conditionExplanations[matchedKey] : "";
    const prefix = i === 0
      ? `The screening suggests a pattern consistent with ${d.condition}${d.estimatedRx ? `, estimated at ${d.estimatedRx}` : ""}. Confidence: ${d.confidence} percent.`
      : `A secondary finding suggests possible ${d.condition}, at ${d.confidence} percent confidence.`;
    return explanation ? [prefix, explanation] : [prefix];
  });

  return [
    "Hi, I'm Iris. Here's a summary of your eye screening.",
    acuityNote,
    ...refractionParts,
    ...diagnosisLines,
    diagnosisLines.length === 0 ? "No significant refractive patterns were detected." : "",
    report.summary,
    report.urgencyReason,
    "Please consult a licensed eye care professional for a full evaluation.",
  ].filter(Boolean);
}

// ── ElevenLabs voice hook ─────────────────────────────────────────────────────

function useElevenLabsNarration() {
  const [lineIdx, setLineIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false); // true while fetching audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const linesRef = useRef<string[]>([]);
  const stoppedRef = useRef(false);

  const speakLine = async (idx: number) => {
    if (stoppedRef.current) return;
    if (idx >= linesRef.current.length) {
      setPlaying(false);
      setLineIdx(-1);
      return;
    }

    setLineIdx(idx);
    setLoading(true);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: linesRef.current[idx] }),
      });

      if (!res.ok) throw new Error("TTS fetch failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Clean up previous audio
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      setLoading(false);

      audio.onended = () => {
        if (!stoppedRef.current) speakLine(idx + 1);
      };

      audio.onerror = () => {
        console.error("Audio playback error");
        setLoading(false);
        if (!stoppedRef.current) speakLine(idx + 1);
      };

      await audio.play();
    } catch (err) {
      console.error("TTS error:", err);
      setLoading(false);
      // Skip this line and continue
      if (!stoppedRef.current) speakLine(idx + 1);
    }
  };

  const start = (lines: string[]) => {
    linesRef.current = lines;
    stoppedRef.current = false;
    setPlaying(true);
    speakLine(0);
  };

  const stop = () => {
    stoppedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    setPlaying(false);
    setLoading(false);
    setLineIdx(-1);
  };

  const replay = (lines: string[]) => {
    stop();
    setTimeout(() => {
      stoppedRef.current = false;
      linesRef.current = lines;
      setPlaying(true);
      speakLine(0);
    }, 300);
  };

  // Stop audio when the component unmounts (page navigation)
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current = null;
      }
    };
  }, []);

  return { lineIdx, playing, loading, start, stop, replay };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ width: 3, height: 16, background: C.brand, borderRadius: 2 }} />
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2, color: C.ink }}>{children}</span>
    </div>
  );
}

function NarrationBar({ lines, lineIdx, playing, loading, onStop }: {
  lines: string[]; lineIdx: number; playing: boolean; loading: boolean; onStop: () => void;
}) {
  const isActive = playing || lineIdx !== -1;
  type AnimState = "hidden" | "entering" | "visible" | "leaving";
  const [animState, setAnimState] = useState<AnimState>("hidden");

  useEffect(() => {
    if (isActive) {
      if (animState === "hidden" || animState === "leaving") {
        setAnimState("entering");
        const t = setTimeout(() => setAnimState("visible"), 400);
        return () => clearTimeout(t);
      }
    } else {
      if (animState === "entering" || animState === "visible") {
        setAnimState("leaving");
        const t = setTimeout(() => setAnimState("hidden"), 400);
        return () => clearTimeout(t);
      }
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  if (animState === "hidden") return null;

  const animation =
    animState === "entering" ? "narBarUp 0.38s cubic-bezier(0.2,0,0,1) forwards" :
    animState === "leaving"  ? "narBarDown 0.38s cubic-bezier(0.4,0,0.6,1) forwards" :
    "none";

  return (
    <div className="narration-bar" style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      zIndex: 100,
      background: "#ffffff",
      borderTop: `2px solid ${C.brand}`,
      boxShadow: "0 -4px 20px rgba(13,27,46,0.08)",
      animation,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Voice wave animation */}
        <div style={{ display: "flex", gap: 3, alignItems: "center", paddingTop: 2, flexShrink: 0 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: 3,
              borderRadius: 2,
              background: loading ? C.inkFaint : C.brand,
              height: loading ? 6 : [10, 18, 14, 8][i],
              transition: "height 0.2s ease, background 0.2s ease",
              animation: playing && !loading ? `voicePulse ${0.5 + i * 0.1}s ease infinite alternate` : "none",
            }} />
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#8098b8", marginBottom: 5, letterSpacing: 1 }}>
            {loading ? "IRIS AI · LOADING..." : `IRIS AI · ${lineIdx + 1} / ${lines.length}`}
          </div>
          <p style={{ fontSize: 13, color: loading ? "#8098b8" : "#0d1b2e", lineHeight: 1.55, margin: 0, fontStyle: loading ? "italic" : "normal" }}>
            {loading ? "Generating voice..." : (lines[lineIdx] ?? "")}
          </p>
        </div>

        <button onClick={onStop} style={{
          background: "#f0f5fb", border: "1px solid #ccd8ee",
          borderRadius: 8, padding: "6px 12px", cursor: "pointer",
          color: "#4a6280", fontFamily: "'DM Mono', monospace", fontSize: 11,
          flexShrink: 0, transition: "all 0.15s",
        }}>Stop</button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: "#e0e8f4", borderRadius: 1, marginTop: 14 }}>
        <div style={{
          height: "100%", background: C.brand, borderRadius: 1,
          width: lineIdx >= 0 ? `${((lineIdx + 1) / lines.length) * 100}%` : "0%",
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}


// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const router = useRouter();
  const [input, setInput] = useState<ExamInput | null>(null);
  const [report, setReport] = useState<ExamReport | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [narrationLines, setNarrationLines] = useState<string[]>([]);
  const [showNarrationPrompt, setShowNarrationPrompt] = useState(false);
  const [daysSinceLastScan, setDaysSinceLastScan] = useState<number | null>(null);
  const [pageExiting, setPageExiting] = useState(false);
  const { lineIdx, playing, loading: ttsLoading, start, stop, replay } = useElevenLabsNarration();
  const hasStarted = useRef(false);

  const handleBack = () => {
    stop();
    sessionStorage.setItem("irisIntroSeen", "1");
    setPageExiting(true);
    setTimeout(() => router.push("/"), 380);
  };

  const handleFindDoctor = () => {
    stop();
    sessionStorage.setItem("irisIntroSeen", "1");
    sessionStorage.setItem("irisOpenDoctor", "1");
    setPageExiting(true);
    setTimeout(() => router.push("/"), 380);
  };

  // 1. Load exam input from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("irisExamResults");
      setInput(raw ? JSON.parse(raw) : MOCK_INPUT);
    } catch {
      setInput(MOCK_INPUT);
    }
    // Track days since last scan
    const lastScan = localStorage.getItem("irisLastScanDate");
    if (lastScan) {
      const diff = Math.floor((Date.now() - parseInt(lastScan)) / (1000 * 60 * 60 * 24));
      setDaysSinceLastScan(diff);
    }
    localStorage.setItem("irisLastScanDate", Date.now().toString());
  }, []);

  // 2. Load cached report or generate via Gemini
  useEffect(() => {
    if (!input) return;
    setPageLoading(true);
    const cached = localStorage.getItem("irisExamReport");
    if (cached) {
      try {
        const r = JSON.parse(cached) as ExamReport;
        setReport(r);
        setNarrationLines(buildNarrationScript(r, input));
        setPageLoading(false);
        setShowNarrationPrompt(true);
        return;
      } catch { /* fall through to regenerate */ }
    }
    generateReport(input).then(r => {
      setReport(r);
      setNarrationLines(buildNarrationScript(r, input));
      setPageLoading(false);
      setShowNarrationPrompt(true);
      try { localStorage.setItem("irisExamReport", JSON.stringify(r)); } catch {}
    });
  }, [input]);

  // ── Loading ──
  if (pageLoading) return (
    <div style={{ minHeight: "100vh", background: "#080e1a", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes voicePulse { from { height: 4px; } to { height: 20px; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes narBarUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes narBarDown { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
      `}</style>
      <Starsfield
        starCount={150}
        speed={0.2}
        trail={0.3}
        twinkle={0.3}
        starSize={3}
        bgColor="#080e1a"
        starColor="#ffffff"
      />
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        animation: "fadeIn 0.6s ease",
        zIndex: 10,
      }}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="1.5" style={{ animation: "spin 2s linear infinite", filter: `drop-shadow(0 0 10px ${C.brand}99)` }}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 4, color: C.cream }}>Analysing Results</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Gemini is reviewing your screening data...</div>
      </div>
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "32px",
        textAlign: "center",
        color: "#444",
        fontSize: 12,
        letterSpacing: "0.1em",
        zIndex: 10,
      }}>
        HACKAI © 2026
      </div>
    </div>
  );

  if (!report) return null;


  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f0f5fb; font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeDown { from { opacity:1; transform:translateY(0); }   to { opacity:0; transform:translateY(14px); } }
        @keyframes voicePulse { from { height: 4px; } to { height: 20px; } }
        @keyframes promptFadeIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
        .fade-up   { animation: fadeUp  0.5s ease both; }
        .page-exit { animation: fadeDown 0.36s ease forwards; }

        /* ── Responsive layout ── */
        .report-header { padding: 28px 60px; }
        .report-header-inner { display: flex; align-items: center; justify-content: space-between; }
        .report-header-stats { display: flex; gap: 40px; }
        .report-grid { display: grid; grid-template-columns: 340px 1fr; min-height: calc(100vh - 160px); }
        .report-sidebar { padding: 40px 36px; border-right: 1px solid #ccd8ee; border-bottom: none; }
        .report-sidebar-score { display: flex; flex-direction: column; align-items: center; }
        .report-content { padding: 40px 56px; display: flex; flex-direction: column; gap: 40px; }
        .report-footer { padding: 40px 60px; }
        .report-footer-inner { display: grid; grid-template-columns: 1fr auto; gap: 40px; align-items: start; margin-bottom: 32px; }
        .report-footer-buttons { display: flex; gap: 12px; }
        .report-footer-btn-primary { padding: 14px 28px; border-radius: 12px; border: none; cursor: pointer; color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; white-space: nowrap; }
        .report-footer-btn-secondary { padding: 14px 28px; border-radius: 12px; cursor: pointer; background: transparent; border: 1px solid #ccd8ee; color: #0d1b2e; font-family: 'DM Mono', monospace; font-size: 12px; white-space: nowrap; }
        .narration-bar { padding: 14px 60px 20px; }

        @media (max-width: 900px) {
          .report-header { padding: 20px 24px; }
          .report-header-inner { flex-direction: column; align-items: flex-start; gap: 16px; }
          .report-header-stats { gap: 24px; }
          .report-grid { grid-template-columns: 1fr; min-height: unset; }
          .report-sidebar { padding: 28px 24px; border-right: none; border-bottom: 1px solid #ccd8ee; }
          .report-sidebar-score { flex-direction: row; justify-content: space-around; align-items: center; }
          .report-content { padding: 24px 20px; gap: 28px; }
          .report-footer { padding: 28px 24px; }
          .report-footer-inner { grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px; }
          .report-footer-buttons { flex-direction: column; }
          .report-footer-btn-primary, .report-footer-btn-secondary { width: 100%; text-align: center; }
          .narration-bar { padding: 14px 20px 20px; }
        }
      `}</style>

      <div className={pageExiting ? "page-exit" : ""} style={{ background: "#f0f5fb", minHeight: "100vh", color: "#0d1b2e", paddingBottom: (playing || ttsLoading) ? 90 : 0 }}>

        {/* ── Narration prompt modal ── */}
        {showNarrationPrompt && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(8,14,26,0.72)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              background: "#ffffff", borderRadius: 20, padding: "40px 44px",
              maxWidth: 420, width: "90%", textAlign: "center",
              boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
              animation: "promptFadeIn 0.35s ease both",
            }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: `${C.brand}18`, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="1.5">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </div>
              </div>
              <div style={{ fontFamily: "'Instrument Serif'", fontSize: 22, color: "#0d1b2e", marginBottom: 8 }}>
                Read Report Aloud?
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#4a6280", lineHeight: 1.6, marginBottom: 28 }}>
                Iris can narrate your eye health report in a clear, friendly voice — explaining each finding and what it means.
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => { setShowNarrationPrompt(false); start(narrationLines); }}
                  style={{
                    flex: 1, padding: "13px 0", borderRadius: 12, border: "none", cursor: "pointer",
                    background: `linear-gradient(135deg, ${C.brand}, #0090a0)`,
                    color: "#fff", fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 17, letterSpacing: 2,
                  }}
                >
                  Yes, Read It
                </button>
                <button
                  onClick={() => setShowNarrationPrompt(false)}
                  style={{
                    flex: 1, padding: "13px 0", borderRadius: 12, cursor: "pointer",
                    background: "transparent", border: "1px solid #ccd8ee",
                    color: "#4a6280", fontFamily: "'DM Mono', monospace", fontSize: 12,
                  }}
                >
                  No Thanks
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Header (stays dark for brand anchor) ── */}
        <div className="fade-up report-header" style={{ background: "#0d1526", borderBottom: "1px solid #1e2d45", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: 40, top: -10, fontFamily: "'Bebas Neue'", fontSize: 200, color: "rgba(255,255,255,0.04)", lineHeight: 1, userSelect: "none" }}>IRIS</div>
          <div className="report-header-inner">
            <div>
              <button onClick={handleBack} style={{
                display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 14,
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 10, cursor: "pointer",
                color: "rgba(255,255,255,0.75)", fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: 1,
                padding: "7px 14px",
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                HOME
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="1.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
                <span style={{ fontFamily: "'Bebas Neue'", fontSize: 20, letterSpacing: 4, color: C.cream }}>IRIS</span>
                <span style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>EYE HEALTH PLATFORM</span>
              </div>
              <div style={{ fontFamily: "'Instrument Serif'", fontSize: 36, color: C.cream, lineHeight: 1.1 }}>Eye Health Report</div>
              <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
                {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>
            <div className="report-header-stats">
              {(["right", "left"] as const).map(side => {
                const e = input?.[side];
                const sph = e?.refraction?.sph;
                return (
                  <div key={side} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1, marginBottom: 4 }}>
                      {side.toUpperCase()} EYE
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: 26, color: C.cream, lineHeight: 1 }}>
                      {snellen(e?.sn1)}
                    </div>
                    <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
                      {sph != null ? fmtD(sph) : e ? "no refraction" : "not tested"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Main grid: sidebar + content ── */}
        <div className="report-grid">

          {/* LEFT sidebar */}
          <div className="fade-up report-sidebar" style={{ background: "#e8eef8" }}>
            <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#4a6280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>Visual Acuity</div>
            <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "#8098b8", marginBottom: 16, lineHeight: 1.5 }}>Snellen acuity from MDSF grating test. 20/20 is the clinical standard.</div>
            {(["right", "left"] as const).map(side => {
              const e = input?.[side];
              const sn = e?.sn1;
              const isNormal = sn != null && sn <= 20;
              const pct = sn != null ? Math.max(10, Math.min(100, Math.round((20 / sn) * 100))) : 0;
              const acuityColor = isNormal ? C.green : sn != null && sn <= 40 ? C.amber : C.red;
              return (
                <div key={side} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: "#0d1b2e" }}>{eyeTitle(side)}</span>
                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: e ? acuityColor : "#8098b8" }}>
                      {snellen(sn)}
                    </span>
                  </div>
                  <div style={{ height: 4, background: "#ccd8ee", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: e ? acuityColor : "#ccd8ee", borderRadius: 2, width: e ? `${pct}%` : "0%", transition: "width 1.2s ease" }} />
                  </div>
                  {!e && (
                    <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "#8098b8", marginTop: 4 }}>Not tested</div>
                  )}
                </div>
              );
            })}

            <div style={{ borderTop: "1px solid #ccd8ee", margin: "20px 0" }} />

            {/* Per-eye quality */}
            <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#4a6280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Scan Quality</div>
            {(["right", "left"] as const).map(side => {
              const e = input?.[side];
              if (!e) return null;
              const q = e.quality;
              const qPct = q ?? 0;
              const qColor = qualityColor(q);
              return (
                <div key={side} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "#0d1b2e" }}>{eyeTitle(side)}</span>
                    <span style={{ fontFamily: "'DM Mono'", fontSize: 11, color: qColor, fontWeight: 600 }}>
                      {q ?? "—"}% <span style={{ opacity: 0.7 }}>({qualityLabel(q)})</span>
                    </span>
                  </div>
                  <div style={{ height: 4, background: "#ccd8ee", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: qColor, borderRadius: 2, width: `${qPct}%`, transition: "width 1.2s ease" }} />
                  </div>
                </div>
              );
            })}

            <div style={{ borderTop: "1px solid #ccd8ee", margin: "20px 0" }} />

            {/* Refraction summary */}
            <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#4a6280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Refraction</div>
            {(["right", "left"] as const).map(side => {
              const e = input?.[side];
              if (!e) return null;
              const ref = e.refraction;
              return (
                <div key={side} style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1px solid #ccd8ee", marginBottom: 10 }}>
                  <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "#8098b8", letterSpacing: 1, marginBottom: 8 }}>{side.toUpperCase()} EYE</div>
                  {ref ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                      {[["SPH", fmtD(ref.sph)], ["CYL", fmtD(ref.cyl)], [`${ref.axis}°`, "AXIS"]].map(([val, lbl]) => (
                        <div key={lbl} style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 16, color: "#0d1b2e", lineHeight: 1 }}>{val}</div>
                          <div style={{ fontFamily: "'DM Mono'", fontSize: 8, color: "#8098b8", marginTop: 2 }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#8098b8" }}>Far-point step skipped</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* RIGHT main content */}
          <div className="fade-up report-content">

            {/* ── Raw measurement data cards ── */}
            {(["right", "left"] as const).map(side => {
              const e = input?.[side];
              if (!e) return null;
              const ref = e.refraction;
              const confColor = (e.axisConf ?? 0) >= 1.0 ? C.green : (e.axisConf ?? 0) >= 0.5 ? C.amber : C.red;
              const qc = qualityColor(e.quality);
              return (
                <div key={side}>
                  <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#4a6280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
                    {eyeTitle(side)} — Measurement Data
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>

                    {/* Eye overview card */}
                    <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #ccd8ee" }}>
                      <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "#8098b8", letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>{side.toUpperCase()} EYE</div>
                      {[
                        ["Axis", `${e.axis ?? "?"}°`],
                        ["Axis conf.", axisConfLabel(e.axisConf)],
                        ["Quality", `${e.quality ?? "?"}% (${qualityLabel(e.quality)})`],
                      ].map(([label, value]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "baseline" }}>
                          <span style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#8098b8" }}>{label}</span>
                          <span style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600,
                            color: label === "Axis conf." ? confColor : label === "Quality" ? qc : "#0d1b2e" }}>
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* MDSF Along Axis */}
                    <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #ccd8ee" }}>
                      <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "#8098b8", letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>MDSF Along Axis</div>
                      {[["CPD", fmtCpd(e.mdsf1)], ["Snellen", snellen(e.sn1)]].map(([label, value]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "baseline" }}>
                          <span style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#8098b8" }}>{label}</span>
                          <span style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, color: "#0d1b2e" }}>{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* MDSF Perp */}
                    <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #ccd8ee" }}>
                      <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "#8098b8", letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>MDSF Perp.</div>
                      {[["CPD", fmtCpd(e.mdsf2)], ["Snellen", snellen(e.sn2)]].map(([label, value]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "baseline" }}>
                          <span style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#8098b8" }}>{label}</span>
                          <span style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, color: "#0d1b2e" }}>{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Refraction Est. */}
                    <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #ccd8ee" }}>
                      <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "#8098b8", letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>Refraction Est.</div>
                      {ref ? (
                        <>
                          {[
                            ["SPH", fmtD(ref.sph)],
                            ["CYL", fmtD(ref.cyl)],
                            ["AXIS", `${ref.axis}°`],
                            ["FP1", fmtMm(e.fp1Mm)],
                            ["FP2", fmtMm(e.fp2Mm)],
                          ].map(([label, value]) => (
                            <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "baseline" }}>
                              <span style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#8098b8" }}>{label}</span>
                              <span style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, color: "#0d1b2e" }}>{value}</span>
                            </div>
                          ))}
                          {ref.note && (
                            <div style={{ fontFamily: "'DM Mono'", fontSize: 8, color: C.amber, marginTop: 6, lineHeight: 1.4 }}>
                              {ref.note}{ref.colorNote}
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#8098b8" }}>Far-point step skipped</div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}

            {/* AI Summary */}
            <div>
              <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#4a6280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>AI Summary</div>
              <div style={{ background: "#ffffff", borderRadius: 16, padding: 28, border: "1px solid #ccd8ee", borderLeft: `3px solid ${C.brand}`, boxShadow: "0 1px 4px rgba(13,27,46,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} style={{
                        width: 3, borderRadius: 2, background: playing ? C.brand : "#b0bcd4",
                        height: playing ? [10, 18, 14, 8][i] : 6,
                        transition: "height 0.3s ease, background 0.3s ease",
                        animation: playing && !ttsLoading ? `voicePulse ${0.5 + i * 0.1}s ease infinite alternate` : "none",
                      }} />
                    ))}
                  </div>
                  <span style={{ fontFamily: "'DM Mono'", fontSize: 10, color: playing ? C.brand : "#8098b8", letterSpacing: 1 }}>
                    {ttsLoading ? "LOADING VOICE..." : playing ? "NARRATING" : "IRIS AI"}
                  </span>
                  <button
                    onClick={() => {
                      if (playing) {
                        stop();
                      } else if (hasStarted.current) {
                        replay(narrationLines);
                      } else {
                        hasStarted.current = true;
                        start(narrationLines);
                      }
                    }}
                    style={{
                      marginLeft: "auto", background: "#0d1526", border: "none", borderRadius: 8,
                      padding: "10px 22px", cursor: "pointer",
                      fontFamily: "'DM Mono'", fontSize: 13, color: "#fff",
                    }}
                  >
                    {playing ? "⏹ Stop" : hasStarted.current ? "▶ Re-read" : "▶ Play"}
                  </button>
                </div>
                <p style={{ fontFamily: "'Instrument Serif'", fontSize: 18, color: "#0d1b2e", lineHeight: 1.7 }}>
                  {report.summary}
                </p>
              </div>
            </div>

            {/* Diagnoses */}
            <div>
              <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#4a6280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Differential Diagnosis</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {report.diagnoses.map((d, i) => {
                  const color = [C.red, C.amber, C.blue][i] ?? "#8098b8";
                  return (
                    <div key={i} style={{ padding: 22, borderRadius: 14, border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, background: "#ffffff", boxShadow: "0 1px 4px rgba(13,27,46,0.06)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <span style={{ fontFamily: "'DM Mono'", fontSize: 10, background: color, color: "#fff", padding: "2px 7px", borderRadius: 3 }}>#{i + 1}</span>
                            <span style={{ fontFamily: "'Instrument Serif'", fontSize: 18, color: "#0d1b2e" }}>{d.condition}</span>
                          </div>
                          <span style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#8098b8" }}>ICD-10: {d.icd10}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 34, color, lineHeight: 1 }}>{d.confidence}%</div>
                          <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "#8098b8" }}>confidence</div>
                        </div>
                      </div>
                      <div style={{ height: 3, background: "#e0e8f4", borderRadius: 2, overflow: "hidden", marginBottom: d.estimatedRx ? 14 : 0 }}>
                        <div style={{ height: "100%", background: color, width: `${d.confidence}%`, transition: "width 1.5s ease" }} />
                      </div>
                      {d.estimatedRx && (
                        <div style={{ fontFamily: "'DM Mono'", fontSize: 11, background: `${color}12`, border: `1px solid ${color}33`, borderRadius: 8, padding: "8px 12px", color, marginTop: 14 }}>
                          {d.estimatedRx}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="report-footer" style={{ background: "#ffffff", borderTop: "1px solid #ccd8ee" }}>
          <div className="report-footer-inner">
            <div>
              <div style={{ fontFamily: "'Instrument Serif'", fontSize: 24, color: "#0d1b2e", marginBottom: 10 }}>Guidance & Next Steps</div>
              <p style={{ fontSize: 14, color: "#4a6280", lineHeight: 1.7, maxWidth: 600 }}>{report.urgencyReason} This screening provides estimates only — it is not a clinical diagnosis. We recommend booking a full exam with a licensed ophthalmologist.</p>
            </div>
            <div className="report-footer-buttons">
              <button className="report-footer-btn-primary" style={{ background: `linear-gradient(135deg, ${C.brand}, #007a87)` }} onClick={handleFindDoctor}>
                Find Eye Doctor
              </button>
              <button className="report-footer-btn-secondary" onClick={() => router.push("/care-plan")}>
                View Care Plan
              </button>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #e0e8f4", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#8098b8", lineHeight: 1.7, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8098b8" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              This report is AI-generated and does not constitute a medical diagnosis. Always consult a qualified eye care professional.
            </p>
            <div style={{ fontFamily: "'DM Mono'", fontSize: 12, color: "#8098b8", letterSpacing: "0.1em" }}>HACKAI © 2026</div>
          </div>
        </div>

      </div>

      <NarrationBar lines={narrationLines} lineIdx={lineIdx} playing={playing} loading={ttsLoading} onStop={stop} />
    </>
  );
}