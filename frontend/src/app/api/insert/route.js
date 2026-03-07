import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const INSERT_TEST_COLLECTION = "insert_test";

export async function POST() {
  try {
    const db = await getDb();
    const result = await db.collection(INSERT_TEST_COLLECTION).insertOne({
      message: "Test insert from /api/insert",
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      insertedId: result.insertedId.toString(),
      collection: INSERT_TEST_COLLECTION,
    });
  } catch (error) {
    console.error("Insert API error:", error);
    return NextResponse.json({ success: false, error: "Insert failed." }, { status: 500 });
  }
}
