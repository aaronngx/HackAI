"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Starsfield from "./Starsfield.js";
import SocialMenu from "./SocialMenu.js";
import PanelOverlay from "./PanelOverlay.jsx";
import MessageDropdown from "./MessageButton.jsx";
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
  const [messageOpen, setMessageOpen] = useState(false);

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
        {messageOpen && <MessageDropdown onClose={() => setMessageOpen(false)} />}
      </AnimatePresence>

      {/* Fixed social menu */}
      <div style={{ position: "fixed", right: 32, bottom: 32, width: 60, height: 60, zIndex: 100 }}>
        <SocialMenu
          mainButtonColor="#ffffff"
          iconColor="#000000"
          expandedIconColor="#000000"
          mainButtonSize={60}
          socialButtonSize={48}
          animationDuration={0.3}
          animationStagger={0.05}
          arcStartAngle={-170}
          arcEndAngle={-80}
          arcRadius={110}
          minAngleSpacing={30}
          labelColor="#000000"
          labelBackgroundColor="#ffffff"
          labelPadding={6}
          labelFont={{ fontSize: "13px", fontWeight: "500" }}
          onActionClick={() => setMessageOpen((v) => !v)}
          socialLinks={[
            { name: "Behance", url: "https://behance.net", icon: "behance", color: "#1769FF", label: "Behance", showLabel: true, useCustomIcon: false },
            { name: "Dribbble", url: "https://dribbble.com", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm6.605 4.61a8.502 8.502 0 011.93 5.314c-.281-.054-3.101-.629-5.943-.271-.065-.141-.12-.293-.184-.445a25.416 25.416 0 00-.564-1.236c3.145-1.28 4.577-3.124 4.761-3.362zM12 3.475c2.17 0 4.154.813 5.662 2.148-.152.216-1.443 1.941-4.48 3.08-1.399-2.57-2.95-4.675-3.189-5A8.687 8.687 0 0112 3.475zm-3.633.803a53.896 53.896 0 013.167 4.935c-3.992 1.063-7.517 1.04-7.896 1.04a8.581 8.581 0 014.729-5.975zM3.453 12.01v-.26c.37.01 4.512.065 8.775-1.215.25.477.477.965.694 1.453-.109.033-.228.065-.336.098-4.404 1.42-6.747 5.303-6.942 5.629a8.522 8.522 0 01-2.19-5.705zM12 20.547a8.482 8.482 0 01-5.239-1.8c.152-.315 1.888-3.656 6.703-5.337.022-.01.033-.01.054-.022a35.318 35.318 0 011.823 6.475 8.4 8.4 0 01-3.341.684zm4.761-1.465c-.086-.52-.542-3.015-1.659-6.084 2.679-.423 5.022.271 5.314.369a8.468 8.468 0 01-3.655 5.715z", color: "#EA4C89", label: "Dribbble", showLabel: true, useCustomIcon: false },
            { name: "LinkedIn", url: "https://linkedin.com", icon: "M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z", color: "#0077B5", label: "LinkedIn", showLabel: true, useCustomIcon: false },
            { name: "Message", action: "message", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z", color: "#111111", label: "Message", showLabel: true, useCustomIcon: false },
          ]}
        />
      </div>

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
