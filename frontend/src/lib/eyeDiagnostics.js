import { getDb } from "@/lib/mongodb";

export const EYE_DIAGNOSTIC_COLLECTION = "eye_diagnostic";
const EYE_DIAGNOSTIC_VALIDATOR = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "userId",
      "likely_disease",
      "confidence",
      "visible_findings",
      "createdAt",
    ],
    properties: {
      userId: { bsonType: "string" },
      likely_disease: { bsonType: "string" },
      confidence: { bsonType: "string" },
      visible_findings: {
        bsonType: "array",
        items: { bsonType: "string" },
      },
      short_report: { bsonType: ["string", "null"] },
      medical_disclaimer: { bsonType: ["string", "null"] },
      model: { bsonType: ["string", "null"] },
      source_file_name: { bsonType: ["string", "null"] },
      source_mime_type: { bsonType: ["string", "null"] },
      createdAt: { bsonType: "date" },
    },
  },
};

function normalizeFindings(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (value == null) {
    return [];
  }

  const single = String(value).trim();
  return single ? [single] : [];
}

export async function ensureEyeDiagnosticCollection() {
  const db = await getDb();
  const existing = await db
    .listCollections({ name: EYE_DIAGNOSTIC_COLLECTION }, { nameOnly: true })
    .toArray();

  if (existing.length === 0) {
    await db.createCollection(EYE_DIAGNOSTIC_COLLECTION, {
      validator: EYE_DIAGNOSTIC_VALIDATOR,
    });
  } else {
    await db.command({
      collMod: EYE_DIAGNOSTIC_COLLECTION,
      validator: EYE_DIAGNOSTIC_VALIDATOR,
      validationLevel: "moderate",
    });
  }

  const collection = db.collection(EYE_DIAGNOSTIC_COLLECTION);
  await collection.createIndex({ createdAt: -1 }, { name: "eye_diag_created_at_desc" });
  await collection.createIndex({ userId: 1, createdAt: -1 }, { name: "eye_diag_user_created_at_desc" });
  return collection;
}

export async function insertEyeDiagnostic(result, metadata = {}) {
  if (!metadata.userId) {
    throw new Error("userId is required to save diagnostic report.");
  }

  const collection = await ensureEyeDiagnosticCollection();
  const now = new Date();

  return collection.insertOne({
    userId: String(metadata.userId),
    likely_disease: String(result?.likely_disease || "N/A"),
    confidence: String(result?.confidence || "N/A"),
    visible_findings: normalizeFindings(result?.visible_findings),
    short_report: result?.short_report ? String(result.short_report) : null,
    medical_disclaimer: result?.medical_disclaimer
      ? String(result.medical_disclaimer)
      : null,
    model: metadata.model ? String(metadata.model) : null,
    source_file_name: metadata.fileName ? String(metadata.fileName) : null,
    source_mime_type: metadata.mimeType ? String(metadata.mimeType) : null,
    createdAt: now,
  });
}
