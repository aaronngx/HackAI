import { NextResponse } from "next/server";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * AI recommends which type of eye doctor/clinic to search for based on the user's report.
 * Used to drive the clinic search query (no databases — report + AI only).
 */
export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      searchQuery: "eye clinic optometrist ophthalmologist",
      reason: "Showing general eye care clinics.",
    });
  }

  try {
    let body = {};
    try {
      body = await request.json();
    } catch (_) {}
    const {
      reportSummary,
      recommendation,
      conditionName,
      result,
      diagnoses,
      urgencyReason,
    } = body;

    const reportContext = [
      reportSummary && `Summary: ${reportSummary}`,
      recommendation && `Recommendation: ${recommendation}`,
      conditionName && `Condition: ${conditionName}`,
      result && `Result: ${result}`,
      urgencyReason && `Urgency: ${urgencyReason}`,
      diagnoses?.length && `Diagnoses: ${diagnoses.map((d) => d.name || d).join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n");

    if (!reportContext.trim()) {
      return NextResponse.json({
        searchQuery: "eye clinic optometrist ophthalmologist",
        reason: "No report data — showing general eye care clinics.",
      });
    }

    const systemPrompt = `You are an eye health assistant. Based on the user's screening or disease report, recommend what type of eye care provider they should search for. Output ONLY valid JSON, no markdown.`;
    const prompt = `Given this eye health report:
${reportContext}

Return exactly this JSON (one short search query for finding clinics, and one short reason for the user):
{
  "searchQuery": "2-5 word search query for finding a clinic, e.g. ophthalmologist retina specialist or optometrist eye exam or urgent eye care",
  "reason": "One short sentence explaining why this type of provider is recommended"
}`;

    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 256,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini recommend error:", err);
      return NextResponse.json(
        {
          searchQuery: "eye clinic ophthalmologist optometrist",
          reason: "Recommendation unavailable — showing general eye clinics.",
        }
      );
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned || "{}");

    return NextResponse.json({
      searchQuery: parsed.searchQuery || "eye clinic ophthalmologist optometrist",
      reason: parsed.reason || "Based on your report, we recommend the following type of care.",
    });
  } catch (e) {
    console.error("Recommend error:", e);
    return NextResponse.json({
      searchQuery: "eye clinic ophthalmologist optometrist",
      reason: "Showing general eye care clinics.",
    });
  }
}
