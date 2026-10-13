import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { FIRM, KNOWLEDGE } from "./lib/firm.ts";

const MODEL_DEFAULT = "gpt-4.1";
const MAX_MESSAGES = 24;
const MAX_CHARS = 4000;
const MAX_TOKENS = 1500;
const HOURLY_LIMIT = 40; // messages per visitor per hour

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function buildSystem() {
  const lawyers = FIRM.lawyers.length
    ? FIRM.lawyers
        .map(
          (l) =>
            `- ${l.name}${l.role ? `, ${l.role}` : ""}${l.city ? ` (${l.city})` : ""}` +
            `${l.areas?.length ? `; areas: ${l.areas.join(", ")}` : ""}` +
            `${l.languages?.length ? `; languages: ${l.languages.join(", ")}` : ""}` +
            `${l.note ? `; ${l.note}` : ""}`,
        )
        .join("\n")
    : "(No individual lawyer profiles are published yet.)";
  const contact = [
    FIRM.email && `Email: ${FIRM.email}`,
    FIRM.phone && `Phone: ${FIRM.phone}`,
    FIRM.address && `Address: ${FIRM.address}`,
    FIRM.hours && `Hours: ${FIRM.hours}`,
  ]
    .filter(Boolean)
    .join("\n") || "(Contact details are not published; direct people to the consultation request form.)";

  return `You are the AI Legal Assistant on the website of ${FIRM.name} (${FIRM.website}), a law firm in India. You give clear, accurate, general legal information and guidance about Indian law, in plain language, to ordinary people and small businesses.

HOW TO ANSWER
- Answer the question that was asked, directly, in the first lines. Then give the useful detail: the relevant law (Act and section where you are confident), the usual procedure, which forum or authority is involved, typical time limits, documents needed, and practical next steps.
- Indian law only, unless asked otherwise. Name central Acts correctly. State laws vary: say so and name the state if it matters. If you are unsure of a section number, a figure or a recent amendment, say so rather than guess.
- Remember the new criminal codes: BNS, BNSS and BSA replaced the IPC, CrPC and Evidence Act from 1 July 2024. Give the new provision and, where useful, the old one.
- Ask ONE short clarifying question when the answer truly depends on a missing fact (state, dates, who the parties are). Otherwise answer first, and then mention what would change the answer.
- Reply in the language the user writes in (English, Hindi, Hinglish or another Indian language).
- Be warm, calm and concrete. Short paragraphs and short lists. Use **bold** for key terms. No filler, no repeated disclaimers.
- Keep answers focused: usually 120-350 words unless the user asks for more.

SAFETY AND LIMITS
- You provide general information, not legal advice, and you do not create a lawyer-client relationship. Say this briefly once when it matters (for example before advising on a high-stakes decision), not in every message.
- Never help plan or hide a crime, evade lawful process, forge documents, intimidate or harass anyone. Decline briefly and explain the lawful route instead.
- For arrest, violence, threats, domestic abuse, child safety, or any urgent risk: first give emergency steps and numbers (Police 112, Women Helpline 181, Child Helpline 1098, Cyber Crime 1930), then the legal information.
- Tell people not to share sensitive documents or confidential details in this chat.
- Do not predict case outcomes with certainty. Do not give a guarantee. Mention limitation periods and urgent deadlines when relevant.
- Laws change. For recent amendments or court rulings you are not sure about, say your information may be outdated and suggest checking indiacode.nic.in, the relevant court website, or a lawyer.
- If the question is not about law, say you can only help with legal information, and offer to help with a legal angle.

CONSULTING A LAWYER
- If the user says they want a lawyer, advocate, consultation, to hire, to speak to someone, or asks for lawyer details: be helpful, give the firm's details below, and end your reply with the exact marker [[CONSULT]] on its own last line. The page will then show a consultation request form. Do not mention the marker.
- Only share lawyer names and details listed below. NEVER invent, guess or recommend any individual lawyer, firm or phone number that is not listed here. If nothing is listed, say the firm's team will respond to a consultation request, and add the marker.
- If the matter needs a lawyer urgently (arrest, court notice with a date, injunction, eviction, police summons), recommend consulting one promptly and add the marker, even if the user did not ask.
- If the user cannot afford a lawyer, also mention free legal aid through the District Legal Services Authority and NALSA (helpline 15100).

FIRM
Name: ${FIRM.name}
${contact}
Lawyers:
${lawyers}

VERIFIED NOTES
${KNOWLEDGE.map((k) => "- " + k).join("\n")}`;
}

async function sha(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function overLimit(ip: string) {
  try {
    const store = getStore("chat-limits");
    const key = (await sha(ip)) + "-" + new Date().toISOString().slice(0, 13);
    const cur = Number((await store.get(key)) ?? 0);
    if (cur >= HOURLY_LIMIT) return true;
    await store.set(key, String(cur + 1));
    return false;
  } catch (e) {
    console.warn("rate-limit store unavailable", e);
    return false;
  }
}

export function cleanMessages(input: any): { role: "user" | "assistant"; content: string }[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of input.slice(-MAX_MESSAGES)) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return null;
    const content = m.content.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, MAX_CHARS);
    if (!content) continue;
    out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  // merge consecutive same-role messages so the API alternation rule holds
  const merged: typeof out = [];
  for (const m of out) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content;
    else merged.push({ ...m });
  }
  if (!merged.length || merged[merged.length - 1].role !== "user") return null;
  return merged;
}

export default async (req: Request, context: Context) => {
  if (req.method === "GET") {
    return json({
      name: FIRM.name,
      email: FIRM.email,
      phone: FIRM.phone,
      address: FIRM.address,
      hours: FIRM.hours,
      lawyers: FIRM.lawyers,
    });
  }

  const apiKey = Netlify.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set");
    return json({ error: "The assistant is not available right now. Please try again later." }, 503);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const messages = cleanMessages(body?.messages);
  if (!messages) return json({ error: "Please type a question." }, 400);

  const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  if (await overLimit(ip)) {
    return json({ error: "You have reached the hourly limit for this assistant. Please try again later, or send an enquiry to the firm." }, 429);
  }

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: Netlify.env.get("CHAT_MODEL") || MODEL_DEFAULT,
      max_completion_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: buildSystem() }, ...messages],
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("OpenAI error", upstream.status, detail.slice(0, 500));
    const busy = upstream.status === 429 || upstream.status >= 500;
    return json(
      { error: busy ? "The assistant is busy. Please try again in a moment." : "The assistant could not answer just now. Please try again." },
      502,
    );
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const send = (c: ReadableStreamDefaultController, o: unknown) => c.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buf = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            let ev: any;
            try { ev = JSON.parse(payload); } catch { continue; }
            if (ev.error) send(controller, { error: "The assistant was interrupted. Please try again." });
            else {
              const t = ev.choices?.[0]?.delta?.content;
              if (t) send(controller, { t });
            }
          }
        }
        send(controller, { done: true });
      } catch (e) {
        console.error("stream error", e);
        send(controller, { error: "The connection was interrupted. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
};

export const config: Config = { path: "/api/chat", method: ["GET", "POST"] };
