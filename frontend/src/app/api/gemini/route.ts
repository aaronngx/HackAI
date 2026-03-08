// src/app/api/gemini/route.ts
// Server-side route — API key never reaches the client

import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set in environment variables." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    // body shape: { parts: Part[], systemPrompt?: string }
    // Part = { text: string } | { inlineData: { mimeType: string; data: string } }

    const { parts, systemPrompt, history } = body;
    // `history` is an optional array of { role: "user"|"model", parts: [{text}] }
    // for multi-turn chat. If omitted, falls back to single-turn behaviour.

    if (!parts || !Array.isArray(parts)) {
      return NextResponse.json(
        { error: "Request body must include a `parts` array." },
        { status: 400 }
      );
    }

    const contents = [
      ...(Array.isArray(history) ? history : []),
      { role: "user", parts },
    ];

    const payload = {
      ...(systemPrompt && {
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
      }),
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    };

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", errText);
      return NextResponse.json(
        { error: "Gemini API request failed.", details: errText },
        { status: geminiRes.status }
      );
    }

    const data = await geminiRes.json();

    // Extract the text from the response
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return NextResponse.json({ text });
  } catch (err) {
    console.error("Route handler error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}