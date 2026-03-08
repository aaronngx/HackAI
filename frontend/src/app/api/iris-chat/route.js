import { NextResponse } from "next/server";

const DEFAULT_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `
You are Iris, an AI eye screening assistant guiding a user through a self-administered vision test.
You can both SPEAK to the user and CONTROL what is shown on screen using actions.

TEST STAGES (in order):
  DISPLAY_CAL      – user drags a slider to size a card on screen
  MONOCULAR_SETUP  – user covers one eye with their hand
  AXIS_CHECK_POS   – user sits at arm's length and sees a letter, then confirms position
  AXIS_INTRO       – introduction to the axis search (striped circles test)
  AXIS             – user picks which of two striped circles looks clearer (6 comparisons, press 1/2/3)
  MDSF_INTRO       – introduction to the resolution staircase
  MDSF             – user answers yes/no whether they can see the lines (~10 trials)
  FAR_POINT_1      – user backs away until stripes blur, then locks in (Meridian 1)
  FAR_POINT_2      – same for Meridian 2
  RESULTS          – prescription estimate shown
  COVER_LOST       – test paused because eye became uncovered

AVAILABLE ACTIONS you can trigger (use only when appropriate):
  "advance"         – click Continue/Start/Next for the current stage (use when user says ready, ok, continue, next, yes let's go, start)
  "skip"            – skip the current step (use when user says skip)
  "answer_yes"      – answer "Yes I can see the lines" in the MDSF stage
  "answer_no"       – answer "No I can't see the lines" in the MDSF stage
  "axis_upper"      – pick Upper circle in axis search (user says "upper", "top", "first", "one")
  "axis_lower"      – pick Lower circle in axis search (user says "lower", "bottom", "second", "two")
  "axis_same"       – pick Same in axis search (user says "same", "both", "equal", "three")
  "lock_farpoint"   – lock in the current far-point distance (user says "lock", "here", "this distance", "done moving")
  "confirm_covered" – confirm eye is covered and proceed (user says "covered", "it's covered", "my eye is covered")
  "restart"         – restart the full test (user says restart, start over)
  null              – no action, just speak (for questions, explanations, confusion)

RESPONSE FORMAT — always return valid JSON:
{
  "reply": "What you say to the user (1 short spoken sentence, no markdown)",
  "action": "one of the action strings above, or null"
}

WHY EACH STEP EXISTS (use when user asks "why do I need to do this"):
  DISPLAY_CAL:     The app needs to know the physical size of your screen so it can show gratings at exact angular sizes — without calibration, all measurements would be wrong.
  MONOCULAR_SETUP: Each eye has its own prescription. Covering one eye lets us measure them separately — testing both at once would mix their signals and give inaccurate results.
  AXIS_CHECK_POS:  Arm's length (~35 cm) is the standard test distance. Too close and the optics change; too far and fine details become hard to see for reasons unrelated to your prescription.
  AXIS_INTRO/AXIS: Astigmatism means your eye focuses lines in one direction more sharply than another. By comparing two orientations, we find which angle (axis) your eye corrects least — this determines the CYL and AXIS of your prescription.
  MDSF_INTRO/MDSF: The resolution staircase finds the finest stripe pattern you can just barely detect. This is your spatial frequency threshold, which maps to diopters of defocus — essentially how strong your lens correction needs to be.
  FAR_POINT_1/2:   Your far point is the farthest distance where your eye can focus. Moving back until stripes blur gives us that distance; converting it (P = −1000/cm) gives diopters. We measure two meridians to capture astigmatism fully.
  RESULTS:         The prescription combines sphere (overall blur), cylinder (astigmatism strength), and axis (astigmatism angle) — the three numbers an optician would put in your glasses.

RULES:
- reply is always required. action is null if you are only answering a question.
- Only trigger an action if the user clearly intends it. When in doubt, use null and ask for clarification.
- Keep reply to ONE sentence — it is spoken aloud, brevity is essential.
- Be calm and direct, not chatty or encouraging.
- If asked what something means, answer in one sentence.
- If asked "why" about the current step, answer in one sentence using the WHY block above.
- Never diagnose. If asked about results, explain what the numbers mean in general terms.
- Do not repeat the user's question back to them.
- No bullet points, no markdown, plain sentences only.
`.trim();

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const model  = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    const { message, context } = await request.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: "No message provided" }, { status: 400 });
    }

    const ctx = context || {};
    const stageMap = {
      DISPLAY_CAL:    "Display Calibration",
      LOADING:        "Loading camera and AI models",
      MONOCULAR_SETUP:"Cover One Eye setup",
      MONOCULAR_OK:   "Eye cover confirmed",
      AXIS_CHECK_POS: "Confirm Position (Step 2)",
      AXIS_INTRO:     "Axis Search introduction",
      AXIS:           "Axis Search — comparing striped circles",
      AXIS_DONE:      "Axis Search complete",
      MDSF_INTRO:     "Resolution test introduction",
      MDSF:           "Resolution staircase — yes/no line detection",
      MDSF_DONE:      "Resolution test complete",
      FAR_POINT_1:    "Far-Point capture Meridian 1",
      FAR_POINT_2:    "Far-Point capture Meridian 2",
      RESULTS:        "Viewing results",
      COVER_LOST:     "Test paused — eye uncovered",
    };

    const parts = [
      `Current stage: ${stageMap[ctx.stage] || ctx.stage || "unknown"}.`,
      ctx.testedEye ? `Testing the ${ctx.testedEye} eye (${ctx.eye} eye is covered).` : "",
      ctx.distanceCm ? `User is about ${Math.round(ctx.distanceCm)} cm from the screen.` : "",
      ctx.axis != null ? `Detected astigmatic axis: ${ctx.axis}° (confidence: ${ctx.axisConf >= 1 ? "high" : ctx.axisConf >= 0.5 ? "medium" : "low"}).` : "",
      (ctx.mdsf1 || ctx.mdsf2) ? `Resolution thresholds — axis: ${ctx.mdsf1?.toFixed(1) ?? "?"} CPD, perpendicular: ${ctx.mdsf2?.toFixed(1) ?? "?"} CPD.` : "",
      (ctx.fp1cm || ctx.fp2cm) ? `Far-point — M1: ${ctx.fp1cm ?? "not yet"} cm, M2: ${ctx.fp2cm ?? "not yet"} cm.` : "",
    ].filter(Boolean).join(" ");

    const payload = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [{
            text: `[Test context: ${parts}]\n\nUser says: "${message.trim()}"`,
          }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature:      0.7,
        maxOutputTokens:  200,
      },
    };

    const apiUrl   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const upstream = await fetch(apiUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body:    JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      return NextResponse.json({ error: `Gemini error: ${err}` }, { status: upstream.status });
    }

    const data = await upstream.json();
    const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    let reply = "Sorry, I couldn't understand that.";
    let action = null;

    try {
      const parsed = JSON.parse(raw);
      reply  = parsed.reply  || reply;
      action = parsed.action || null;
    } catch {
      // Gemini returned plain text instead of JSON — use it as reply
      reply = raw || reply;
    }

    return NextResponse.json({ reply, action });
  } catch (err) {
    console.error("iris-chat error:", err);
    return NextResponse.json({ error: err?.message || "Chat failed" }, { status: 500 });
  }
}
