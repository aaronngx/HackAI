import { NextResponse } from "next/server";
import { insertEyeExamResult } from "@/lib/eyeExamResults";

function userIdFromToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length < 2) return null;
    const id = parts[0];
    if (!/^[a-f0-9]{24}$/i.test(id)) return null;
    return id;
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, ...examData } = body;

    const userId = userIdFromToken(token) || "anonymous";

    const result = await insertEyeExamResult(examData, { userId });

    return NextResponse.json({ success: true, id: result.insertedId.toString() });
  } catch (error) {
    console.error("save-exam error:", error);
    return NextResponse.json({ success: false, error: "Save failed." }, { status: 500 });
  }
}
