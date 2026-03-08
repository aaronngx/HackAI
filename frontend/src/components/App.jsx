"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Starsfield from "./Starsfield.js";
import PanelOverlay from "./PanelOverlay.jsx";
import AppleHelloEffect from "./AppleHelloEffect.js";

const logo = "/logo.png";
const utd = "/utd.png";

const featureCards = [
  {
    title: "Eye Disease Detect",
    image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&auto=format&fit=crop",
  },
  {
    title: "Eyes Exam",
    image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&auto=format&fit=crop",
  },
  {
    title: "Report",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop",
  },
  {
    title: "Doctor Find",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=800&auto=format&fit=crop",
  },
];

function FeatureCard({ card, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        width: 300,
        height: 400,
        borderRadius: 32,
        overflow: "hidden",
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <motion.div
        animate={{ scale: hovered ? 1.06 : 1 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${card.image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: 28,
          right: 28,
        }}
      >
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          {card.title}
        </div>
        <motion.div
          animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 6 }}
          transition={{ duration: 0.25 }}
          style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 6, fontWeight: 500 }}
        >
          Tap to explore →
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [clicked, setClicked] = useState(false);
  const [activePanelIndex, setActivePanelIndex] = useState(null);
  const [originRect, setOriginRect] = useState(null);

  const handleHeroClick = () => {
    setClicked(true);
  };

  return (
    <div style={{ background: "#000", overflowX: "hidden" }}>
      <AnimatePresence>
        {!clicked && (
          <motion.div
            key="hero"
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            style={{ position: "fixed", inset: 0, zIndex: 50 }}
          >
            <Starsfield
              starCount={150}
              speed={0.2}
              trail={0.3}
              twinkle={0.3}
              starSize={3}
              bgColor="#000000"
              starColor="#ffffff"
              starImage={logo}
              preserveImageColors
            />
            <div style={{ position: "absolute", inset: 0 }}>
              <Starsfield
                starCount={150}
                speed={0.2}
                trail={0.3}
                twinkle={0.3}
                starSize={3}
                bgColor="rgba(0,0,0,0)"
                starColor="#ffffff"
                starImage={utd}
                preserveImageColors
              />
            </div>

            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                gap: 32,
              }}
            >
              <motion.div
                animate={clicked ? { scale: 2.5, opacity: 0 } : { scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                onClick={handleHeroClick}
                style={{ cursor: "pointer" }}
              />

              <AnimatePresence>
                {!clicked && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    style={{ pointerEvents: "none" }}
                  >
                    <AppleHelloEffect
                      size={120}
                      duration={1.2}
                      strokeWidth={10}
                      strokeColor="rgba(255,255,255,0.85)"
                      autoPlay={true}
                      loop={false}
                      onAnimationComplete={handleHeroClick}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {!clicked && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4, y: [0, 8, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 1.5, duration: 1.5, repeat: Infinity }}
                  style={{
                    position: "absolute",
                    bottom: 32,
                    left: "50%",
                    transform: "translateX(-50%)",
                    color: "#fff",
                    fontSize: 22,
                    zIndex: 10,
                  }}
                >
                  ↓
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Description Section */}
      <div
        style={{
          width: "100vw",
          minHeight: "100vh",
          background: "#000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 24px",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={{ maxWidth: 760, textAlign: "center" }}
        >
          <p style={{ color: "#888", fontSize: 12, letterSpacing: "0.25em", marginBottom: 20, textTransform: "uppercase" }}>
            Lorem ipsum dolor
          </p>
          <h2
            style={{
              color: "#fff",
              fontSize: "clamp(32px, 5vw, 64px)",
              fontWeight: 700,
              lineHeight: 1.1,
              marginBottom: 28,
              letterSpacing: "-0.02em",
            }}
          >
            Lorem ipsum dolor sit amet consectetur.
          </h2>
          <p
            style={{
              color: "#aaa",
              fontSize: "clamp(15px, 2vw, 19px)",
              lineHeight: 1.7,
            }}
          >
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>
        </motion.div>
      </div>

      {/* Feature Cards */}
      <div
        style={{
          width: "100vw",
          background: "#000",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "80px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {featureCards.map((card, i) => (
            <FeatureCard
              key={i}
              card={card}
              onClick={(e) => {
                setOriginRect(e.currentTarget.getBoundingClientRect());
                setActivePanelIndex(i);
              }}
            />
          ))}
        </div>
      </div>

      {/* Panel Overlay */}
      <AnimatePresence>
        {activePanelIndex !== null && (
          <PanelOverlay
            key={activePanelIndex}
            panelIndex={activePanelIndex}
            originRect={originRect}
            onClose={() => setActivePanelIndex(null)}
          />
        )}
      </AnimatePresence>

      {/* Message dropdown */}
      <AnimatePresence>
      </AnimatePresence>

      {/* Fixed social menu is in the global layout */}

      {/* Footer */}
      <div
        style={{
          padding: "32px",
          textAlign: "center",
          color: "#444",
          fontSize: 12,
          letterSpacing: "0.1em",
          background: "#000",
        }}
      >
        HACKAI © 2026
      </div>
    </div>
  );
}
