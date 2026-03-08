import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

function userIdFromToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length < 2) return null;
    const id = parts[0];
    // Basic sanity: MongoDB ObjectId is 24 hex chars
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

    const userId = userIdFromToken(token);

    const db = await getDb();
    const result = await db.collection("exam_results").insertOne({
      userId: userId || "anonymous",
      createdAt: new Date(),
      ...examData,
    });

    return NextResponse.json({ success: true, id: result.insertedId.toString() });
  } catch (error) {
    console.error("save-exam error:", error);
    return NextResponse.json({ success: false, error: "Save failed." }, { status: 500 });
  }
}
