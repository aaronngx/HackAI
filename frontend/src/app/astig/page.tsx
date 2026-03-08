export const metadata = {
  title: "Astigmatism Screening | HackAI",
  description: "Webcam-based astigmatism and refraction screening.",
};

export default function AstigPage() {
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');`}</style>

      {/* Back button overlay */}
      <a
        href="/"
        style={{
          position: "fixed",
          top: 16,
          left: 20,
          zIndex: 9999,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          background: "rgba(8,14,26,0.75)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 10,
          padding: "7px 14px",
          color: "rgba(255,255,255,0.75)",
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          letterSpacing: 1,
          textDecoration: "none",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        ← HOME
      </a>

      <iframe
        src="/astig-test.html"
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none" }}
        allow="camera"
        title="Astigmatism Screening"
      />
    </>
  );
}
