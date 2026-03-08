export const metadata = {
  title: "Eye Exam | HackAI",
  description: "Real-time hand, face and eye tracking with gaze calibration.",
};

export default function ExamPage() {
  return (
    <iframe
      src="/exam-app.html"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: "none",
      }}
      allow="camera"
      title="Eye Exam Tracker"
    />
  );
}
