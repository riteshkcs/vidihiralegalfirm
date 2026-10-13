import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const MAX = { name: 100, email: 200, clientType: 60, area: 80, message: 2000 };
const CLIENT_TYPES = ["Individual", "Business / organisation", "Not sure yet"];
const AREAS = [
  "Contracts and documents",
  "Business / corporate",
  "Compliance / advisory",
  "Personal legal matter",
  "Other / not sure",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max) : "";

export function validate(input: any) {
  const data = {
    name: clean(input?.name, MAX.name),
    email: clean(input?.email, MAX.email),
    clientType: clean(input?.clientType, MAX.clientType),
    area: clean(input?.area, MAX.area),
    message: clean(input?.message, MAX.message),
  };
  const errors: string[] = [];
  if (data.name.length < 2) errors.push("Please enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) errors.push("Please enter a valid email address.");
  if (!CLIENT_TYPES.includes(data.clientType)) errors.push("Please choose who is enquiring.");
  if (!AREAS.includes(data.area)) errors.push("Please choose an area of enquiry.");
  return { data, errors };
}

async function sendNotification(entry: Record<string, string>, id: string) {
  const apiKey = Netlify.env.get("RESEND_API_KEY");
  const to = Netlify.env.get("NOTIFY_EMAIL");
  if (!apiKey || !to) {
    console.error("Email not configured: set RESEND_API_KEY and NOTIFY_EMAIL.");
    return false;
  }
  const from = Netlify.env.get("MAIL_FROM") || "Vidhira Legal <onboarding@resend.dev>";
  const rows: [string, string][] = [
    ["Name", entry.name],
    ["Email", entry.email],
    ["Enquiring as", entry.clientType],
    ["Area", entry.area],
    ["Received", entry.receivedAt],
    ["Reference", id],
  ];
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:560px">` +
    `<h2 style="margin:0 0 12px">New enquiry on vidhiralegal.in</h2>` +
    `<table style="border-collapse:collapse;width:100%">` +
    rows.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top">${esc(k)}</td><td style="padding:6px 0"><b>${esc(v)}</b></td></tr>`).join("") +
    `</table><h3 style="margin:18px 0 6px">Overview</h3>` +
    `<p style="white-space:pre-wrap;margin:0">${esc(entry.message || "(none given)")}</p>` +
    `<p style="color:#888;font-size:12px;margin-top:18px">Reply to this email to answer ${esc(entry.name)} directly.</p></div>`;
  const text =
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\nOverview:\n${entry.message || "(none given)"}\n`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: entry.email,
      subject: `New enquiry: ${entry.area} (${entry.name})`,
      html,
      text,
    }),
  });
  if (!res.ok) {
    console.error("Resend error", res.status, await res.text());
    return false;
  }
  return true;
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let input: any;
  try {
    input = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  // Spam traps: a hidden field real visitors never fill, and a form that was submitted too fast.
  if (clean(input?.website, 200)) return json({ ok: true });
  const elapsed = Number(input?.elapsedMs);
  if (Number.isFinite(elapsed) && elapsed < 2500) return json({ ok: true });

  const { data, errors } = validate(input);
  if (errors.length) return json({ ok: false, errors }, 400);

  const receivedAt = new Date().toISOString();
  const id = `${receivedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
  const entry = { ...data, receivedAt, emailed: "pending" } as Record<string, string>;

  // 1. Store first, so an enquiry is never lost even if email fails.
  try {
    await getStore("enquiries").setJSON(id, entry);
  } catch (e) {
    console.error("Storage error", e);
    return json({ ok: false, error: "We could not save your enquiry. Please try again." }, 500);
  }

  // 2. Notify by email and record whether it worked.
  let emailed = false;
  try {
    emailed = await sendNotification(entry, id);
  } catch (e) {
    console.error("Email error", e);
  }
  try {
    await getStore("enquiries").setJSON(id, { ...entry, emailed: emailed ? "yes" : "no" });
  } catch (e) {
    console.error("Status update error", e);
  }

  return json({ ok: true, id, emailed });
};

export const config: Config = { path: "/api/enquiry", method: ["POST"] };
