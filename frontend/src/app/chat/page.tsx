"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "user" | "model";

interface Message {
  role: Role;
  text: string;
}

// ── Gemini API call ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Iris, a friendly and knowledgeable AI eye health assistant built by HackAI. 
You help users understand eye conditions, explain what their screening results mean in simple terms, 
answer general questions about eye health, and guide them toward professional care when appropriate.

Rules:
- Always speak in plain, friendly language — no medical jargon unless you explain it.
- Never diagnose. Always phrase things as estimates or possibilities.
- Recommend consulting a licensed eye care professional for anything clinical.
- Keep answers concise (2–4 sentences for simple questions, a bit more for complex ones).
- If someone asks about their IRIS report, help them interpret it without being alarmist.`;

async function sendMessage(
  history: { role: Role; parts: { text: string }[] }[],
  userText: string
): Promise<string> {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemPrompt: SYSTEM_PROMPT,
      history,
      parts: [{ text: userText }],
    }),
  });
  if (!res.ok) throw new Error("Failed to reach AI");
  const data = await res.json();
  return data.text ?? "Sorry, I couldn't generate a response. Please try again.";
}

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "What does myopia mean?",
  "How is astigmatism different from nearsightedness?",
  "What should I do if I notice blurry vision?",
  "Can screen time damage my eyes?",
  "How often should I get an eye exam?",
];

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "10px 14px" }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          style={{ width: 7, height: 7, borderRadius: "50%", background: "#00c4d4" }}
          animate={{ y: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const historyForApi = () =>
    messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: trimmed }]);
    setLoading(true);
    try {
      const reply = await sendMessage(historyForApi(), trimmed);
      setMessages(prev => [...prev, { role: "model", text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "model", text: "Something went wrong. Please check your connection and try again." }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f0f5fb; font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .msg-in { animation: fadeUp 0.3s ease both; }
        textarea:focus { outline: none; }
        textarea { resize: none; }
        .suggestion-btn:hover { background: #e2eaf6 !important; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#f0f5fb" }}>

        {/* ── Header ── */}
        <div style={{ background: "#0d1526", borderBottom: "1px solid #1e2d45", padding: "16px 28px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <button
            onClick={() => router.back()}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontFamily: "'DM Mono', monospace", padding: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.12)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(0,196,212,0.15)", border: "1px solid rgba(0,196,212,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00c4d4" strokeWidth="1.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 17, letterSpacing: 3, color: "#ffffff" }}>IRIS AI</div>
              <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>EYE HEALTH ASSISTANT</div>
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22d46a" }} />
            <span style={{ fontFamily: "'DM Mono'", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>Online</span>
          </div>
        </div>

        {/* ── Message list ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 760, width: "100%", margin: "0 auto", alignSelf: "stretch" }}>

          {/* Empty state */}
          {isEmpty && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{ textAlign: "center", marginTop: 48 }}
            >
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,196,212,0.1)", border: "1px solid rgba(0,196,212,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00c4d4" strokeWidth="1.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </div>
              <div style={{ fontFamily: "'Instrument Serif'", fontSize: 26, color: "#0d1b2e", marginBottom: 8 }}>Hi, I'm Iris</div>
              <p style={{ fontFamily: "'DM Sans'", fontSize: 14, color: "#6b84a0", maxWidth: 380, margin: "0 auto 32px", lineHeight: 1.6 }}>
                Ask me anything about your eye health, how to read your report, or what common eye conditions mean.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    className="suggestion-btn"
                    onClick={() => submit(s)}
                    style={{ background: "#edf2fb", border: "1px solid #ccd8ee", borderRadius: 20, padding: "9px 16px", fontSize: 12, color: "#2c4a6e", cursor: "pointer", fontFamily: "'DM Sans'", transition: "background 0.15s" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Messages */}
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <motion.div
                  key={i}
                  className="msg-in"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", gap: 10, alignItems: "flex-end" }}
                >
                  {!isUser && (
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(0,196,212,0.12)", border: "1px solid rgba(0,196,212,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c4d4" strokeWidth="1.5">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    </div>
                  )}
                  <div style={{
                    maxWidth: "72%",
                    padding: "11px 16px",
                    borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: isUser ? "#0d1526" : "#ffffff",
                    color: isUser ? "#ffffff" : "#0d1b2e",
                    fontSize: 14,
                    lineHeight: 1.65,
                    fontFamily: "'DM Sans'",
                    boxShadow: isUser ? "none" : "0 2px 12px rgba(0,0,0,0.07)",
                    border: isUser ? "none" : "1px solid #e4ecf6",
                    whiteSpace: "pre-wrap",
                  }}>
                    {msg.text}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Typing indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: "flex", alignItems: "flex-end", gap: 10 }}
            >
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(0,196,212,0.12)", border: "1px solid rgba(0,196,212,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c4d4" strokeWidth="1.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </div>
              <div style={{ background: "#ffffff", borderRadius: "18px 18px 18px 4px", border: "1px solid #e4ecf6", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                <TypingDots />
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div style={{ flexShrink: 0, background: "#ffffff", borderTop: "1px solid #e0e8f4", padding: "14px 20px 20px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1, background: "#f4f7fd", border: "1px solid #ccd8ee", borderRadius: 16, padding: "10px 16px", display: "flex", alignItems: "flex-end", gap: 8 }}>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={handleKey}
                placeholder="Ask Iris about your eye health…"
                style={{ flex: 1, background: "none", border: "none", color: "#0d1b2e", fontSize: 14, fontFamily: "'DM Sans'", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}
              />
            </div>
            <motion.button
              onClick={() => submit(input)}
              whileTap={{ scale: 0.92 }}
              disabled={!input.trim() || loading}
              style={{
                width: 44, height: 44, borderRadius: "50%", border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
                background: input.trim() && !loading ? "linear-gradient(135deg, #00c4d4, #0090a0)" : "#e0e8f4",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !loading ? "#fff" : "#9ab0cc"} strokeWidth="2.2">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </motion.button>
          </div>
          <p style={{ textAlign: "center", fontFamily: "'DM Mono'", fontSize: 9, color: "#b0c0d8", marginTop: 10, letterSpacing: 0.5 }}>
            Iris provides general information only — not medical advice. Always consult a professional.
          </p>
        </div>

      </div>
    </>
  );
}
