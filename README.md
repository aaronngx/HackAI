# IRIS — AI-Powered Eye Health Platform

IRIS is a hackathon project that combines computer-vision eye screening, AI-powered disease detection, and a personalized care assistant into a single web application.

---

## Features

- **Eye Screening** — A browser-based optical exam (astigmatism axis, spatial-frequency staircase, far-point refraction) powered by MediaPipe face/hand tracking and rendered in a self-contained HTML canvas page. Results are saved to MongoDB and surfaced in a structured report.
- **Eye Disease Detection** — Users upload a fundus or external eye image. A Gemini-backed classifier returns the likely condition, confidence, visible findings, and a short clinical summary.
- **AI Reports** — Both screening and disease results are fed to Google Gemini 2.5-flash to generate a personalised narrative report with urgency rating and recommendations.
- **TTS Narration** — Every report can be read aloud by Iris (ElevenLabs voice) with a synchronised narration bar and progress indicator.
- **Personalized Care Plan** — AI-generated eye exercise program with a guided timer, step-by-step TTS coaching, lubrication tips, and correction-care advice derived from exam data.
- **Doctor Finder** — Clinic search by ZIP code or GPS location via Google Places API → NPPES API → CSV fallback, with map view, ratings, distance sorting, and appointment booking UI.
- **Iris AI Chat** — Persistent, multi-turn eye health chatbot powered by Gemini with suggested prompts and a consistent dark UI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript + JavaScript (mixed) |
| Styling | Tailwind CSS 4 + inline styles |
| Animations | Framer Motion 12 |
| AI / LLM | Google Gemini 2.5-flash |
| TTS | ElevenLabs |
| Eye Tracking | MediaPipe Tasks Vision (WASM) |
| Database | MongoDB Atlas (native driver) |
| Auth | Custom JWT (base64, sessionStorage) |
| Maps | Leaflet + Google Places API |
| Deployment | Vercel-ready |

---

## Project Structure

```
HackAI/
├── PROCESS.md                  Development notes
├── XRAY.txt                    Full codebase X-Ray document
└── frontend/
    ├── public/
    │   ├── astig-test.html     Standalone eye screening exam (vanilla JS + Canvas + MediaPipe)
    │   ├── exam-app.html       Standalone gaze-tracking exam
    │   ├── doctors.csv         Fallback clinic data (DFW area)
    │   ├── *.js                Face/eye tracker helper scripts
    │   └── mediapipe-wasm/     WASM ML models
    └── src/
        ├── app/
        │   ├── layout.tsx              Root layout + GlobalFAB chat button
        │   ├── page.tsx                Home page (renders App.jsx)
        │   ├── chat/                   Iris AI chatbot
        │   ├── exam/                   Iframed gaze-tracking exam
        │   ├── astig/                  Iframed astigmatism + refraction exam
        │   ├── care-plan/              Eye exercise care plan
        │   ├── report/disease/         Disease detection report + TTS
        │   ├── report/screening/       Eye screening report + TTS
        │   └── api/                    16 API routes (see below)
        ├── components/                 18 React components
        └── lib/
            ├── mongodb.js              DB connection
            ├── users.js                User schema + operations
            ├── eyeExamResults.js       Exam schema + operations
            ├── eyeDiagnostics.js       Diagnostic schema + operations
            ├── framer-stub.js          Framer Motion Turbopack fix
            └── tracker/                11 eye tracking modules
```

---

## Pages

| URL | Description |
|---|---|
| `/` | Home — feature cards, hero animation, login/signup, doctor finder |
| `/astig` | Eye screening exam (astigmatism + refraction, iframed) |
| `/exam` | Gaze-tracking exam (iframed) |
| `/report/screening` | Eye screening report with AI summary and TTS narration |
| `/report/disease` | Disease detection report with AI summary and TTS narration |
| `/care-plan` | Guided eye exercise care plan |
| `/chat` | Iris AI eye health chatbot |

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/login` | POST | Email + password → JWT token |
| `/api/register` | POST | Create user account (PBKDF2 hash) |
| `/api/gemini` | POST | Proxy to Google Gemini API |
| `/api/tts` | POST | ElevenLabs text-to-speech |
| `/api/iris-chat` | POST | In-exam AI assistant (Gemini) |
| `/api/save-exam` | POST | Save eye screening results to MongoDB |
| `/api/get-exams` | GET | Fetch user exam history |
| `/api/eye-diagnostic/history` | GET | Fetch disease detection history |
| `/api/eye-disease/classify` | POST | Classify eye image → disease label + confidence |
| `/api/doctors` | GET | Find clinics (Google Places → NPPES → CSV) |
| `/api/seed-clinics` | POST | Seed MongoDB from Google Places |
| `/api/place-photo` | GET | Proxy Google Place photos |
| `/api/clinics-pick-top` | GET | Top-rated clinics from MongoDB |
| `/api/recommend` | POST | Clinical recommendations (stub) |
| `/api/insert` | POST | Generic DB insert utility |
| `/api/create-collection` | POST | Idempotent collection creation |

---

## Database Schemas (MongoDB)

### `users`
```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string (unique)",
  "passwordHash": "string (PBKDF2 + SHA512, 100k iterations)",
  "passwordSalt": "string",
  "age": "number",
  "visionCorrection": "glasses | contacts | neither | both | not sure",
  "eyeConditions": ["string"],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### `eye_exam_results`
```json
{
  "userId": "string",
  "testedEye": "left | right",
  "coveredEye": "left | right",
  "protocol": "string",
  "axis": "number (astigmatic axis °)",
  "axisConf": "number (0–1 confidence)",
  "mdsf1": "number (CPD, meridian 1)",
  "mdsf2": "number (CPD, meridian 2)",
  "sn1": "number (Snellen denominator)",
  "sn2": "number",
  "fp1Mm": "number (far-point mm)",
  "fp2Mm": "number",
  "refraction": {
    "sph": "number (diopters, ≤0 myopia)",
    "cyl": "number (diopters, ≤0 astig)",
    "axis": "number",
    "note": "string",
    "colorNote": "string"
  },
  "quality": "number (0–100)",
  "createdAt": "Date"
}
```

### `eye_diagnostic`
```json
{
  "userId": "string",
  "likely_disease": "string",
  "confidence": "string",
  "visible_findings": ["string"],
  "short_report": "string",
  "medical_disclaimer": "string",
  "model": "string",
  "source_file_name": "string",
  "createdAt": "Date"
}
```

---

## Data Flows

### Eye Screening → Report
```
User completes astig-test.html
  → POST /api/save-exam → MongoDB eye_exam_results
  → localStorage.irisExamResults (written by exam page)
  → User navigates to /report/screening
  → POST /api/gemini → AI-generated report
  → Displayed with optional ElevenLabs TTS narration
```

### Disease Detection → Report
```
User uploads eye image in Eye Disease panel
  → POST /api/eye-disease/classify → disease label + confidence
  → Result stored in MongoDB + localStorage
  → User clicks "View Full Report"
  → GET /api/eye-diagnostic/history → personalised history
  → POST /api/gemini → AI narrative summary
  → Displayed with narration bar + ElevenLabs TTS
```

### Clinic Finder
```
User clicks "Find Eye Doctor"
  → DoctorModal opens with map
  → User enters ZIP or clicks "Use My Location"
  → GET /api/doctors?zip=...&lat=...&lng=...
  → Priority: Google Places API → NPPES API → doctors.csv
  → Results shown with ratings, distance, map, and booking UI
```

### Authentication
```
Sign Up: POST /api/register → PBKDF2 hash → MongoDB
Sign In: POST /api/login → verify hash → base64 JWT → sessionStorage
Token clears automatically on browser close (sessionStorage only)
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `MONGODB_DB` | Yes | Database name (default: `HackAI`) |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `GEMINI_MODEL` | No | Model ID (default: `gemini-2.5-flash`) |
| `ELEVEN_LABS_API_KEY` | Yes | ElevenLabs TTS API key |
| `ELEVEN_LABS_VOICE_ID` | Yes | ElevenLabs voice ID |
| `GOOGLE_PLACES_API_KEY` | No | Enables real clinic search (falls back to NPPES + CSV without it) |

---

## Quick Start

**Prerequisites:** Node.js 18+, npm, MongoDB Atlas cluster, Gemini API key, ElevenLabs API key.

```bash
git clone <repo-url>
cd HackAI/frontend

npm install

cp .env.example .env.local
# Fill in all required values in .env.local

npm run dev
# Open http://localhost:3000
```

**Key dev URLs:**

| URL | Page |
|---|---|
| `http://localhost:3000` | Home |
| `http://localhost:3000/astig` | Eye screening exam |
| `http://localhost:3000/report/screening` | Screening report |
| `http://localhost:3000/report/disease` | Disease detection report |
| `http://localhost:3000/chat` | Iris AI chatbot |

---

## Architectural Decisions

**Iframed exam tools** — `/exam` and `/astig` are Next.js pages that iframe standalone HTML files. This isolates MediaPipe WASM and complex canvas logic from the React tree.

**Strict mode disabled** — `reactStrictMode: false` in `next.config.ts` because MediaPipe WASM double-initializes in strict mode and crashes.

**SessionStorage-only auth** — JWT tokens go to `sessionStorage`, not `localStorage`, so they auto-clear on browser close. Note: tokens are base64-encoded, not cryptographically signed — suitable for hackathon use only.

**Fallback clinic data** — Clinic lookup cascades: Google Places API → NPPES API (free, real providers) → `doctors.csv` (DFW area). This guarantees the feature works even without API keys.

**Queue-replacing TTS** — `irisSpeak()` always replaces the TTS queue so Iris says the most recent relevant thing with no backlog of stale cues.

**Mic blocked during active test** — Auto-mic restart is disabled during AXIS / MDSF / FAR_POINT exam phases to prevent Iris's own TTS audio from being captured and looped back.

---

## Known Limitations

- JWT tokens are not cryptographically signed (base64 only) — replace with `jsonwebtoken` for production.
- `/api/recommend` returns a stub response — not yet implemented.
- Appointment booking UI exists but has no real backend.
- `doctors.csv` fallback covers DFW area only.
- No test coverage (0%).
- Mixed TypeScript and JavaScript files throughout the codebase.

---

*Built at HackAI 2026 · Powered by Google Gemini, ElevenLabs, MediaPipe, and MongoDB Atlas*
