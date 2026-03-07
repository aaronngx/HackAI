import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { ensureUsersCollection, USERS_COLLECTION } from "@/lib/users";

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

    const users = await ensureUsersCollection();
    const now = new Date();
    const { passwordHash, passwordSalt } = hashPassword(password);

    const result = await users.insertOne({
      firstName,
      lastName,
      email,
      passwordHash,
      passwordSalt,
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
