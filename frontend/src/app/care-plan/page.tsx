"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExamInput {
  rightEyeAcuity: string;
  leftEyeAcuity: string;
  myopiaEstimate?: string;
  hyperopiaEstimate?: string;
  astigmatismEstimate?: string;
  age: number;
  wearsCorrection: "glasses" | "contacts" | "none";
  previousEyeConditions: string;
}

interface ExamReport {
  summary: string;
  diagnoses: { condition: string; icd10: string; confidence: number; estimatedRx?: string }[];
  urgency: "low" | "moderate" | "high" | "critical";
  urgencyReason: string;
}

interface Exercise {
  title: string;
  description: string;
  duration: string;
  durationSeconds: number;
  steps: string[];
}

interface EyeCarePlan {
  exercises: Exercise[];
  lubrication: { tip: string; reason: string }[];
  correctionCare: { tip: string }[];
  followUpDays: number;
}

// ── Mock fallback ─────────────────────────────────────────────────────────────

const MOCK_INPUT: ExamInput = {
  rightEyeAcuity: "20/40", leftEyeAcuity: "20/20",
  myopiaEstimate: "Est. −1.75 D", hyperopiaEstimate: "None detected",
  astigmatismEstimate: "Mild, 90° axis", age: 24,
  wearsCorrection: "contacts", previousEyeConditions: "None",
};
const MOCK_REPORT: ExamReport = {
  summary: "Mild myopia and astigmatism noted in right eye.",
  diagnoses: [
    { condition: "Myopia (right eye)", icd10: "H52.1", confidence: 82, estimatedRx: "Est. −1.75 D" },
    { condition: "Astigmatism (right eye)", icd10: "H52.2", confidence: 75, estimatedRx: "Mild, 90° axis" },
  ],
  urgency: "moderate",
  urgencyReason: "Consider booking a professional exam to confirm these estimates.",
};

// ── Colour palette ────────────────────────────────────────────────────────────

const C = { brand: "#00c4d4", navy: "#0d1526", ink: "#0d1b2e", dim: "#4a6280", faint: "#8098b8", border: "#ccd8ee", bg: "#f0f5fb" };

// ── Plan builder ──────────────────────────────────────────────────────────────

function buildPlan(input: ExamInput, report: ExamReport): EyeCarePlan {
  const hasMyopia    = report.diagnoses.some(d => d.condition.toLowerCase().includes("myopia"));
  const hasAstig     = report.diagnoses.some(d => d.condition.toLowerCase().includes("astigmatism"));
  const hasHyperopia = report.diagnoses.some(d => d.condition.toLowerCase().includes("hyperopia"));
  const wears        = input.wearsCorrection;

  const exercises: Exercise[] = [
    {
      title: "20-20-20 Rule",
      duration: "20 sec · every 20 min",
      durationSeconds: 20,
      description: "Your eyes' focusing muscles tense up during extended close-up work. This rule interrupts that strain cycle before it builds into headaches or blurred vision.",
      steps: [
        "Set a timer or reminder every 20 minutes while working on a screen.",
        "Look at an object at least 20 feet — about 6 metres — away. A window view or far wall works perfectly.",
        "Keep your gaze there for a full 20 seconds without blinking forcefully.",
        "Blink slowly 3 to 5 times, then return to work.",
      ],
    },
    {
      title: "Near-Far Focusing",
      duration: "2 min · 2× daily",
      durationSeconds: 120,
      description: "This exercise trains the ciliary muscle — the tiny muscle that changes your lens shape to focus at different distances. Strengthening it improves focus flexibility.",
      steps: [
        "Hold your index finger about 6 inches, or 15 centimetres, from your nose.",
        "Focus on your fingertip for 5 full seconds — make it sharp.",
        "Shift focus to an object 10 to 15 feet away for 5 seconds.",
        "Alternate 10 times. Do this in good natural light if possible.",
      ],
    },
    ...(hasMyopia || hasAstig ? [{
      title: "Figure-8 Tracing",
      duration: "2 min · once daily",
      durationSeconds: 120,
      description: "People with myopia or astigmatism often have slightly imbalanced eye-movement muscles. Figure-8 tracing exercises all six muscles around each eye equally.",
      steps: [
        "Imagine a large figure-8 lying on its side — like an infinity symbol — about 10 feet in front of you.",
        "Trace it slowly with your eyes in one direction for 1 minute.",
        "Reverse direction for another minute.",
        "Keep your head still — only your eyes should move.",
      ],
    }] : []),
    ...(hasHyperopia ? [{
      title: "Close-Focus Squeeze",
      duration: "1 min · 3× daily",
      durationSeconds: 60,
      description: "Farsighted eyes often have weaker near-focus ability. This drill activates the near-focus response repeatedly, gradually improving your comfortable reading range.",
      steps: [
        "Hold a page of small text at arm's length.",
        "Slowly bring it toward your face, keeping the text as sharp as possible.",
        "The moment the text blurs, hold for 3 seconds, then move it back out.",
        "Repeat 10 times per session.",
      ],
    }] : []),
    {
      title: "Palming",
      duration: "3 min · anytime",
      durationSeconds: 180,
      description: "Darkness and warmth signal the eyes and visual cortex to fully relax. Palming is the quickest way to reset after intense screen use or under fluorescent lighting.",
      steps: [
        "Rub your palms together vigorously for 10 seconds to generate warmth.",
        "Close your eyes and gently cup your palms over them — no pressure on the eyeballs.",
        "Breathe deeply and let your visual field go completely dark.",
        "Hold for 3 to 5 minutes. Notice tension releasing in and around your eyes.",
      ],
    },
    {
      title: "Conscious Blinking",
      duration: "1 min · throughout the day",
      durationSeconds: 60,
      description: "We blink 60 to 70 percent less during screen use. Incomplete blinks don't spread tears fully across the eye surface, leading to dry spots, irritation, and blurred vision.",
      steps: [
        "Every hour, pause and blink 10 times — slowly and fully, letting your upper lid fully contact your lower lid.",
        "Pause for 1 to 2 seconds with each blink closed.",
        "Follow this with a gentle eye roll in each direction to distribute tear film.",
      ],
    },
  ];

  const lubrication: EyeCarePlan["lubrication"] = wears === "contacts" ? [
    { tip: "Use preservative-free rewetting drops made for contact wearers", reason: "Standard eye drops can coat your lenses and cause blurry vision or deposit buildup." },
    { tip: "Apply drops before inserting lenses and again mid-afternoon", reason: "Tears under contacts evaporate faster because the lens sits on the tear film layer." },
    { tip: "Follow the 20-20-20 rule strictly — contacts reduce tear flow by ~30%", reason: "Lens material partially blocks the normal oxygen and moisture exchange at the corneal surface." },
    { tip: "Remove contacts at least 1–2 hours before bed", reason: "Night-time rest without lenses lets the ocular surface replenish its lipid and mucin layers." },
    { tip: "Never sleep in daily or monthly lenses unless labelled extended-wear", reason: "Overnight wear raises the risk of microbial keratitis — a painful corneal infection — by 6–8×." },
  ] : wears === "glasses" ? [
    { tip: "Use lubricating artificial tears (preservative-free) if eyes feel dry or gritty", reason: "Glasses don't affect tear film directly, but AC, screens, and low humidity still deplete it." },
    { tip: "Blink fully and deliberately — aim for a full lid contact on each blink", reason: "Reading glasses wearers often tilt their head back, reducing blink completeness unconsciously." },
    { tip: "Consider a desktop humidifier if you work indoors", reason: "Keeping ambient humidity above 40% dramatically reduces evaporative tear loss." },
    { tip: "Warm compresses for 5 minutes each morning", reason: "Heat melts the waxy plugs that block meibomian glands — the glands responsible for the oily tear layer." },
  ] : [
    { tip: "Use preservative-free artificial tears 1–2× daily as a baseline", reason: "Even without correction, prolonged screen use and air conditioning gradually deplete natural tear moisture." },
    { tip: "Warm compresses on closed eyes for 5 minutes each morning", reason: "Heat unclogs the meibomian glands that produce the oily layer preventing tear evaporation." },
    { tip: "Stay hydrated — aim for 8 cups (2L) of water daily", reason: "Tear production drops significantly even at mild dehydration levels." },
    { tip: "Eat foods rich in omega-3 fatty acids (salmon, flaxseed, walnuts)", reason: "Omega-3s are a direct building block for the lipid layer of the tear film." },
  ];

  const correctionCare: EyeCarePlan["correctionCare"] = wears === "glasses" ? [
    { tip: "Clean lenses daily with a microfibre cloth and lens-safe spray — never paper towels, clothing, or breath fog." },
    { tip: "Store glasses in a hard-shell case whenever not in use to prevent frame warping and lens scratches." },
    { tip: "Get frames professionally adjusted every 6–12 months — a misaligned frame forces your eyes to compensate, causing fatigue." },
    { tip: "Ask your optician about anti-reflective coating at your next lens update — it reduces glare from screens and headlights by up to 99%." },
    { tip: "Avoid leaving glasses in a hot car — heat warps both frames and lens coatings permanently." },
  ] : wears === "contacts" ? [
    { tip: "Replace your lens case every 3 months and always use fresh solution — never top off old solution." },
    { tip: "Always wash hands with soap and dry them thoroughly before handling lenses." },
    { tip: "Keep a spare pair of glasses for days with eye irritation or infection — never push through discomfort." },
    { tip: "Never wear contacts in swimming pools, hot tubs, or showers — waterborne bacteria can cause severe corneal infection." },
    { tip: "Stick to the replacement schedule on your lens packaging — protein buildup on overused lenses causes chronic inflammation." },
  ] : [];

  const followUpDays = report.urgency === "high" || report.urgency === "critical" ? 30
    : report.urgency === "moderate" ? 90 : 180;

  return { exercises, lubrication, correctionCare, followUpDays };
}

// ── ElevenLabs narration hook ─────────────────────────────────────────────────

function useNarration() {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef   = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef(0); // incremented on every start/stop to kill stale fetches

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      try { URL.revokeObjectURL(audioRef.current.src); } catch { /* ignore */ }
      audioRef.current = null;
    }
  };

  // Speaks a single `text`. loop=true repeats after 1.2 s; loop=false plays once.
  const start = (text: string, loop = true) => {
    sessionRef.current += 1;
    const session = sessionRef.current;
    stopAudio();
    setPlaying(true);
    setLoading(false);

    const speak = async () => {
      if (session !== sessionRef.current) return;
      setLoading(true);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (session !== sessionRef.current) return;
        if (!res.ok) throw new Error("TTS failed");
        const blob = await res.blob();
        if (session !== sessionRef.current) return;
        const url = URL.createObjectURL(blob);
        stopAudio();
        if (session !== sessionRef.current) { URL.revokeObjectURL(url); return; }
        const audio = new Audio(url);
        audioRef.current = audio;
        setLoading(false);
        audio.onended = () => {
          if (session !== sessionRef.current) return;
          if (loop) {
            setTimeout(() => { if (session === sessionRef.current) speak(); }, 1200);
          } else {
            setPlaying(false);
          }
        };
        audio.onerror = () => {
          setLoading(false);
          if (session !== sessionRef.current) return;
          if (loop) setTimeout(() => { if (session === sessionRef.current) speak(); }, 1200);
          else setPlaying(false);
        };
        await audio.play();
      } catch {
        setLoading(false);
        if (session !== sessionRef.current) return;
        if (loop) setTimeout(() => { if (session === sessionRef.current) speak(); }, 1200);
        else setPlaying(false);
      }
    };

    speak();
  };

  // Plays an array of texts back-to-back with no gap. When all finish, loops
  // from the beginning again until stop() is called.
  // Returns a `finishAfterClip(finalText)` function: when called, the current
  // clip plays to the end, then `finalText` is spoken once and the sequence stops.
  const startSequence = (lines: string[]): ((finalText: string) => void) => {
    let finalTextPending: string | null = null;

    const triggerFinish = (text: string) => { finalTextPending = text; };

    if (!lines.length) return triggerFinish;

    sessionRef.current += 1;
    const session = sessionRef.current;
    stopAudio();
    setPlaying(true);
    setLoading(false);

    let idx = 0;

    const speakNext = async () => {
      if (session !== sessionRef.current) return;

      // If a finish was requested, play the final message once then stop.
      if (finalTextPending !== null) {
        const text = finalTextPending;
        finalTextPending = null;
        setLoading(true);
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          if (session !== sessionRef.current) return;
          if (!res.ok) throw new Error("TTS failed");
          const blob = await res.blob();
          if (session !== sessionRef.current) return;
          const url = URL.createObjectURL(blob);
          stopAudio();
          if (session !== sessionRef.current) { URL.revokeObjectURL(url); return; }
          const audio = new Audio(url);
          audioRef.current = audio;
          setLoading(false);
          audio.onended = () => { if (session === sessionRef.current) setPlaying(false); };
          audio.onerror = () => { setLoading(false); setPlaying(false); };
          await audio.play();
        } catch {
          setLoading(false);
          setPlaying(false);
        }
        return;
      }

      if (idx >= lines.length) idx = 0; // loop
      const text = lines[idx++];
      setLoading(true);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (session !== sessionRef.current) return;
        if (!res.ok) throw new Error("TTS failed");
        const blob = await res.blob();
        if (session !== sessionRef.current) return;
        const url = URL.createObjectURL(blob);
        stopAudio();
        if (session !== sessionRef.current) { URL.revokeObjectURL(url); return; }
        const audio = new Audio(url);
        audioRef.current = audio;
        setLoading(false);
        audio.onended  = () => { if (session === sessionRef.current) speakNext(); };
        audio.onerror  = () => { setLoading(false); if (session === sessionRef.current) speakNext(); };
        await audio.play();
      } catch {
        setLoading(false);
        if (session === sessionRef.current) speakNext();
      }
    };

    speakNext();
    return triggerFinish;
  };

  const stop = () => {
    sessionRef.current += 1;
    stopAudio();
    setPlaying(false);
    setLoading(false);
  };

  useEffect(() => () => {
    sessionRef.current += 1;
    stopAudio();
  }, []);

  return { playing, loading, start, startSequence, stop };
}

// ── Exercise Modal ────────────────────────────────────────────────────────────

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
}

function ExerciseModal({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const { playing, loading, start, startSequence, stop } = useNarration();

  const [phase, setPhase]           = useState<"idle" | "running" | "paused" | "done">("idle");
  const [elapsed, setElapsed]       = useState(0);
  const [activeStep, setActiveStep] = useState(-1);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef    = useRef(0);
  const activeStepRef = useRef(-1);
  const phaseRef      = useRef<"idle" | "running" | "paused" | "done">("idle");

  const total   = ex.durationSeconds;
  const stepDur = total / ex.steps.length;
  const remaining = Math.max(0, total - elapsed);
  const progress  = elapsed / total;

  const R             = 54;
  const CX            = 64;
  const circumference = 2 * Math.PI * R;
  const ringOffset    = circumference * (1 - progress);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Stable refs so the setInterval closure always calls the latest versions.
  const stopRef           = useRef(stop);
  const startSequenceRef  = useRef(startSequence);
  // Holds the `finishAfterClip` handle returned by the running sequence.
  const finishAfterClipRef = useRef<((t: string) => void) | null>(null);
  useEffect(() => { stopRef.current = stop; });
  useEffect(() => { startSequenceRef.current = startSequence; });

  // Build the ordered lines for this exercise.
  const allStepLines = ex.steps.map((s, i) => `Step ${i + 1}. ${s}`);

  // ── Start ──
  const handleStart = () => {
    elapsedRef.current = 0;
    activeStepRef.current = 0;
    setElapsed(0);
    setActiveStep(0);
    setPhase("running");
    finishAfterClipRef.current = startSequenceRef.current(allStepLines);
  };

  // ── Resume (restarts sequence from the current step) ──
  const handleResume = () => {
    setPhase("running");
    const fromStep = activeStepRef.current;
    const resumeLines = [
      ...allStepLines.slice(fromStep),
      ...allStepLines.slice(0, fromStep),
    ];
    finishAfterClipRef.current = startSequenceRef.current(resumeLines);
  };

  // ── Timer tick — drives the visual step indicator only ──
  useEffect(() => {
    if (phase === "running") {
      timerRef.current = setInterval(() => {
        const next = elapsedRef.current + 1;
        elapsedRef.current = next;
        setElapsed(next);

        if (next >= total) {
          clearInterval(timerRef.current!);
          setPhase("done");
          setActiveStep(ex.steps.length);
          // Let the current clip finish, then play the completion message.
          const completionMsg = `Well done! You've completed ${ex.title}. Give your eyes a moment to rest.`;
          if (finishAfterClipRef.current) {
            finishAfterClipRef.current(completionMsg);
            finishAfterClipRef.current = null;
          } else {
            stopRef.current();
          }
          return;
        }

        const newStep = Math.min(Math.floor(next / stepDur), ex.steps.length - 1);
        if (newStep > activeStepRef.current) {
          activeStepRef.current = newStep;
          setActiveStep(newStep);
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePause = () => {
    finishAfterClipRef.current = null;
    setPhase("paused");
    stopRef.current();
  };

  const handleReset = () => {
    finishAfterClipRef.current = null;
    elapsedRef.current = 0;
    activeStepRef.current = -1;
    setPhase("idle");
    setElapsed(0);
    setActiveStep(-1);
    stopRef.current();
  };

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopRef.current();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isDone = phase === "done";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(8,14,26,0.78)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) { handleReset(); onClose(); } }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        style={{ background: "#fff", borderRadius: 22, width: "100%", maxWidth: 500, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}
      >
        {/* Header */}
        <div style={{ background: C.navy, padding: "20px 24px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${C.brand}25`, border: `1px solid ${C.brand}50`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="1.5">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 17, letterSpacing: 2, color: "#fff" }}>{ex.title}</div>
            <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>{ex.duration}</div>
          </div>
          <button onClick={() => { handleReset(); onClose(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Timer + status */}
        <div style={{ background: `linear-gradient(160deg, #0a1628, #0d2040)`, padding: "28px 24px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {/* Ring timer */}
          <div style={{ position: "relative", width: 128, height: 128 }}>
            <svg width="128" height="128" viewBox="0 0 128 128">
              {/* Track */}
              <circle cx={CX} cy={CX} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              {/* Progress */}
              <circle
                cx={CX} cy={CX} r={R} fill="none"
                stroke={isDone ? "#22d46a" : C.brand}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={isDone ? 0 : ringOffset}
                transform="rotate(-90 64 64)"
                style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.4s" }}
              />
            </svg>
            {/* Center display */}
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              {isDone ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22d46a" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <>
                  <span style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: "#fff", lineHeight: 1 }}>{formatTime(remaining)}</span>
                  <span style={{ fontFamily: "'DM Mono'", fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginTop: 2 }}>REMAINING</span>
                </>
              )}
            </div>
          </div>

          {/* Iris voice indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", gap: 3, alignItems: "center", height: 16 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width: 3, borderRadius: 2, background: C.brand,
                  height: (playing && !loading) ? `${5 + i * 3}px` : "3px",
                  animation: (playing && !loading) ? `voicePulse ${0.5 + i * 0.1}s ease infinite alternate` : "none",
                  transition: "height 0.2s",
                }} />
              ))}
            </div>
            <span style={{ fontFamily: "'DM Mono'", fontSize: 9, color: loading ? C.brand : (playing ? C.brand : "rgba(255,255,255,0.3)"), letterSpacing: 1 }}>
              {loading ? "IRIS PREPARING..." : playing ? "IRIS GUIDING" : isDone ? "EXERCISE COMPLETE" : phase === "idle" ? "READY WHEN YOU ARE" : "IRIS STANDING BY"}
            </span>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            {phase === "idle" && (
              <button onClick={handleStart} style={{ background: `linear-gradient(135deg, ${C.brand}, #0090a0)`, border: "none", borderRadius: 10, padding: "12px 32px", cursor: "pointer", color: "#fff", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Start
              </button>
            )}
            {phase === "running" && (
              <button onClick={handlePause} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "10px 24px", cursor: "pointer", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: 1, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                Pause
              </button>
            )}
            {phase === "paused" && (
              <>
                <button onClick={handleResume} style={{ background: `linear-gradient(135deg, ${C.brand}, #0090a0)`, border: "none", borderRadius: 10, padding: "10px 24px", cursor: "pointer", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: 1, display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Resume
                </button>
                <button onClick={handleReset} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 18px", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                  Reset
                </button>
              </>
            )}
            {isDone && (
              <button onClick={handleReset} style={{ background: "rgba(34,212,106,0.15)", border: "1px solid rgba(34,212,106,0.35)", borderRadius: 10, padding: "10px 24px", cursor: "pointer", color: "#22d46a", fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: 1 }}>
                Do Again
              </button>
            )}
          </div>
        </div>

        {/* Steps list */}
        <div style={{ padding: "18px 22px 8px" }}>
          <p style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.dim, lineHeight: 1.6, marginBottom: 16 }}>{ex.description}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {ex.steps.map((step, si) => {
              const isActive = si === activeStep && phase === "running";
              const isDoneStep = (activeStep > si) || isDone;
              return (
                <motion.div
                  key={si}
                  animate={{ background: isActive ? `${C.brand}0f` : "#fff" }}
                  transition={{ duration: 0.3 }}
                  style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, border: isActive ? `1px solid ${C.brand}40` : "1px solid transparent" }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isDoneStep ? C.brand : isActive ? `${C.brand}22` : `${C.brand}0e`,
                    border: `1px solid ${(isActive || isDoneStep) ? C.brand : `${C.brand}30`}`,
                    transition: "all 0.3s",
                  }}>
                    {isDoneStep
                      ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      : <span style={{ fontFamily: "'DM Mono'", fontSize: 9, color: isActive ? C.brand : C.faint, fontWeight: 600 }}>{si + 1}</span>
                    }
                  </div>
                  <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: isDoneStep ? C.dim : C.ink, lineHeight: 1.6, fontWeight: isActive ? 500 : 400 }}>{step}</span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 22px 20px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => { handleReset(); onClose(); }} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 20px", cursor: "pointer", fontFamily: "'DM Sans'", fontSize: 13, color: C.dim }}>
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ icon, title, subtitle, accent = C.brand }: { icon: React.ReactNode; title: string; subtitle?: string; accent?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}15`, border: `1px solid ${accent}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, letterSpacing: 2, color: C.ink }}>{title}</div>
        {subtitle && <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: C.faint, letterSpacing: 1 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CarePlanPage() {
  const router = useRouter();
  const [input, setInput]       = useState<ExamInput | null>(null);
  const [report, setReport]     = useState<ExamReport | null>(null);
  const [daysSince, setDaysSince] = useState<number | null>(null);
  const [activeEx, setActiveEx] = useState<Exercise | null>(null);

  useEffect(() => {
    try {
      const rawInput  = localStorage.getItem("irisExamResults");
      const rawReport = localStorage.getItem("irisExamReport");
      const parsedReport = rawReport ? JSON.parse(rawReport) : null;
      let parsedInput: ExamInput | null = null;

      if (rawInput) {
        const p = JSON.parse(rawInput);
        // New format: { left?: EyeData, right?: EyeData } — normalise into ExamInput
        if (p && (p.left || p.right) && !p.rightEyeAcuity) {
          const toSnellen = (sn: number | null | undefined) => sn != null ? `20/${sn}` : "20/20";
          const sphLabel = (sph: number | null | undefined) => {
            if (sph == null) return undefined;
            if (sph <= -0.5) return `Est. ${sph.toFixed(2)} D`;
            if (sph >= 0.5)  return `Est. +${sph.toFixed(2)} D`;
            return "None detected";
          };
          const cylLabel = (cyl: number | null | undefined) => {
            if (cyl == null) return undefined;
            if (Math.abs(cyl) >= 0.25) return `Est. ${cyl.toFixed(2)} D cyl, ${p.left?.refraction?.axis ?? p.right?.refraction?.axis ?? "?"}° axis`;
            return "None detected";
          };
          const eyeL = p.left;
          const eyeR = p.right;
          const refL = eyeL?.refraction;
          const refR = eyeR?.refraction;
          const sph = refL?.sph ?? refR?.sph;
          const cyl = refL?.cyl ?? refR?.cyl;
          parsedInput = {
            rightEyeAcuity: toSnellen(eyeR?.sn1),
            leftEyeAcuity:  toSnellen(eyeL?.sn1),
            myopiaEstimate:     sph != null && sph < -0.5 ? sphLabel(sph) : "None detected",
            hyperopiaEstimate:  sph != null && sph >  0.5 ? sphLabel(sph) : "None detected",
            astigmatismEstimate: cylLabel(cyl) ?? "None detected",
            age: 0,
            wearsCorrection: "none",
            previousEyeConditions: "None",
          };
        } else {
          parsedInput = p;
        }
      }

      setInput(parsedInput   ?? MOCK_INPUT);
      setReport(parsedReport ?? MOCK_REPORT);
      if (!parsedInput || !parsedReport) {
        console.warn("[CarePlan] Missing localStorage data — using mock fallback.", { parsedInput, parsedReport });
      }
    } catch (e) {
      console.error("[CarePlan] Failed to parse localStorage data:", e);
      setInput(MOCK_INPUT);
      setReport(MOCK_REPORT);
    }
    const last = localStorage.getItem("irisLastScanDate");
    if (last) setDaysSince(Math.floor((Date.now() - parseInt(last)) / 86_400_000));
  }, []);

  if (!input || !report) return null;

  const plan    = buildPlan(input, report);
  const wears   = input.wearsCorrection;
  const topCond = report.diagnoses[0]?.condition ?? null;

  const followUpMsg = daysSince !== null && daysSince > 0
    ? `You scanned ${daysSince} day${daysSince !== 1 ? "s" : ""} ago${topCond ? ` and your screening noted ${topCond}` : ""}. How are your eyes feeling now? If symptoms have changed, it may be a good time to book a follow-up exam.`
    : topCond
      ? `This is your first scan. Your screening noted signs consistent with ${topCond}. I'd recommend setting a reminder to re-check in ${plan.followUpDays} days to track any changes.`
      : "This is your first scan with Iris. Set a reminder to re-check in 6 months as a healthy baseline.";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes voicePulse { from { height: 4px; } to { height: 20px; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fade-up { animation: fadeUp 0.5s ease both; }
        .care-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .ex-card { cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
        .ex-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(13,27,46,0.12) !important; }
        @media (max-width: 900px) {
          .care-grid { grid-template-columns: 1fr !important; }
          .care-header-pad { padding: 20px 20px !important; }
          .care-body-pad { padding: 28px 20px !important; }
        }
      `}</style>

      <div style={{ background: C.bg, minHeight: "100vh", color: C.ink }}>

        {/* ── Header ── */}
        <div className="fade-up care-header-pad" style={{ background: C.navy, borderBottom: "1px solid #1e2d45", padding: "28px 60px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: 40, top: -10, fontFamily: "'Bebas Neue'", fontSize: 180, color: "rgba(255,255,255,0.03)", lineHeight: 1, userSelect: "none" }}>CARE</div>
          <button onClick={() => { sessionStorage.setItem("irisIntroSeen", "1"); router.back(); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 10, color: "rgba(255,255,255,0.75)", fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: 1, padding: "7px 14px", cursor: "pointer" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            HOME
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span style={{ fontFamily: "'DM Mono'", fontSize: 10, color: C.brand, letterSpacing: 2 }}>IRIS EYE CARE PLAN</span>
          </div>
          <div style={{ fontFamily: "'Instrument Serif'", fontSize: 38, color: "#fff", lineHeight: 1.1, marginBottom: 8 }}>Personalised Care for Your Eyes</div>
          <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: "rgba(255,255,255,0.5)", maxWidth: 560 }}>
            Based on your screening data{wears !== "none" ? ` and the fact that you wear ${wears}` : ""}, here's what Iris recommends. Tap any exercise to get a guided walkthrough with voice narration.
          </p>
        </div>

        {/* ── Body ── */}
        <div className="fade-up care-body-pad" style={{ padding: "48px 60px", maxWidth: 1160, margin: "0 auto" }}>

          {/* ── Follow-Up Reminder ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ background: `linear-gradient(135deg, ${C.navy}, #0f2040)`, borderRadius: 18, border: `1px solid ${C.brand}35`, padding: "28px 32px", marginBottom: 40, display: "flex", gap: 20, alignItems: "flex-start" }}
          >
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${C.brand}20`, border: `1px solid ${C.brand}45`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="1.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Bebas Neue'", fontSize: 16, letterSpacing: 2, color: "#fff" }}>Iris Says</span>
                <span style={{ fontFamily: "'DM Mono'", fontSize: 9, color: `${C.brand}80`, letterSpacing: 1, background: `${C.brand}15`, border: `1px solid ${C.brand}30`, borderRadius: 4, padding: "2px 7px" }}>FOLLOW-UP REMINDER</span>
                {daysSince !== null && daysSince > 0 && (
                  <span style={{ fontFamily: "'DM Mono'", fontSize: 9, color: C.brand, background: `${C.brand}15`, border: `1px solid ${C.brand}30`, borderRadius: 4, padding: "2px 7px" }}>{daysSince}D AGO</span>
                )}
              </div>
              <p style={{ fontFamily: "'Instrument Serif'", fontSize: 17, color: "rgba(255,255,255,0.85)", lineHeight: 1.75, marginBottom: 14 }}>"{followUpMsg}"</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span style={{ fontFamily: "'DM Mono'", fontSize: 10, color: C.brand }}>Recommended follow-up: {plan.followUpDays} days</span>
              </div>
            </div>
          </motion.div>

          {/* ── Eye Exercises ── */}
          <section style={{ marginBottom: 48 }}>
            <SectionLabel
              title="Eye Exercises"
              subtitle={`${plan.exercises.length} exercises · tap any card for a guided walkthrough`}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
            />
            <div className="care-grid">
              {plan.exercises.map((ex, i) => (
                <motion.div
                  key={i}
                  className="ex-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  onClick={() => setActiveEx(ex)}
                  style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 2px 12px rgba(13,27,46,0.05)" }}
                >
                  <div style={{ background: C.navy, padding: "16px 22px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${C.brand}25`, border: `1px solid ${C.brand}50`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontFamily: "'DM Mono'", fontSize: 11, color: C.brand, fontWeight: 600 }}>{i + 1}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: "#fff" }}>{ex.title}</div>
                      <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginTop: 2 }}>{ex.duration}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, background: `${C.brand}20`, border: `1px solid ${C.brand}40`, borderRadius: 6, padding: "4px 8px" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                      <span style={{ fontFamily: "'DM Mono'", fontSize: 8, color: C.brand, letterSpacing: 1 }}>GUIDE</span>
                    </div>
                  </div>
                  <div style={{ padding: "16px 22px" }}>
                    <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.dim, lineHeight: 1.65, marginBottom: 14 }}>{ex.description}</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {ex.steps.map((_, si) => (
                        <div key={si} style={{ width: 24, height: 24, borderRadius: "50%", background: `${C.brand}10`, border: `1px solid ${C.brand}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontFamily: "'DM Mono'", fontSize: 9, color: C.brand }}>{si + 1}</span>
                        </div>
                      ))}
                      <span style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.faint, alignSelf: "center", marginLeft: 4 }}>{ex.steps.length} steps</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── Lubrication & Comfort ── */}
          <section style={{ marginBottom: 48 }}>
            <SectionLabel
              title="Lubrication & Comfort"
              subtitle={wears === "contacts" ? "Contact lens wearers" : wears === "glasses" ? "Glasses wearers" : "Unaided vision"}
              accent="#60c8f5"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60c8f5" strokeWidth="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>}
            />
            <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.border}`, padding: "8px 0", boxShadow: "0 2px 12px rgba(13,27,46,0.05)" }}>
              {plan.lubrication.map((item, i) => (
                <div key={i} style={{ padding: "18px 26px", borderBottom: i < plan.lubrication.length - 1 ? "1px solid #f0f4fb" : "none", display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#60c8f5", marginTop: 6, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 500, color: C.ink, marginBottom: 4 }}>{item.tip}</div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.dim, lineHeight: 1.6 }}>{item.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Correction Care ── */}
          {plan.correctionCare.length > 0 && (
            <section style={{ marginBottom: 48 }}>
              <SectionLabel
                title={wears === "glasses" ? "Glasses Care" : "Contact Lens Care"}
                subtitle="Daily maintenance checklist"
                accent="#f5c842"
                icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f5c842" strokeWidth="1.5">
                    {wears === "glasses"
                      ? <><path d="M2 8h20M5 8a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4"/><line x1="12" y1="8" x2="12" y2="12"/></>
                      : <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></>
                    }
                  </svg>
                }
              />
              <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.border}`, padding: "8px 0", boxShadow: "0 2px 12px rgba(13,27,46,0.05)" }}>
                {plan.correctionCare.map((item, i) => (
                  <div key={i} style={{ padding: "16px 26px", borderBottom: i < plan.correctionCare.length - 1 ? "1px solid #f0f4fb" : "none", display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f5c842" strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 3 }}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.ink, lineHeight: 1.65 }}>{item.tip}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Westlake Eye Specialists – Sponsor ── */}
          <section style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontFamily: "'DM Mono'", fontSize: 13, color: C.faint, letterSpacing: 3, whiteSpace: "nowrap", fontWeight: 600 }}>SPONSORED PARTNER</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <div style={{ background: "#fff", borderRadius: 18, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 2px 16px rgba(13,27,46,0.07)" }}>
              {/* Brand header */}
              <div style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d2540 60%, #0a2035 100%)", padding: "24px 28px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60c8f5" strokeWidth="1.5">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 18, letterSpacing: 3, color: "#fff", marginBottom: 2 }}>Westlake Eye Specialists</div>
                  <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "rgba(255,255,255,0.45)", letterSpacing: 1 }}>AUSTIN, TEXAS · PREMIER EYE CARE</div>
                </div>
                <a
                  href="https://westlakeeyes.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "8px 16px", textDecoration: "none", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#fff", letterSpacing: 1, whiteSpace: "nowrap" }}
                >
                  Visit Site →
                </a>
              </div>

              {/* Available solutions */}
              <div style={{ padding: "22px 28px" }}>
                <div style={{ fontFamily: "'DM Mono'", fontSize: 10, color: C.faint, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Available Solutions</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="sponsor-grid">
                  {[
                    {
                      name: "LASIK Surgery",
                      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60c8f5" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/></svg>,
                      tagline: "Laser vision correction",
                      desc: "Permanently correct myopia, hyperopia, and astigmatism with blade-free laser technology. Most patients achieve 20/20 or better.",
                      accent: "#60c8f5",
                    },
                    {
                      name: "Cataract Surgery",
                      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5c842" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12s1.5-3 4-3 4 3 4 3-1.5 3-4 3-4-3-4-3z"/></svg>,
                      tagline: "Advanced lens replacement",
                      desc: "Remove clouded lenses causing blurry or dim vision and replace them with premium intraocular lenses for crisp, clear sight.",
                      accent: "#f5c842",
                    },
                    {
                      name: "Comprehensive Eye Screenings",
                      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
                      tagline: "Full diagnostic workup",
                      desc: "Thorough vision and eye health evaluation including retinal imaging, pressure testing, and personalised prescription review.",
                      accent: "#a78bfa",
                    },
                    {
                      name: "Dry Eye Treatment",
                      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>,
                      tagline: "Relief for chronic symptoms",
                      desc: "Targeted treatments including LipiFlow, prescription drops, and meibomian gland therapy to restore lasting comfort.",
                      accent: "#34d399",
                    },
                  ].map((s, i) => (
                    <div key={i} style={{ background: C.bg, borderRadius: 12, border: `1px solid ${C.border}`, padding: "16px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: `${s.accent}15`, border: `1px solid ${s.accent}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {s.icon}
                        </div>
                        <div>
                          <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, color: C.ink }}>{s.name}</div>
                          <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: s.accent, letterSpacing: 1 }}>{s.tagline.toUpperCase()}</div>
                        </div>
                      </div>
                      <p style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.dim, lineHeight: 1.6 }}>{s.desc}</p>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 18, padding: "14px 18px", background: `${C.brand}08`, border: `1px solid ${C.brand}25`, borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="1.5" style={{ flexShrink: 0 }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.ink, fontWeight: 500 }}>Located in Austin, Texas</span>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.dim }}> · Serving patients across Austin</span>
                  </div>
                  <a
                    href="https://westlakeeyes.com/eye-care-services/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: `linear-gradient(135deg, ${C.brand}, #0090a0)`, border: "none", borderRadius: 8, padding: "9px 18px", textDecoration: "none", fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 2, color: "#fff", whiteSpace: "nowrap" }}
                  >
                    Services
                  </a>
                </div>
              </div>
            </div>
            <style>{`.sponsor-grid { @media (max-width: 680px) { grid-template-columns: 1fr !important; } }`}</style>
          </section>

          {/* ── Footer ── */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <p style={{ fontFamily: "'DM Mono'", fontSize: 10, color: C.faint, lineHeight: 1.7, display: "flex", gap: 8, alignItems: "flex-start", maxWidth: 560 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              This care plan is AI-generated guidance only and does not constitute medical advice. Always consult a qualified eye care professional.
            </p>
            <div style={{ fontFamily: "'DM Mono'", fontSize: 11, color: C.faint, letterSpacing: "0.1em" }}>HACKAI © 2026</div>
          </div>
        </div>
      </div>

      {/* ── Exercise Modal ── */}
      <AnimatePresence>
        {activeEx && <ExerciseModal ex={activeEx} onClose={() => setActiveEx(null)} />}
      </AnimatePresence>
    </>
  );
}
