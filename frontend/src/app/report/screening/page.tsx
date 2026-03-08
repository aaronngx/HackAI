"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Starsfield from "@/components/Starsfield.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExamInput {
  rightEyeAcuity: string;
  leftEyeAcuity: string;
  myopiaEstimate?: string;      // e.g. "Est. −1.75 D" or "None detected"
  hyperopiaEstimate?: string;   // e.g. "Est. +1.50 D" or "None detected"
  astigmatismEstimate?: string; // e.g. "Mild, 90° axis" or "None detected"
  age: number;
  wearsCorrection: "glasses" | "contacts" | "none";
  previousEyeConditions: string;
}

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
  rightEyeAcuity: "20/40",
  leftEyeAcuity: "20/20",
  myopiaEstimate: "Est. −1.75 D",
  hyperopiaEstimate: "None detected",
  astigmatismEstimate: "Mild, 90° axis",
  age: 24,
  wearsCorrection: "glasses",
  previousEyeConditions: "None",
};

const MOCK_REPORT: ExamReport = {
  summary:
    "Based on this screening, your right eye shows signs consistent with mild myopia at an estimated −1.75 diopters, along with a mild astigmatism. Your left eye appears to be within normal range. These are estimations only — a licensed eye care professional can provide a full evaluation and personalised guidance.",
  diagnoses: [
    { condition: "Myopia (right eye)", icd10: "H52.1", confidence: 82, estimatedRx: "Est. −1.75 D sphere" },
    { condition: "Astigmatism (right eye)", icd10: "H52.2", confidence: 70, estimatedRx: "Est. −0.50 D cyl, 90°" },
  ],
  urgency: "moderate",
  urgencyReason: "Acuity differences between eyes noted — consider booking a professional eye exam to confirm these estimates.",
};

// ── Eye care plan builder ─────────────────────────────────────────────────────

interface EyeCarePlan {
  exercises: { title: string; description: string; duration: string }[];
  lubrication: { tip: string; reason: string }[];
  correctionCare: { tip: string }[];
  followUpDays: number;       // recommended follow-up in days
}

function buildEyeCarePlan(input: ExamInput, report: ExamReport): EyeCarePlan {
  const hasMyopia = report.diagnoses.some(d => d.condition.toLowerCase().includes("myopia"));
  const hasAstigmatism = report.diagnoses.some(d => d.condition.toLowerCase().includes("astigmatism"));
  const hasHyperopia = report.diagnoses.some(d => d.condition.toLowerCase().includes("hyperopia"));
  const wears = input.wearsCorrection;

  const exercises = [
    {
      title: "20-20-20 Rule",
      description: "Every 20 minutes of screen time, look at something 20 feet away for 20 seconds. This relaxes the focusing muscles inside your eyes.",
      duration: "20 sec every 20 min",
    },
    {
      title: "Near-Far Focusing",
      description: "Hold a finger close to your nose, focus on it for 5 seconds, then shift focus to something far away for 5 seconds. Repeat 10 times to exercise your eye's zoom muscles.",
      duration: "2 min · 2× daily",
    },
    ...(hasMyopia || hasAstigmatism ? [{
      title: "Figure-8 Tracing",
      description: "Imagine a giant figure-8 about 10 feet in front of you. Slowly trace it with your eyes without moving your head. This strengthens the muscles that control eye movement.",
      duration: "2 min · once daily",
    }] : []),
    ...(hasHyperopia ? [{
      title: "Close Focus Exercise",
      description: "Hold a printed page at arm's length and slowly bring it toward your face, keeping the text as sharp as possible. Stop when it blurs, then move it back out. This trains your near-focus system.",
      duration: "1 min · 3× daily",
    }] : []),
    {
      title: "Palming",
      description: "Rub your palms together to warm them, then gently cup them over your closed eyes — no pressure on the eyeballs. Rest and breathe deeply. This relieves eye tension and digital strain.",
      duration: "3 min · anytime",
    },
  ];

  const lubrication: { tip: string; reason: string }[] = wears === "contacts" ? [
    { tip: "Use preservative-free rewetting drops designed for contact lenses", reason: "Regular drops can coat your lenses and cause blurry vision or irritation." },
    { tip: "Follow the 20-20-20 rule strictly — contacts reduce tear flow", reason: "Contact lenses absorb tear film, making dry-eye symptoms worse during screen use." },
    { tip: "Remove contacts at least 1–2 hours before bed", reason: "Night-time eye rest without lenses allows the ocular surface to recover." },
    { tip: "Never sleep in daily or monthly lenses unless specifically extended-wear approved", reason: "Overnight wear significantly increases infection risk." },
  ] : wears === "glasses" ? [
    { tip: "Use lubricating eye drops (artificial tears) if your eyes feel dry or gritty", reason: "Glasses do not affect tear film, but air conditioning and screen use still dry your eyes out." },
    { tip: "Consider a humidifier in your workspace", reason: "Low humidity is the #1 environmental cause of dry eye in office settings." },
    { tip: "Blink fully and consciously — we blink 60% less when reading screens", reason: "Incomplete blinks don't spread tears properly across the eye surface." },
  ] : [
    { tip: "Use preservative-free artificial tears 1–2× a day as a baseline", reason: "Even without correction, screen use and air exposure gradually reduce natural tear moisture." },
    { tip: "Warm compresses on closed eyes for 5 minutes each morning", reason: "Heat unclogs meibomian glands, which produce the oily layer that keeps tears from evaporating." },
    { tip: "Stay hydrated — aim for 8 cups of water daily", reason: "Tear production drops significantly when you're even mildly dehydrated." },
  ];

  const correctionCare: { tip: string }[] = wears === "glasses" ? [
    { tip: "Clean lenses with a microfibre cloth and lens-safe solution daily — never use paper towels or clothing." },
    { tip: "Store glasses in a hard case when not in use to prevent frame warping and lens scratches." },
    { tip: "Get your frames adjusted every 6–12 months — a misaligned frame forces your eyes to compensate." },
    { tip: "Anti-reflective coating reduces glare from screens and headlights — worth considering at your next lens update." },
  ] : wears === "contacts" ? [
    { tip: "Replace your lens case every 3 months and use fresh solution — never top off old solution." },
    { tip: "Always wash and dry your hands before handling lenses." },
    { tip: "Keep a spare pair of glasses in case of eye irritation or infection — never push through discomfort with contacts in." },
    { tip: "Avoid wearing contacts in swimming pools, hot tubs, or showers — waterborne bacteria can cause serious infections." },
  ] : [];

  const followUpDays = report.urgency === "high" || report.urgency === "critical" ? 30
    : report.urgency === "moderate" ? 90 : 180;

  return { exercises, lubrication, correctionCare, followUpDays };
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

async function generateReport(input: ExamInput): Promise<ExamReport> {
  const systemPrompt = `You are an ophthalmology AI assistant. You generate structured eye screening reports based on self-reported exam data. You do not diagnose — you provide estimations and guidance only. Return ONLY valid JSON, no markdown or code fences.`;
  const prompt = `Generate an eye screening report from this data:
${JSON.stringify(input, null, 2)}

The exam measured visual acuity and provided estimates for myopia, hyperopia, and astigmatism. Consider the patient's age, current correction (glasses/contacts/none), and previous conditions. List only refractive conditions (myopia, hyperopia, astigmatism) that are supported by the data. Phrase everything as estimations, not diagnoses.

Return this exact JSON (diagnoses array may have 0–3 items):
{
  "summary": "2-3 sentence plain-language summary phrased as estimates and guidance, not diagnoses",
  "diagnoses": [{ "condition": "name", "icd10": "code", "confidence": <0-100>, "estimatedRx": "optional estimated range e.g. Est. -1.75 D" }],
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
  const acuityNote = input.rightEyeAcuity !== "20/20" || input.leftEyeAcuity !== "20/20"
    ? `Your right eye measured ${input.rightEyeAcuity} and your left eye ${input.leftEyeAcuity}. ${
        input.rightEyeAcuity !== input.leftEyeAcuity
          ? "There appears to be a difference between your two eyes, which is worth discussing with a professional."
          : "Both eyes show the same acuity result."
      }`
    : "Both eyes appear to be within the 20/20 normal range based on this screening.";

  const conditionExplanations: Record<string, string> = {
    myopia: "Myopia, or nearsightedness, means distant objects appear blurry because the eyeball is slightly too long.",
    hyperopia: "Hyperopia, or farsightedness, means nearby objects may appear blurry because the eyeball is slightly shorter than normal.",
    astigmatism: "Astigmatism means the cornea is slightly irregular in shape, causing blurry or distorted vision at any distance.",
    presbyopia: "Presbyopia is an age-related change where the lens loses flexibility, making it harder to focus on close objects.",
  };

  const diagnosisLines = report.diagnoses.slice(0, 2).flatMap((d, i) => {
    const key = d.condition.toLowerCase().replace(/[^a-z]/g, "");
    const matchedKey = Object.keys(conditionExplanations).find(k => key.includes(k));
    const explanation = matchedKey ? conditionExplanations[matchedKey] : "";
    const prefix = i === 0
      ? `The screening suggests a possible pattern consistent with ${d.condition}${d.estimatedRx ? `, with a rough estimate of ${d.estimatedRx}` : ""}. Confidence estimate: ${d.confidence} percent.`
      : `A secondary finding suggests possible ${d.condition}, at ${d.confidence} percent confidence.`;
    return explanation ? [prefix, explanation] : [prefix];
  });

  const refractiveNote = [
    input.myopiaEstimate && input.myopiaEstimate !== "None detected" ? `Myopia estimate: ${input.myopiaEstimate}.` : "",
    input.hyperopiaEstimate && input.hyperopiaEstimate !== "None detected" ? `Hyperopia estimate: ${input.hyperopiaEstimate}.` : "",
    input.astigmatismEstimate && input.astigmatismEstimate !== "None detected" ? `Astigmatism estimate: ${input.astigmatismEstimate}.` : "",
  ].filter(Boolean).join(" ");

  return [
    `Hi, I'm Iris. Here's a summary of your eye screening.`,
    acuityNote,
    refractiveNote ? `Refractive estimates: ${refractiveNote} These are approximations, not clinical prescriptions.` : "",
    ...diagnosisLines,
    diagnosisLines.length === 0 ? "No significant refractive patterns were detected." : "",
    report.summary,
    report.urgencyReason,
    `Please consult a licensed eye care professional for a full evaluation.`,
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
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.45)", fontFamily: "'DM Mono'", fontSize: 11, letterSpacing: 1,
                padding: "0 0 12px 0", transition: "color 0.18s",
              }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
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
              {[["Age", `${input?.age} yrs`], ["Correction", input?.wearsCorrection === "none" ? "None" : input?.wearsCorrection === "glasses" ? "Glasses" : "Contacts"], ["Right Eye", input?.rightEyeAcuity ?? "—"], ["Left Eye", input?.leftEyeAcuity ?? "—"]].map(([k, v]) => (
                <div key={k} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1, marginBottom: 4 }}>{k}</div>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: C.cream, lineHeight: 1 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main grid: sidebar + content ── */}
        <div className="report-grid">

          {/* LEFT sidebar */}
          <div className="fade-up report-sidebar" style={{ background: "#e8eef8" }}>

            {/* Exam Summary stats */}
            <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#4a6280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 20 }}>Exam Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {[
                ["Age", `${input?.age ?? "—"} yrs`],
                ["Correction", input?.wearsCorrection === "none" ? "None" : input?.wearsCorrection === "glasses" ? "Glasses" : "Contacts"],
              ].map(([label, value]) => (
                <div key={label} style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1px solid #ccd8ee" }}>
                  <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "#8098b8", letterSpacing: 1, marginBottom: 5 }}>{label}</div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: "#0d1b2e" }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {[
                ["Myopia", input?.myopiaEstimate ?? "—"],
                ["Hyperopia", input?.hyperopiaEstimate ?? "—"],
                ["Astigmatism", input?.astigmatismEstimate ?? "—"],
              ].map(([label, value]) => (
                <div key={label} style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", border: "1px solid #ccd8ee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "#8098b8", letterSpacing: 1 }}>{label}</div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, color: value === "None detected" ? C.green : "#0d1b2e" }}>{value}</div>
                </div>
              ))}
            </div>
            {input?.previousEyeConditions && input.previousEyeConditions !== "None" && (
              <div style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1px solid #ccd8ee", marginBottom: 12 }}>
                <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "#8098b8", letterSpacing: 1, marginBottom: 5 }}>Previous Conditions</div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: "#0d1b2e", lineHeight: 1.5 }}>{input.previousEyeConditions}</div>
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: "1px solid #ccd8ee", marginBottom: 32 }} />

            {/* Visual Acuity */}
            <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#4a6280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Visual Acuity</div>
            <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "#8098b8", marginBottom: 20, lineHeight: 1.5 }}>Measured distance vision — 20/20 is standard.</div>
            {[["Right Eye", input?.rightEyeAcuity ?? "—"], ["Left Eye", input?.leftEyeAcuity ?? "—"]].map(([eye, val]) => {
              const isNormal = val === "20/20";
              return (
                <div key={eye} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: "#0d1b2e" }}>{eye}</span>
                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: isNormal ? C.green : C.amber }}>{val}</span>
                  </div>
                  <div style={{ height: 4, background: "#ccd8ee", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: isNormal ? C.green : C.amber, borderRadius: 2, width: isNormal ? "100%" : "50%", transition: "width 1.2s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT main content */}
          <div className="fade-up report-content">

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
              <button className="report-footer-btn-primary" style={{ background: `linear-gradient(135deg, ${C.brand}, #007a87)` }}>
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