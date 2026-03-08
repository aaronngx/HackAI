"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DetectionInput {
  result: "normal" | "condition_detected";
  conditionName?: string;       // e.g. "Conjunctivitis"
  confidence?: number;          // 0–100
  icd10?: string;               // e.g. "H10.9"
  affectedEye?: "left" | "right" | "both";
  imageDate?: string;
}

interface DetectionReport {
  summary: string;
  recommendation: string;
}

interface EyeDiagnosticHistoryItem {
  id: string;
  userId: string;
  likely_disease: string;
  confidence: string;
  visible_findings: string[];
  short_report?: string | null;
  medical_disclaimer?: string | null;
  createdAt: string;
}

// ── Colours ───────────────────────────────────────────────────────────────────

const C = {
  cream: "#f5f2ee",
  ink: "#1a1410",
  inkDim: "#6b5f52",
  red: "#c0392b",
  amber: "#d4870a",
  green: "#2d7a4f",
  brand: "#00c4d4",
};

function toConfidencePercent(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, value));
  }

  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const numeric = Number.parseFloat(trimmed);
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(100, numeric));
  }

  const lower = trimmed.toLowerCase();
  if (lower === "low") return 35;
  if (lower === "medium") return 65;
  if (lower === "high") return 90;
  return undefined;
}

function buildFallbackReport(input: DetectionInput): DetectionReport {
  if (input.result === "normal") {
    return {
      summary:
        "No visible signs of common external eye conditions were detected in this image-based screening.",
      recommendation:
        "No immediate action is suggested from this screening alone. Keep regular eye check-ups as routine care.",
    };
  }

  const condition = input.conditionName || "an external eye condition";
  const eyeText = input.affectedEye ? ` in the ${input.affectedEye} eye` : "";
  const confidenceText =
    input.confidence != null
      ? ` with an estimated confidence of ${input.confidence}%`
      : "";

  return {
    summary: `The screening model identified patterns potentially consistent with ${condition}${eyeText}${confidenceText}. This is an automated estimation only and has not been verified by a medical professional.`,
    recommendation:
      "Please consult a licensed eye care professional for proper evaluation. Do not self-medicate based on this result.",
  };
}

function mapHistoryToInput(item: EyeDiagnosticHistoryItem): DetectionInput {
  const conditionName = String(item.likely_disease || "").trim();
  const normalizedCondition = conditionName.toLowerCase();
  const isNormal = normalizedCondition === "normal" || normalizedCondition === "n/a";

  return {
    result: isNormal ? "normal" : "condition_detected",
    conditionName: isNormal ? undefined : conditionName,
    confidence: toConfidencePercent(item.confidence),
    affectedEye: "both",
    imageDate: item.createdAt,
  };
}

// ── Gemini report generator ───────────────────────────────────────────────────

async function generateDetectionReport(
  input: DetectionInput,
  history: EyeDiagnosticHistoryItem[] = []
): Promise<DetectionReport> {
  const systemPrompt = `You are an ophthalmology AI assistant. You summarise eye disease detection results from image analysis. You do not diagnose — you provide estimations only. Return ONLY valid JSON, no markdown or code fences.`;
  const historyContext = history.length
    ? `Personalization context from this logged-in user's previous eye-diagnostic records (most recent first):
${JSON.stringify(
  history.slice(0, 5).map((item) => ({
    date: item.createdAt,
    likely_disease: item.likely_disease,
    confidence: item.confidence,
    visible_findings: item.visible_findings,
    short_report: item.short_report,
  })),
  null,
  2
)}

Use this history to personalize tone and recommendation carefully, but do not overstate certainty.`
    : `No previous eye-diagnostic history is available for this user.`;

  const prompt = `Summarise this external eye disease screening result:
${JSON.stringify(input, null, 2)}

${historyContext}

The detection model analysed an image of the eye and returned either "normal" or a specific condition name with confidence. Write a plain-language summary and a recommendation. Phrase everything as estimations, not diagnoses.

Return this exact JSON:
{
  "summary": "2-3 sentences describing what the model found, phrased as estimation only",
  "recommendation": "one sentence guiding the user, not a clinical recommendation"
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
    return JSON.parse(cleaned) as DetectionReport;
  } catch (e) {
    console.warn("Gemini failed, using rule-based fallback report:", e);
    return buildFallbackReport(input);
  }
}

async function fetchEyeDiagnosticHistory(token: string): Promise<EyeDiagnosticHistoryItem[]> {
  try {
    const res = await fetch(`/api/eye-diagnostic/history?t=${Date.now()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.history) ? data.history : [];
  } catch {
    return [];
  }
}

// ── Narration script builder ──────────────────────────────────────────────────

function buildNarrationScript(input: DetectionInput, report: DetectionReport): string[] {
  const isNormal = input.result === "normal";

  const conditionExplanations: Record<string, string> = {
    conjunctivitis: "Conjunctivitis, or pink eye, is an inflammation of the clear layer over the white of the eye, causing redness and discharge.",
    cataract: "A cataract is a clouding of the eye's natural lens, causing blurry vision and sensitivity to glare.",
    stye: "A stye is a small, painful lump on the eyelid caused by a bacterial infection near the eyelashes.",
    pterygium: "A pterygium is a tissue growth on the white of the eye that can slowly spread onto the cornea.",
    glaucoma: "Glaucoma is damage to the optic nerve, often from high eye pressure, which can cause gradual vision loss.",
    keratitis: "Keratitis is inflammation of the cornea causing eye pain, redness, and blurred vision.",
    blepharitis: "Blepharitis is chronic inflammation of the eyelids causing redness, irritation, and crusty flakes at the lash line.",
  };

  const conditionKey = input.conditionName?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  const matchedKey = Object.keys(conditionExplanations).find(k => conditionKey.includes(k));
  const explanation = matchedKey ? conditionExplanations[matchedKey] : "";

  const detectionLine = isNormal
    ? `Good news — no visible signs of common external eye conditions were found. Your eye appears normal based on this screening.`
    : `The model detected patterns consistent with ${input.conditionName ?? "an external eye condition"}${input.affectedEye ? ` in your ${input.affectedEye} eye` : ""}${input.confidence != null ? `, at ${input.confidence} percent confidence` : ""}. This is an automated estimate only.`;

  return [
    `Hi, I'm Iris. I've reviewed your eye disease screening. Here's what was found.`,
    detectionLine,
    !isNormal && explanation ? explanation : "",
    report.summary,
    report.recommendation,
    `Remember, this tool cannot assess internal structures or eye pressure. Please consult a licensed eye care professional for a full evaluation.`,
  ].filter(Boolean);
}

// ── ElevenLabs voice hook ─────────────────────────────────────────────────────

function useElevenLabsNarration() {
  const [lineIdx, setLineIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
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
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      setLoading(false);
      audio.onended = () => { if (!stoppedRef.current) speakLine(idx + 1); };
      audio.onerror = () => { setLoading(false); if (!stoppedRef.current) speakLine(idx + 1); };
      await audio.play();
    } catch (err) {
      console.error("TTS error:", err);
      setLoading(false);
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

// ── NarrationBar ─────────────────────────────────────────────────────────────

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
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "#ffffff", borderTop: `2px solid ${C.brand}`,
      boxShadow: "0 -4px 20px rgba(13,27,46,0.08)",
      padding: "14px 60px 20px",
      animation,
    }}>
      <style>{`
        @keyframes voicePulse { from { height: 4px; } to { height: 20px; } }
        @keyframes narBarUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes narBarDown { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
      `}</style>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 3, alignItems: "center", paddingTop: 2, flexShrink: 0 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: 3, borderRadius: 2,
              background: loading ? "#b0bcd4" : C.brand,
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
          color: "#4a6280", fontFamily: "'DM Mono', monospace", fontSize: 11, flexShrink: 0,
        }}>Stop</button>
      </div>
      <div style={{ height: 2, background: "#e0e8f4", borderRadius: 1, marginTop: 14, maxWidth: 860, margin: "14px auto 0" }}>
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

export default function DiseaseReportPage() {
  const router = useRouter();
  const [input, setInput] = useState<DetectionInput | null>(null);
  const [report, setReport] = useState<DetectionReport | null>(null);
  const [diagnosticHistory, setDiagnosticHistory] = useState<EyeDiagnosticHistoryItem[]>([]);
  const [inputError, setInputError] = useState<string>("");
  const [pageLoading, setPageLoading] = useState(true);
  const [narrationLines, setNarrationLines] = useState<string[]>([]);
  const [showNarrationPrompt, setShowNarrationPrompt] = useState(false);
  const [pageExiting, setPageExiting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const { lineIdx, playing, loading: ttsLoading, start, stop, replay } = useElevenLabsNarration();

  const handleBack = () => {
    stop();
    setPageExiting(true);
    setTimeout(() => router.push("/"), 380);
  };

  useEffect(() => {
    let cancelled = false;

    const loadInput = async () => {
      setInputError("");

      let storedInput: DetectionInput | null = null;
      try {
        const raw = localStorage.getItem("irisDetectionResults");
        storedInput = raw ? (JSON.parse(raw) as DetectionInput) : null;
      } catch {
        storedInput = null;
      }

      const token = sessionStorage.getItem("token");
      if (token) {
        const history = await fetchEyeDiagnosticHistory(token);
        if (cancelled) return;

        setDiagnosticHistory(history);
        if (history.length > 0) {
          setInput(mapHistoryToInput(history[0]));
          return;
        }
      }

      if (cancelled) return;

      if (storedInput) {
        setInput(storedInput);
        return;
      }

      setInput(null);
      setInputError("No diagnostic data found in your account history.");
      setPageLoading(false);
    };

    loadInput();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!input) return;
    setPageLoading(true);

    generateDetectionReport(input, diagnosticHistory).then(r => {
      setReport(r);
      setNarrationLines(buildNarrationScript(input, r));
      setPageLoading(false);
      setShowNarrationPrompt(true);
      try { localStorage.setItem("irisDetectionReport", JSON.stringify(r)); } catch {}
    });
  }, [diagnosticHistory, input]);

  const isNormal = input?.result === "normal";
  const resultColor = isNormal ? C.green : C.amber;
  const resultBg = isNormal ? "#f0faf4" : "#fffbf0";
  const resultBorder = isNormal ? "#b6e8c8" : "#f5d87e";

  // ── Loading ──
  if (pageLoading) return (
    <div style={{ minHeight: "100vh", background: "#f0f5fb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="1.5"
        style={{ animation: "spin 2s linear infinite", filter: `drop-shadow(0 0 8px ${C.brand}99)` }}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
      </svg>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 4, color: "#0d1b2e" }}>Analysing Image</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#8098b8" }}>Reviewing detection results...</div>
    </div>
  );

  if (!report || !input) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f0f5fb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 520,
            background: "#fff",
            border: "1px solid #ccd8ee",
            borderRadius: 14,
            padding: 20,
            color: "#0d1b2e",
          }}
        >
          <div style={{ fontFamily: "'Instrument Serif'", fontSize: 24, marginBottom: 8 }}>
            Report unavailable
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#4a6280", margin: 0 }}>
            {inputError || "No diagnostic data available for this report."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f0f5fb; font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeDown { from { opacity:1; transform:translateY(0); }   to { opacity:0; transform:translateY(12px); } }
        @keyframes voicePulse { from { height: 4px; } to { height: 20px; } }
        @keyframes promptFadeIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
        .fade-up   { animation: fadeUp  0.5s ease both; }
        .page-exit { animation: fadeDown 0.36s ease forwards; }
        .report-header { padding: 28px 60px; }
        .report-body { padding: 48px 60px; max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 32px; }
        .report-footer { padding: 36px 60px; }
        @media (max-width: 900px) {
          .report-header { padding: 20px 24px; }
          .report-body { padding: 28px 20px; }
          .report-footer { padding: 28px 24px; }
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
                Iris can narrate your eye disease screening results — explaining what was found and what each condition means.
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

        {/* ── Header ── */}
        <div className="fade-up report-header" style={{ background: "#0d1526", borderBottom: "1px solid #1e2d45", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: 40, top: -10, fontFamily: "'Bebas Neue'", fontSize: 200, color: "rgba(255,255,255,0.03)", lineHeight: 1, userSelect: "none" }}>IRIS</div>
          <button
            onClick={handleBack}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 10,
              color: "#fff",
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              padding: "8px 12px",
              cursor: "pointer",
              position: "relative",
              zIndex: 1,
            }}
          >
            ← Back
          </button>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
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
              <div style={{ fontFamily: "'Instrument Serif'", fontSize: 32, color: C.cream, lineHeight: 1.1 }}>Disease Detection Report</div>
              <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
                {input.imageDate
                  ? new Date(input.imageDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                  : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </div>
              {diagnosticHistory.length > 0 && (
                <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                  Personalized with {diagnosticHistory.length} previous diagnostic record{diagnosticHistory.length > 1 ? "s" : ""}
                </div>
              )}
            </div>
            {/* Result badge in header */}
            <div style={{
              background: isNormal ? "rgba(45,122,79,0.2)" : "rgba(212,135,10,0.2)",
              border: `1px solid ${isNormal ? "rgba(45,122,79,0.4)" : "rgba(212,135,10,0.4)"}`,
              borderRadius: 12, padding: "10px 20px", textAlign: "center",
            }}>
              <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 1, marginBottom: 4 }}>SCREENING RESULT</div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 2, color: isNormal ? "#6ddfa0" : "#f5c842" }}>
                {isNormal ? "Normal" : input.conditionName ?? "Condition Detected"}
              </div>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="report-body">

          {/* Result card */}
          <div className="fade-up" style={{ background: resultBg, border: `1px solid ${resultBorder}`, borderLeft: `4px solid ${resultColor}`, borderRadius: 16, padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: isNormal ? "#d4f4e3" : "#fff3cc",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {isNormal
                  ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                }
              </div>
              <div>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, letterSpacing: 2, color: resultColor, lineHeight: 1 }}>
                  {isNormal ? "No Condition Detected" : input.conditionName ?? "Condition Detected"}
                </div>
                {!isNormal && (
                  <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                    {input.confidence != null && (
                      <span style={{ fontFamily: "'DM Mono'", fontSize: 10, background: `${C.amber}22`, border: `1px solid ${C.amber}44`, borderRadius: 6, padding: "3px 8px", color: C.amber }}>
                        Est. {input.confidence}% confidence
                      </span>
                    )}
                    {input.icd10 && (
                      <span style={{ fontFamily: "'DM Mono'", fontSize: 10, background: "#f0f5fb", border: "1px solid #ccd8ee", borderRadius: 6, padding: "3px 8px", color: "#4a6280" }}>
                        ICD-10: {input.icd10}
                      </span>
                    )}
                    {input.affectedEye && (
                      <span style={{ fontFamily: "'DM Mono'", fontSize: 10, background: "#f0f5fb", border: "1px solid #ccd8ee", borderRadius: 6, padding: "3px 8px", color: "#4a6280" }}>
                        {input.affectedEye.charAt(0).toUpperCase() + input.affectedEye.slice(1)} eye
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{
                    width: 3, borderRadius: 2,
                    background: playing ? C.brand : "#b0bcd4",
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
                  if (playing) { stop(); }
                  else if (hasStarted) { replay(narrationLines); }
                  else { setHasStarted(true); start(narrationLines); }
                }}
                style={{
                  marginLeft: "auto", background: "#0d1526", border: "none", borderRadius: 8,
                  padding: "10px 22px", cursor: "pointer",
                  fontFamily: "'DM Mono'", fontSize: 13, color: "#fff",
                }}
              >
                {playing ? "⏹ Stop" : hasStarted ? "▶ Re-read" : "▶ Play"}
              </button>
            </div>
            <p style={{ fontFamily: "'Instrument Serif'", fontSize: 17, color: "#0d1b2e", lineHeight: 1.7 }}>
              {report.summary}
            </p>
          </div>

          {/* What this means */}
          <div className="fade-up" style={{ background: "#ffffff", borderRadius: 16, padding: 28, border: "1px solid #ccd8ee", boxShadow: "0 1px 4px rgba(13,27,46,0.05)" }}>
            <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#4a6280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>What This Means</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                isNormal
                  ? { icon: "✓", text: "The AI model found no visible signs of common external eye conditions in the submitted image." }
                  : { icon: "!", text: `The model detected patterns potentially consistent with ${input.conditionName}. This is an automated estimate — it has not been reviewed by a medical professional.` },
                { icon: "i", text: "This screening only covers a limited set of visible external eye conditions. It cannot detect internal eye diseases, refractive errors, or conditions that require clinical examination." },
                { icon: "→", text: report.recommendation },
              ].map(({ icon, text }, i) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: i === 2 ? `${C.brand}18` : "#f0f5fb",
                    border: `1px solid ${i === 2 ? C.brand + "44" : "#ccd8ee"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'DM Mono'", fontSize: 12,
                    color: i === 2 ? C.brand : "#4a6280",
                  }}>{icon}</div>
                  <p style={{ fontSize: 14, color: "#0d1b2e", lineHeight: 1.65, paddingTop: 4 }}>{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Scope notice */}
          <div className="fade-up" style={{ background: "#fff8f0", border: "1px solid #f5d87e", borderRadius: 12, padding: "16px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p style={{ fontFamily: "'DM Mono'", fontSize: 11, color: "#7a5a10", lineHeight: 1.7 }}>
              <strong>Scope of this tool:</strong> This detection model analyses external eye images only (e.g. conjunctivitis, cataracts, stye, pterygium). It does not assess internal structures, intraocular pressure, retinal health, or refractive errors. Results are indicative only and must not be used for clinical decision-making.
            </p>
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="report-footer" style={{ background: "#ffffff", borderTop: "1px solid #ccd8ee" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 860, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontFamily: "'Instrument Serif'", fontSize: 22, color: "#0d1b2e", marginBottom: 8 }}>Guidance & Next Steps</div>
                <p style={{ fontSize: 14, color: "#4a6280", lineHeight: 1.7, maxWidth: 560 }}>
                  {isNormal
                    ? "No follow-up is required based on this screening alone. We still recommend regular professional eye exams as a precaution."
                    : "Please consult a licensed eye care professional for proper evaluation. This result is an estimation only and should not be acted upon without professional confirmation."}
                </p>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button style={{ padding: "13px 26px", borderRadius: 12, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${C.brand}, #007a87)`, color: "#fff", fontFamily: "'Bebas Neue'", fontSize: 17, letterSpacing: 2, whiteSpace: "nowrap" }}>
                  Find Eye Doctor
                </button>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #e0e8f4", paddingTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <p style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "#8098b8", lineHeight: 1.7, maxWidth: 600, display: "flex", gap: 8, alignItems: "flex-start" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8098b8" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                This report is AI-generated and does not constitute a medical diagnosis. Always consult a qualified eye care professional before taking any action based on these results.
              </p>
              <div style={{ fontFamily: "'DM Mono'", fontSize: 12, color: "#8098b8", letterSpacing: "0.1em" }}>HACKAI © 2026</div>
            </div>
          </div>
        </div>

      </div>

      <NarrationBar lines={narrationLines} lineIdx={lineIdx} playing={playing} loading={ttsLoading} onStop={stop} />
    </>
  );
}
