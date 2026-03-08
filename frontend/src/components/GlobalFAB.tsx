"use client";
import { useRouter } from "next/navigation";

export default function GlobalFAB() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/chat")}
      aria-label="Open AI chat"
      style={{
        position: "fixed",
        right: 72,
        bottom: 120,
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "#ffffff",
        border: "none",
        boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1500,
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 28px rgba(0,0,0,0.24)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.18)";
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
  );
}
