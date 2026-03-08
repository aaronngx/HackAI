import { NextResponse } from "next/server";

const DEFAULT_MODEL = "gemini-2.5-flash";
const PROMPT = `
You are analyzing a photo of the external human eye.

Task:
- Name the most likely visible external-eye condition label from the image.
- If the image is too unclear, say that explicitly.
- Base your answer only on visible surface findings in the photo.
- Do not claim certainty or diagnose internal-eye disease from an external photo.
- Keep the response brief and medically cautious.

Return strict JSON with this exact shape:
{
  "short_report": "Very short report in 1-2 sentences",
  "likely_disease": "short label",
  "confidence": "low|medium|high",
  "visible_findings": ["finding", "finding"],
  "medical_disclaimer": "short disclaimer"
}
`.trim();

function extractResponseText(apiResponse) {
  const candidates = apiResponse?.candidates || [];
  if (!candidates.length) {
    throw new Error("Gemini returned no candidates.");
  }

  const parts = candidates[0]?.content?.parts || [];
  const text = parts
    .filter((part) => typeof part?.text === "string")
    .map((part) => part.text)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned no text output.");
  }
  return text;
}

function parsePossiblyFencedJson(text) {
  const cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n");
    if (lines.length >= 3) {
      return JSON.parse(lines.slice(1, -1).join("\n").trim());
    }
  }
  return JSON.parse(cleaned);
}

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing GEMINI_API_KEY or GOOGLE_API_KEY on server.",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const imageFile = formData.get("image");

    if (!(imageFile instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Please upload an image file." },
        { status: 400 }
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = imageFile.type || "application/octet-stream";

    const payload = {
      contents: [
        {
          parts: [
            { text: PROMPT },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const upstreamText = await upstream.text();
      return NextResponse.json(
        {
          success: false,
          error: `Gemini API error ${upstream.status}: ${upstreamText}`,
        },
        { status: upstream.status }
      );
    }

    const apiResponse = await upstream.json();
    const responseText = extractResponseText(apiResponse);
    const result = parsePossiblyFencedJson(responseText);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Eye disease classify API error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to classify image." },
      { status: 500 }
    );
  }
}
