import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Temporary check. Remove once enquiry email works.
export default async (req: Request) => {
  const apiKey = Netlify.env.get("RESEND_API_KEY");
  const to = Netlify.env.get("NOTIFY_EMAIL");
  const out: Record<string, unknown> = {
    hasResendKey: !!apiKey,
    resendKeyStartsWithRe: !!apiKey && apiKey.startsWith("re_"),
    notifyEmailMasked: to ? to.replace(/^(.{2}).*(@.*)$/, "$1***$2") : null,
    mailFrom: Netlify.env.get("MAIL_FROM") ?? "(default onboarding@resend.dev)",
  };
  try {
    const store = getStore("diagnostics");
    await store.setJSON("ping", { at: new Date().toISOString() });
    out.storageWorks = !!(await store.get("ping", { type: "json" }));
  } catch (e) {
    out.storageWorks = false;
    out.storageError = String(e).slice(0, 300);
  }
  if (apiKey && to) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: Netlify.env.get("MAIL_FROM") || "Vidhira Legal <onboarding@resend.dev>",
          to: [to],
          subject: "Vidhira Legal test email",
          text: "If you can read this, enquiry emails will reach you.",
        }),
      });
      out.resendStatus = res.status;
      out.resendResponse = (await res.text()).slice(0, 500);
    } catch (e) {
      out.resendStatus = "network error";
      out.resendResponse = String(e).slice(0, 300);
    }
  }
  const body = JSON.stringify(out, null, 2).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return new Response(`<!doctype html><title>check</title><pre>${body}</pre>`, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
};

export const config: Config = { path: "/api/check-vl-7f3a", method: ["GET"] };
