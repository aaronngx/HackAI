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

export async function GET(request) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    const userId = userIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated." }, { status: 401 });
    }

    const db = await getDb();
    const exams = await db
      .collection("exam_results")
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      success: true,
      exams: exams.map((e) => ({ ...e, _id: e._id.toString() })),
    });
  } catch (error) {
    console.error("get-exams error:", error);
    return NextResponse.json({ success: false, error: "Fetch failed." }, { status: 500 });
  }
}
