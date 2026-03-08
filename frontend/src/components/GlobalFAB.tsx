"use client";
import { useRouter } from "next/navigation";
import SocialMenu from "./SocialMenu.js";

export default function GlobalFAB() {
  const router = useRouter();

  return (
    <div style={{ position: "fixed", right: 72, bottom: 120, width: 60, height: 60, zIndex: 1500 }}>
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
        onActionClick={() => router.push("/chat")}
        socialLinks={[
          { name: "Behance", url: "https://behance.net", icon: "behance", color: "#1769FF", label: "Behance", showLabel: true, useCustomIcon: false },
          { name: "Dribbble", url: "https://dribbble.com", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm6.605 4.61a8.502 8.502 0 011.93 5.314c-.281-.054-3.101-.629-5.943-.271-.065-.141-.12-.293-.184-.445a25.416 25.416 0 00-.564-1.236c3.145-1.28 4.577-3.124 4.761-3.362zM12 3.475c2.17 0 4.154.813 5.662 2.148-.152.216-1.443 1.941-4.48 3.08-1.399-2.57-2.95-4.675-3.189-5A8.687 8.687 0 0112 3.475zm-3.633.803a53.896 53.896 0 013.167 4.935c-3.992 1.063-7.517 1.04-7.896 1.04a8.581 8.581 0 014.729-5.975zM3.453 12.01v-.26c.37.01 4.512.065 8.775-1.215.25.477.477.965.694 1.453-.109.033-.228.065-.336.098-4.404 1.42-6.747 5.303-6.942 5.629a8.522 8.522 0 01-2.19-5.705zM12 20.547a8.482 8.482 0 01-5.239-1.8c.152-.315 1.888-3.656 6.703-5.337.022-.01.033-.01.054-.022a35.318 35.318 0 011.823 6.475 8.4 8.4 0 01-3.341.684zm4.761-1.465c-.086-.52-.542-3.015-1.659-6.084 2.679-.423 5.022.271 5.314.369a8.468 8.468 0 01-3.655 5.715z", color: "#EA4C89", label: "Dribbble", showLabel: true, useCustomIcon: false },
          { name: "LinkedIn", url: "https://linkedin.com", icon: "M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z", color: "#0077B5", label: "LinkedIn", showLabel: true, useCustomIcon: false },
          { name: "Message", action: "message", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z", color: "#111111", label: "Message", showLabel: true, useCustomIcon: false },
        ]}
      />
    </div>
  );
}
