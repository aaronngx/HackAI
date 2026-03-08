import { getDb } from "@/lib/mongodb";

export const USERS_COLLECTION = "users";

export async function ensureUsersCollection() {
  const db = await getDb();
  const existing = await db
    .listCollections({ name: USERS_COLLECTION }, { nameOnly: true })
    .toArray();

  if (existing.length === 0) {
    await db.createCollection(USERS_COLLECTION, {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["firstName", "lastName", "email", "passwordHash", "passwordSalt", "createdAt", "updatedAt"],
          properties: {
            firstName: { bsonType: "string" },
            lastName: { bsonType: "string" },
            email: { bsonType: "string" },
            passwordHash: { bsonType: "string" },
            passwordSalt: { bsonType: "string" },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" },
          },
        },
      },
    });
  }

  const users = db.collection(USERS_COLLECTION);
  await users.createIndex({ email: 1 }, { unique: true, name: "users_unique_email" });
  return users;
}
