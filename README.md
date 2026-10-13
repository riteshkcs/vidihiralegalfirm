# Vidhira Legal website

Static site in `public/` plus one Netlify Function, `netlify/functions/enquiry.mts`, at `POST /api/enquiry`.

Each enquiry is validated, saved to Netlify Blobs (store name `enquiries`), then emailed to the owner through Resend.
The enquiry is saved before the email is attempted, so nothing is lost if email fails.

## Environment variables (Netlify > Project configuration > Environment variables)

| Name | Required | Value |
|---|---|---|
| `RESEND_API_KEY` | yes | API key from resend.com (scope: Functions) |
| `NOTIFY_EMAIL` | yes | Address that receives enquiries |
| `MAIL_FROM` | no | Sender. Defaults to `Vidhira Legal <no-reply@vidhiralegal.in>` (domain verified in Resend). |

Never commit these values. Change them, then redeploy for the change to apply.

## AI Legal Assistant (`/assistant/`)

Claude-style chat page in the site theme. The browser calls `POST /api/chat` (`netlify/functions/chat.mts`), which adds the
system prompt and streams the answer from the OpenAI API. The API key never reaches the browser.

| Name | Required | Value |
|---|---|---|
| `OPENAI_API_KEY` | yes | OpenAI API key (mark as secret, scope: Functions) |
| `CHAT_MODEL` | no | OpenAI model id. Defaults to `gpt-4.1`. |
| `ADMIN_TOKEN` | no | Secret you choose; lets you read feedback at `GET /api/feedback` with header `x-admin-token`. |

- **Lawyer / firm details** the chat may share: edit `netlify/functions/lib/firm.ts`. The assistant only shares what is listed there.
- **Improving answers:** visitors can rate answers; ratings (with that question and answer) are saved to the `chat-feedback` Blobs store.
  Add verified corrections to `KNOWLEDGE` in `firm.ts` and redeploy.
- **Consultation:** when someone asks for a lawyer, the chat shows a form that posts to `/api/enquiry`, so it arrives by email like any other enquiry.
- Rate limit: 40 messages per visitor per hour.
