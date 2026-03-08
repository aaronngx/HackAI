"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import DoctorModal from "./DoctorModal.jsx";

export function openDoctorFinder() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-doctor-finder"));
  }
}

export default function DoctorFinderLayer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-doctor-finder", handler);
    return () => window.removeEventListener("open-doctor-finder", handler);
  }, []);

  return (
    <AnimatePresence>
      {open && <DoctorModal onClose={() => setOpen(false)} />}
    </AnimatePresence>
  );
}
