import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

export default async (req: Request) => {
  const store = getStore("chat-feedback");

  // Owner export: GET /api/feedback with header "x-admin-token: <ADMIN_TOKEN>"
  if (req.method === "GET") {
    const token = Netlify.env.get("ADMIN_TOKEN");
    if (!token || req.headers.get("x-admin-token") !== token) return json({ error: "Not allowed" }, 401);
    const { blobs } = await store.list();
    const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    items.sort((a: any, b: any) => String(b?.at).localeCompare(String(a?.at)));
    return json({ count: items.length, items });
  }

  // Visitor feedback: stored only when the visitor clicks thumbs up/down on an answer.
  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const rating = b?.rating === "up" ? "up" : b?.rating === "down" ? "down" : null;
  if (!rating) return json({ error: "Invalid rating" }, 400);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await store.setJSON(id, {
    id,
    at: new Date().toISOString(),
    rating,
    question: clip(b.question, 1500),
    answer: clip(b.answer, 4000),
    comment: clip(b.comment, 500),
  });
  return json({ ok: true });
};

export const config: Config = { path: "/api/feedback", method: ["GET", "POST"] };
