import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { USERS_COLLECTION } from "@/lib/users";
import { ensureEyeDiagnosticCollection } from "@/lib/eyeDiagnostics";

async function getAuthenticatedUserId(request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    return null;
  }

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const userId = decoded.split(":")[0] || "";

    if (!ObjectId.isValid(userId)) {
      return null;
    }

    const db = await getDb();
    const user = await db
      .collection(USERS_COLLECTION)
      .findOne({ _id: new ObjectId(userId) }, { projection: { _id: 1 } });

    return user ? userId : null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const collection = await ensureEyeDiagnosticCollection();
    const rows = await collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    const history = rows.map((row) => ({
      id: row._id.toString(),
      userId: row.userId,
      likely_disease: row.likely_disease,
      confidence: row.confidence,
      visible_findings: row.visible_findings,
      short_report: row.short_report,
      medical_disclaimer: row.medical_disclaimer,
      createdAt: row.createdAt,
    }));

    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error("Eye diagnostic history API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load eye diagnostic history." },
      { status: 500 }
    );
  }
}
