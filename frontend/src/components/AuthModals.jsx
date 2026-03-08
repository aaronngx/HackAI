"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const VISION_CORRECTION_OPTIONS = ["glasses", "contacts", "neither", "both", "not sure"];
const EYE_CONDITION_OPTIONS = ["myopia", "atigmatism", "dry eyes", "other"];

export default function AuthModals({ initialPanel = null, onClose }) {
  const [activePanel, setActivePanel] = useState(initialPanel);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    age: "",
    visionCorrection: "",
    eyeConditions: [],
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      setError("");
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        age: "",
        visionCorrection: "",
        eyeConditions: [],
      });
      setActivePanel("login");
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setLoginEmail("");
      setLoginPassword("");
      onClose();
      window.location.reload();
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {activePanel && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => {
            onClose();
            setActivePanel(null);
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "#000",
            zIndex: 140,
          }}
        />
      )}

      <motion.div
        initial={
          activePanel
            ? {
                top: "60px",
                right: "32px",
                width: "400px",
                height: "0px",
                opacity: 0,
                borderRadius: 16,
              }
            : false
        }
        animate={
          activePanel
            ? {
                top: "0px",
                right: "0px",
                width: "100vw",
                height: "100vh",
                opacity: 1,
                borderRadius: 0,
              }
            : false
        }
        exit={{
          top: "60px",
          right: "32px",
          width: "400px",
          height: "0px",
          opacity: 0,
          borderRadius: 16,
        }}
        transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
        style={{
          position: "fixed",
          zIndex: 150,
          background: "#000",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={activePanel ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.3 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "14px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(12px)",
          }}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setActivePanel(null);
              onClose();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10,
              padding: "8px 16px",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Home
          </motion.button>
          <span style={{ color: "#666", fontSize: 13 }}>
            {activePanel === "login" ? "Login" : "Register"}
          </span>
        </motion.div>

        <div
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 24px",
          }}
        >
          <div style={{ width: "100%", maxWidth: 500 }}>
            {activePanel === "register" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h1
                  style={{
                    color: "#fff",
                    fontSize: "clamp(32px, 5vw, 48px)",
                    fontWeight: 700,
                    marginBottom: 12,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Create Account
                </h1>
                <p style={{ color: "#aaa", fontSize: 15, marginBottom: 32 }}>
                  Join HackAI to access eye health features
                </p>

                {error && (
                  <div
                    style={{
                      background: "rgba(255,0,0,0.1)",
                      border: "1px solid rgba(255,0,0,0.3)",
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 20,
                      color: "#ff6b6b",
                      fontSize: 13,
                    }}
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={{ color: "#aaa", fontSize: 12, display: "block", marginBottom: 6 }}>First Name</label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        color: "#fff",
                        fontSize: 14,
                        boxSizing: "border-box",
                      }}
                      placeholder="John"
                    />
                  </div>

                  <div>
                    <label style={{ color: "#aaa", fontSize: 12, display: "block", marginBottom: 6 }}>Last Name</label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        color: "#fff",
                        fontSize: 14,
                        boxSizing: "border-box",
                      }}
                      placeholder="Doe"
                    />
                  </div>

                  <div>
                    <label style={{ color: "#aaa", fontSize: 12, display: "block", marginBottom: 6 }}>Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        color: "#fff",
                        fontSize: 14,
                        boxSizing: "border-box",
                      }}
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label style={{ color: "#aaa", fontSize: 12, display: "block", marginBottom: 6 }}>Password</label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        color: "#fff",
                        fontSize: 14,
                        boxSizing: "border-box",
                      }}
                      placeholder="••••••••"
                    />
                  </div>

                  <div>
                    <label style={{ color: "#aaa", fontSize: 12, display: "block", marginBottom: 6 }}>
                      What&apos;s your age?
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      required
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        color: "#fff",
                        fontSize: 14,
                        boxSizing: "border-box",
                      }}
                      placeholder="e.g. 24"
                    />
                  </div>

                  <div>
                    <label style={{ color: "#aaa", fontSize: 12, display: "block", marginBottom: 6 }}>
                      Do you wear glasses or contacts?
                    </label>
                    <select
                      required
                      value={formData.visionCorrection}
                      onChange={(e) => setFormData({ ...formData, visionCorrection: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        color: "#fff",
                        fontSize: 14,
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="" disabled>
                        Select one
                      </option>
                      {VISION_CORRECTION_OPTIONS.map((option) => (
                        <option key={option} value={option} style={{ color: "#111" }}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ color: "#aaa", fontSize: 12, display: "block", marginBottom: 8 }}>
                      Any known eye conditions?
                    </label>
                    <div style={{ display: "grid", gap: 8 }}>
                      {EYE_CONDITION_OPTIONS.map((condition) => (
                        <label
                          key={condition}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            color: "#ddd",
                            fontSize: 13,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={formData.eyeConditions.includes(condition)}
                            onChange={(e) => {
                              const nextConditions = e.target.checked
                                ? [...formData.eyeConditions, condition]
                                : formData.eyeConditions.filter((item) => item !== condition);
                              setFormData({ ...formData, eyeConditions: nextConditions });
                            }}
                          />
                          {condition}
                        </label>
                      ))}
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={loading}
                    style={{
                      marginTop: 8,
                      padding: "14px 36px",
                      background: "#fff",
                      color: "#000",
                      border: "none",
                      borderRadius: 10,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? "Creating..." : "Create Account"}
                  </motion.button>
                </form>

                <p style={{ color: "#666", fontSize: 14, marginTop: 20, textAlign: "center" }}>
                  Already have an account?{" "}
                  <button
                    onClick={() => setActivePanel("login")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Login
                  </button>
                </p>
              </motion.div>
            )}

            {activePanel === "login" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h1
                  style={{
                    color: "#fff",
                    fontSize: "clamp(32px, 5vw, 48px)",
                    fontWeight: 700,
                    marginBottom: 12,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Welcome Back
                </h1>
                <p style={{ color: "#aaa", fontSize: 15, marginBottom: 32 }}>
                  Sign in to your HackAI account
                </p>

                {error && (
                  <div
                    style={{
                      background: "rgba(255,0,0,0.1)",
                      border: "1px solid rgba(255,0,0,0.3)",
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 20,
                      color: "#ff6b6b",
                      fontSize: 13,
                    }}
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={{ color: "#aaa", fontSize: 12, display: "block", marginBottom: 6 }}>Email</label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        color: "#fff",
                        fontSize: 14,
                        boxSizing: "border-box",
                      }}
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label style={{ color: "#aaa", fontSize: 12, display: "block", marginBottom: 6 }}>Password</label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        color: "#fff",
                        fontSize: 14,
                        boxSizing: "border-box",
                      }}
                      placeholder="••••••••"
                    />
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={loading}
                    style={{
                      marginTop: 8,
                      padding: "14px 36px",
                      background: "#fff",
                      color: "#000",
                      border: "none",
                      borderRadius: 10,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? "Signing in..." : "Sign In"}
                  </motion.button>
                </form>

                <p style={{ color: "#666", fontSize: 14, marginTop: 20, textAlign: "center" }}>
                  Don&apos;t have an account?{" "}
                  <button
                    onClick={() => {
                      setError("");
                      setActivePanel("register");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Register
                  </button>
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
