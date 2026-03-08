
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  console.log("API KEY:", process.env.ELEVEN_LABS_API_KEY ? "found" : "MISSING");
  console.log("VOICE ID:", process.env.ELEVEN_LABS_VOICE_ID ? "found" : "MISSING");

  const apiKey = process.env.ELEVEN_LABS_API_KEY;
  const voiceId = process.env.ELEVEN_LABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return NextResponse.json(
      { error: "ELEVEN_LABS_API_KEY or ELEVEN_LABS_VOICE_ID not set." },
      { status: 500 }
    );
  }

  const { text } = await req.json();

  if (!text) {
    return NextResponse.json({ error: "No text provided." }, { status: 400 });
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2", // fastest model, lowest latency
        voice_settings: {
          stability: 0.75,        // higher = more consistent, less expressive
          similarity_boost: 0.75, // higher = closer to original voice
          style: 0.3,             // slight expressiveness for medical narration
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("ElevenLabs error:", err);
    return NextResponse.json(
      { error: "ElevenLabs API failed.", details: err },
      { status: res.status }
    );
  }

  // Stream the audio buffer back to the client
  const audioBuffer = await res.arrayBuffer();
  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}