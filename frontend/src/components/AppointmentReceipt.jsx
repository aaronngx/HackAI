"use client";
import { useRef } from "react";
import { motion } from "framer-motion";

export default function AppointmentReceipt({ appointment, onClose }) {
  const receiptRef = useRef(null);
  const confirmationId = `APT-${Date.now().toString(36).toUpperCase()}`;

  const handlePrint = () => {
    if (typeof window === "undefined" || !receiptRef.current) return;
    const content = receiptRef.current;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>Appointment Receipt - ${appointment.doctor.name}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 24px; max-width: 480px; margin: 0 auto; color: #111; }
          h1 { font-size: 18px; margin: 0 0 8px; border-bottom: 2px solid #111; padding-bottom: 8px; }
          .row { display: flex; justify-content: space-between; margin: 10px 0; font-size: 14px; }
          .label { color: #666; }
          .conf { font-size: 12px; color: #888; margin-top: 20px; }
        </style>
        </head>
        <body>
          <h1>Appointment confirmation</h1>
          <div class="row"><span class="label">Confirmation #</span><strong>${confirmationId}</strong></div>
          <div class="row"><span class="label">Doctor</span><span>${appointment.doctor.name}</span></div>
          <div class="row"><span class="label">Specialty</span><span>${appointment.doctor.role}</span></div>
          <div class="row"><span class="label">Date</span><span>${appointment.date}</span></div>
          <div class="row"><span class="label">Time</span><span>${appointment.time}</span></div>
          <div class="row"><span class="label">Address</span><span>${appointment.doctor.address}</span></div>
          <p class="conf">Keep this receipt for your records. Contact the office to reschedule or cancel.</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.25 }}
      style={{
        position: "absolute",
        inset: 0,
        background: "#fff",
        zIndex: 11,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: 20, flex: 1, overflowY: "auto", color: "#111", background: "#fff" }} ref={receiptRef}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>Appointment confirmed</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111" }}>Receipt</h2>
        </div>
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 16, background: "#fff" }}>
          <div style={{ fontSize: 10, color: "#555", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>Confirmation #</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111", letterSpacing: "0.05em" }}>{confirmationId}</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, color: "#111" }}>
          <tbody>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "10px 0", color: "#555", width: 100 }}>Doctor</td>
              <td style={{ padding: "10px 0", fontWeight: 600, color: "#111" }}>{appointment.doctor.name}</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "10px 0", color: "#555" }}>Specialty</td>
              <td style={{ padding: "10px 0", color: "#111" }}>{appointment.doctor.role}</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "10px 0", color: "#555" }}>Date</td>
              <td style={{ padding: "10px 0", color: "#111" }}>{appointment.date}</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "10px 0", color: "#555" }}>Time</td>
              <td style={{ padding: "10px 0", color: "#111" }}>{appointment.time}</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "10px 0", color: "#555", verticalAlign: "top" }}>Address</td>
              <td style={{ padding: "10px 0", color: "#111" }}>{appointment.doctor.address}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "#555", marginTop: 16 }}>
          Keep this receipt for your records. Contact the office to reschedule or cancel.
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, padding: 16, borderTop: "1px solid #eee" }}>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handlePrint}
          style={{
            flex: 1, padding: "12px 0", background: "#111", color: "#fff",
            border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          Print / Save PDF
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={onClose}
          style={{
            flex: 1, padding: "12px 0", background: "#f0f0f0", color: "#111",
            border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          Done
        </motion.button>
      </div>
    </motion.div>
  );
}
