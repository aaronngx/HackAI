import { getDb } from "@/lib/mongodb";

export const EYE_EXAM_COLLECTION = "eye_exam_results";

// ── MongoDB schema validator ───────────────────────────────────────────────────
const EYE_EXAM_VALIDATOR = {
  $jsonSchema: {
    bsonType: "object",
    required: ["userId", "testedEye", "coveredEye", "protocol", "createdAt"],
    properties: {
      userId:     { bsonType: "string" },
      testedEye:  { bsonType: "string", enum: ["left", "right"] },
      coveredEye: { bsonType: "string", enum: ["left", "right"] },
      protocol:   { bsonType: "string" },

      // Astigmatic axis search
      axis:     { bsonType: ["int", "double", "null"] },
      axisConf: { bsonType: ["int", "double", "null"] },

      // MDSF (resolution staircase) thresholds in CPD
      mdsf1: { bsonType: ["int", "double", "null"] },
      mdsf2: { bsonType: ["int", "double", "null"] },

      // Snellen denominators derived from MDSF
      sn1: { bsonType: ["int", "double", "null"] },
      sn2: { bsonType: ["int", "double", "null"] },

      // Far-point distances in mm
      fp1Mm: { bsonType: ["int", "double", "null"] },
      fp2Mm: { bsonType: ["int", "double", "null"] },

      // Computed prescription (null when far-point was skipped)
      refraction: {
        bsonType: ["object", "null"],
        properties: {
          sph:       { bsonType: ["int", "double"] },
          cyl:       { bsonType: ["int", "double"] },
          axis:      { bsonType: ["int", "double"] },
          note:      { bsonType: ["string", "null"] },
          colorNote: { bsonType: ["string", "null"] },
        },
      },

      // Overall quality / confidence score 0-100
      quality: { bsonType: ["int", "double", "null"] },

      createdAt: { bsonType: "date" },
    },
  },
};

// ── Collection setup (idempotent) ──────────────────────────────────────────────
export async function ensureEyeExamCollection() {
  const db = await getDb();
  const existing = await db
    .listCollections({ name: EYE_EXAM_COLLECTION }, { nameOnly: true })
    .toArray();

  if (existing.length === 0) {
    await db.createCollection(EYE_EXAM_COLLECTION, {
      validator: EYE_EXAM_VALIDATOR,
    });
  } else {
    await db.command({
      collMod: EYE_EXAM_COLLECTION,
      validator: EYE_EXAM_VALIDATOR,
      validationLevel: "moderate",
    });
  }

  const collection = db.collection(EYE_EXAM_COLLECTION);

  // Indexes: newest-first globally, and per-user newest-first
  await collection.createIndex(
    { createdAt: -1 },
    { name: "exam_created_at_desc" }
  );
  await collection.createIndex(
    { userId: 1, createdAt: -1 },
    { name: "exam_user_created_at_desc" }
  );

  return collection;
}

// ── Insert one exam result ─────────────────────────────────────────────────────
/**
 * @param {object} examData  - the eyeData object from showResults()
 * @param {object} meta      - { userId: string }
 */
export async function insertEyeExamResult(examData, meta = {}) {
  if (!meta.userId) {
    throw new Error("userId is required to save eye exam result.");
  }

  const collection = await ensureEyeExamCollection();

  const ref = examData.refraction
    ? {
        sph:       Number(examData.refraction.sph)  || 0,
        cyl:       Number(examData.refraction.cyl)  || 0,
        axis:      Number(examData.refraction.axis) || 0,
        note:      examData.refraction.note      ? String(examData.refraction.note)      : null,
        colorNote: examData.refraction.colorNote ? String(examData.refraction.colorNote) : null,
      }
    : null;

  return collection.insertOne({
    userId:     String(meta.userId),
    testedEye:  String(examData.testedEye  || ""),
    coveredEye: String(examData.coveredEye || ""),
    protocol:   String(examData.protocol   || "v4-lca"),

    axis:     examData.axis     != null ? Number(examData.axis)     : null,
    axisConf: examData.axisConf != null ? Number(examData.axisConf) : null,

    mdsf1: examData.mdsf1 != null ? Number(examData.mdsf1) : null,
    mdsf2: examData.mdsf2 != null ? Number(examData.mdsf2) : null,
    sn1:   examData.sn1   != null ? Number(examData.sn1)   : null,
    sn2:   examData.sn2   != null ? Number(examData.sn2)   : null,

    fp1Mm: examData.fp1Mm != null ? Number(examData.fp1Mm) : null,
    fp2Mm: examData.fp2Mm != null ? Number(examData.fp2Mm) : null,

    refraction: ref,
    quality:    examData.quality != null ? Number(examData.quality) : null,

    createdAt: new Date(),
  });
}

// ── Fetch exams for a user ────────────────────────────────────────────────────
/**
 * @param {string} userId
 * @param {object} opts  - { limit?: number, eye?: 'left'|'right' }
 * @returns {Promise<Array>}
 */
export async function getEyeExamsByUser(userId, { limit = 50, eye } = {}) {
  if (!userId) throw new Error("userId is required.");

  const collection = await ensureEyeExamCollection();
  const filter = { userId };
  if (eye) filter.testedEye = eye;

  return collection
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}
