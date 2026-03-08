import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = (process.env.MONGODB_DB || "HackAI").trim();

let clientPromise;

function getClientPromise() {
  if (!uri) {
    throw new Error("Missing MONGODB_URI in environment variables.");
  }

  if (clientPromise) {
    return clientPromise;
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  clientPromise = client.connect();
  return clientPromise;
}

export async function getDb() {
  const client = await getClientPromise();
  return client.db(dbName);
}
