import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

function normalizeText(value) {
  return String(value || "").trim();
}

function sanitizeCollectionName(value) {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
  return cleaned.slice(0, 60);
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const userId = normalizeText(payload.userId);
    const rawCollectionName = normalizeText(payload.collectionName);

    if (!userId || !rawCollectionName) {
      return NextResponse.json({ success: false, error: "userId and collectionName are required." }, { status: 400 });
    }

    const safeCollectionName = sanitizeCollectionName(rawCollectionName);
    if (!safeCollectionName) {
      return NextResponse.json({ success: false, error: "Invalid collectionName." }, { status: 400 });
    }

    const db = await getDb();
    const userCollectionName = `user_${userId}_${safeCollectionName}`.toLowerCase();
    const exists = await db
      .listCollections({ name: userCollectionName }, { nameOnly: true })
      .toArray();

    if (exists.length === 0) {
      await db.createCollection(userCollectionName);
    }

    return NextResponse.json({
      success: true,
      message: `Collection "${userCollectionName}" is ready.`,
      collection: userCollectionName,
    });
  } catch (error) {
    console.error("Create collection API error:", error);
    return NextResponse.json({ success: false, error: "Failed to create collection." }, { status: 500 });
  }
}
