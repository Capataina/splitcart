import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | null = null;

// Lazily created so `next build` can import this module without DATABASE_URL set.
export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (pull it with `vercel env pull .env.local`)");
    client = neon(url);
  }
  return client;
}
