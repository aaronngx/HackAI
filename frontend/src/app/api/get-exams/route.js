import { NextResponse } from "next/server";
import { getEyeExamsByUser } from "@/lib/eyeExamResults";

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

export async function GET(request) {
  try {
    const params = request.nextUrl.searchParams;
    const token  = params.get("token");
    const eye    = params.get("eye") || undefined; // optional: 'left' or 'right'
    const limit  = Math.min(100, parseInt(params.get("limit") || "50", 10));

    const userId = userIdFromToken(token);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated." }, { status: 401 });
    }

    const exams = await getEyeExamsByUser(userId, { limit, eye });

    return NextResponse.json({
      success: true,
      exams: exams.map((e) => ({ ...e, _id: e._id.toString() })),
    });
  } catch (error) {
    console.error("get-exams error:", error);
    return NextResponse.json({ success: false, error: "Fetch failed." }, { status: 500 });
  }
}
