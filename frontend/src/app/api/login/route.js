import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { ensureUsersCollection } from "@/lib/users";

function normalizeText(value) {
  return String(value || "").trim();
}

function verifyPassword(password, salt, expectedHash) {
  const computedHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, "hex"),
    Buffer.from(expectedHash, "hex")
  );
}

function createToken(userId) {
  const payload = `${userId}:${Date.now()}`;
  return Buffer.from(payload).toString("base64url");
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const email = normalizeText(payload.email).toLowerCase();
    const password = String(payload.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const users = await ensureUsersCollection();
    const user = await users.findOne({ email });

    if (!user || !user.passwordSalt || !user.passwordHash) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const isPasswordValid = verifyPassword(
      password,
      user.passwordSalt,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      token: createToken(user._id.toString()),
      user: {
        id: user._id.toString(),
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to login." },
      { status: 500 }
    );
  }
}
