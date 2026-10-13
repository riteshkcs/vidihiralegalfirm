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
