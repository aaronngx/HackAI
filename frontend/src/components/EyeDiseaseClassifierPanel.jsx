"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

export default function EyeDiseaseClassifierPanel({ onBack }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  async function handleAnalyze(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!selectedFile) {
      setError("Please choose an eye image first.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const res = await fetch("/api/eye-disease/classify", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to analyze image.");
        return;
      }

      setResult(data.result || null);
    } catch (err) {
      setError(err.message || "Failed to analyze image.");
    } finally {
      setLoading(false);
    }
  }

  const showSplitLayout = loading || Boolean(result);

  return (
    <div
      style={{
        height: "100%",
        overflow: "auto",
        padding: "24px 20px 36px",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => (onBack ? onBack() : window.history.back())}
            style={{
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 10,
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Back
          </motion.button>
        </div>

        <div>
          <h2
            style={{
              margin: 0,
              color: "#fff",
              fontSize: "clamp(26px, 4vw, 42px)",
              letterSpacing: "-0.02em",
            }}
          >
            Eye Disease Detect
          </h2>
          <p style={{ marginTop: 10, color: "#aaa", lineHeight: 1.6 }}>
            Detect eye disease by inserting an image.
          </p>
        </div>

        {!showSplitLayout && (
          <form
            onSubmit={handleAnalyze}
            style={{
              display: "grid",
              gap: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 14,
              padding: 16,
              maxWidth: 720,
            }}
          >
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.gif"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              style={{
                color: "#ddd",
                fontSize: 13,
              }}
            />

            {previewUrl && (
              <Image
                src={previewUrl}
                alt="Eye preview"
                width={1200}
                height={800}
                unoptimized
                style={{
                  width: "100%",
                  maxHeight: 320,
                  objectFit: "contain",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.25)",
                }}
              />
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              style={{
                width: "fit-content",
                padding: "12px 18px",
                border: "none",
                borderRadius: 10,
                background: "#fff",
                color: "#000",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Analyzing..." : "Analyze Image"}
            </motion.button>
          </form>
        )}

        {showSplitLayout && (
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            }}
          >
            <form
              onSubmit={handleAnalyze}
              style={{
                display: "grid",
                gap: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14,
                padding: 16,
                alignContent: "start",
              }}
            >
              <div style={{ color: "#ddd", fontWeight: 600, fontSize: 14 }}>
                Insert Eye Image
              </div>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.gif"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                style={{ color: "#ddd", fontSize: 13 }}
              />

              {previewUrl && (
                <Image
                  src={previewUrl}
                  alt="Eye preview"
                  width={1200}
                  height={800}
                  unoptimized
                  style={{
                    width: "100%",
                    maxHeight: 320,
                    objectFit: "contain",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(0,0,0,0.25)",
                  }}
                />
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                style={{
                  width: "fit-content",
                  padding: "12px 18px",
                  border: "none",
                  borderRadius: 10,
                  background: "#fff",
                  color: "#000",
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "Analyzing..." : "Analyze Again"}
              </motion.button>
            </form>

            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14,
                padding: 18,
                display: "grid",
                gap: 10,
                alignContent: "start",
              }}
            >
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>
                Report Card
              </div>

              {loading && (
                <div style={{ color: "#aaa", lineHeight: 1.6 }}>
                  Analyzing eye image and preparing report...
                </div>
              )}

              {!loading && error && (
                <div style={{ color: "#ff8d8d", lineHeight: 1.6 }}>{error}</div>
              )}

              {!loading && result && (
                <>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>
                    {result.short_report || "Analysis complete"}
                  </div>
                  <div style={{ color: "#ddd" }}>
                    <strong>Likely disease:</strong> {result.likely_disease || "N/A"}
                  </div>
                  <div style={{ color: "#ddd" }}>
                    <strong>Confidence:</strong> {result.confidence || "N/A"}
                  </div>
                  <div style={{ color: "#ddd" }}>
                    <strong>Visible findings:</strong>{" "}
                    {Array.isArray(result.visible_findings)
                      ? result.visible_findings.filter(Boolean).join(", ")
                      : String(result.visible_findings || "N/A")}
                  </div>
                  <div style={{ color: "#aaa" }}>
                    <strong>Medical disclaimer:</strong>{" "}
                    {result.medical_disclaimer || "AI output is for informational use only."}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {!showSplitLayout && error && (
          <div
            style={{
              border: "1px solid rgba(255, 80, 80, 0.45)",
              color: "#ff8d8d",
              borderRadius: 12,
              padding: 12,
              background: "rgba(120, 0, 0, 0.16)",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
