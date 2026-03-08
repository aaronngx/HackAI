export const metadata = {
  title: "Astigmatism Screening | HackAI",
  description: "Webcam-based astigmatism and refraction screening.",
};

export default function AstigPage() {
  return (
    <iframe
      src="/astig-test.html"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none" }}
      allow="camera"
      title="Astigmatism Screening"
    />
  );
}
