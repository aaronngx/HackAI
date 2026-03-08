import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { ensureUsersCollection, USERS_COLLECTION } from "@/lib/users";

const VISION_CORRECTION_OPTIONS = new Set([
  "glasses",
  "contacts",
  "neither",
  "both",
  "not sure",
]);

const EYE_CONDITION_OPTIONS = new Set([
  "myopia",
  "atigmatism",
  "dry eyes",
  "other",
]);

function normalizeText(value) {
  return String(value || "").trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return { passwordHash, passwordSalt: salt };
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const fullName = normalizeText(payload.name);
    let firstName = normalizeText(payload.firstName);
    let lastName = normalizeText(payload.lastName);
    const email = normalizeText(payload.email).toLowerCase();
    const password = String(payload.password || "");
    const age = Number(payload.age);
    const visionCorrection = normalizeText(payload.visionCorrection).toLowerCase();
    const eyeConditions = Array.isArray(payload.eyeConditions)
      ? payload.eyeConditions.map((item) => normalizeText(item).toLowerCase()).filter(Boolean)
      : [];

    if ((!firstName || !lastName) && fullName) {
      const parts = fullName.split(/\s+/).filter(Boolean);
      firstName = firstName || parts[0] || "";
      lastName = lastName || parts.slice(1).join(" ") || "N/A";
    }

    if (!firstName || !email || !password) {
      return NextResponse.json({ success: false, error: "Name, email, and password are required." }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ success: false, error: "Invalid email address." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ success: false, error: "Password must be at least 8 characters." }, { status: 400 });
    }

    if (!Number.isFinite(age) || age < 1 || age > 120) {
      return NextResponse.json({ success: false, error: "Age must be between 1 and 120." }, { status: 400 });
    }

    if (!VISION_CORRECTION_OPTIONS.has(visionCorrection)) {
      return NextResponse.json(
        { success: false, error: "Please select a valid glasses/contacts option." },
        { status: 400 }
      );
    }

    if (!eyeConditions.length) {
      return NextResponse.json(
        { success: false, error: "Please select at least one known eye condition." },
        { status: 400 }
      );
    }

    if (eyeConditions.some((condition) => !EYE_CONDITION_OPTIONS.has(condition))) {
      return NextResponse.json(
        { success: false, error: "Invalid eye condition option selected." },
        { status: 400 }
      );
    }

    const users = await ensureUsersCollection();
    const now = new Date();
    const { passwordHash, passwordSalt } = hashPassword(password);

    const result = await users.insertOne({
      firstName,
      lastName,
      email,
      passwordHash,
      passwordSalt,
      age,
      visionCorrection,
      eyeConditions,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Registration successful",
        collection: USERS_COLLECTION,
        user: {
          id: result.insertedId.toString(),
          firstName,
          lastName,
          email,
          age,
          visionCorrection,
          eyeConditions,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error && error.code === 11000) {
      return NextResponse.json({ success: false, error: "Email is already registered." }, { status: 409 });
    }

    console.error("Register API error:", error);
    return NextResponse.json({ success: false, error: "Failed to register user." }, { status: 500 });
  }
}
