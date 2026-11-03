# CampusVoice AI — Vocal Labs Hackathon MVP

**Speak. Understand. Act.** A voice-first campus grievance assistant built with React, Google Gemini and Supabase. A spoken complaint produces a *real, persisted* service ticket and a spoken confirmation. Tickets are visible in a dashboard and can be updated to Open, In progress, or Resolved. This is the merged release of the initial MVP and the additional implementation notes.

## Features

- Browser microphone transcription (Chrome recommended, English/Hindi/Gujarati language selector).
- Gemini structured intent extraction, category/priority/location/description classification, automatic department assignment.
- Actual Supabase ticket inserts; ticket number, listing, status lookup and status updates.
- Browser voice confirmation with Web SpeechSynthesis; Hindi, Gujarati and English responses.
- Voice question: "How many tickets are open?" uses an exact Supabase count.
- Responsive dashboard, text fallback, visible loading and error states.
- No secret keys in the frontend or repository.

## Prerequisites

- Node.js 20+
- Gemini API key from https://aistudio.google.com/apikey
- Supabase project from https://supabase.com
- GitHub and Vercel accounts for the public live deployment

## 1. Database setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste and run [`db/schema.sql`](db/schema.sql).
3. In **Project Settings > API**, copy the project URL and the **service_role / secret server key**. This key has elevated access, so **never put it in `VITE_*`, browser code, Git, or public screenshots**.

**Use this project's schema as-is.** The alternate draft uses `ticket_code` and a different category list; those are *not compatible* with this merged release. If you already created the old demo table, use a **fresh Supabase project** for the merged version, or carefully migrate your data first. Do not drop a table containing records you need.

## 2. API configuration

Copy `.env.example` to `.env` and insert your own values. The environment variables are intended for **Vercel serverless functions**, not public Vite variables.

| Name | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-side Gemini model access |
| `GEMINI_MODEL` | Default `gemini-2.5-flash` (change if unavailable to your API account) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase privileged key |
| `DEMO_ACCESS_CODE` | Optional code required by API requests; use for judge/demo access |

## 3. Development in Google Antigravity

Unzip/open the `campusvoice-ai` project folder. Open an integrated terminal:

```bash
npm install
npm test
npm run build
```

**Important:** `npm run dev` alone serves only the React frontend; `/api/*` endpoints run as Vercel functions. For a fully functional local test, install the Vercel CLI and run:

```bash
npm install -g vercel
vercel login
vercel link
vercel env pull .env.local
vercel dev
```

Open the URL printed by `vercel dev` (usually `http://localhost:3000`). If you have not configured the Vercel environment yet, use `vercel env add` for each server-side variable or configure them in the project settings, then rerun `vercel env pull .env.local`. You may also use `vercel dev --listen 3000`. Vercel CLI offers interactive configuration when first linking a project.

## 4. Deploy to GitHub and Vercel

Create a **new empty** GitHub repository and, in the project directory, run:

```bash
git init
git add .
git commit -m "Build CampusVoice AI voice ticket assistant"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/campusvoice-ai.git
git push -u origin main
```

1. In https://vercel.com/new, import the repository.
2. Framework should be detected as **Vite**; build command `npm run build`, output `dist`.
3. In **Project > Settings > Environment Variables**, add the variables above. Never use a `VITE_` prefix for secrets.
4. Deploy or redeploy after setting variables.
5. Open the production `https://...vercel.app` link in **Chrome**, allow microphone permission, and test.
6. Submit the GitHub URL and Vercel URL before the hackathon deadline.

## 5. Demo checklist

1. Speak: “The AC in classroom B204 is not working, and we have an exam today.” Verify high priority and Facilities department.
2. Confirm the AI announces a `CV-...` ticket number and shows success.
3. Click **Service Tickets**. See the saved ticket; refresh the page to verify it persists.
4. Change the status to **In progress** then **Resolved**.
5. Speak: “What's the status of ticket CV-0001?” using the actual ID from the dashboard.
6. Speak: “How many tickets are open?” Confirm the count matches non-resolved records.
7. Try the Hindi and Gujarati language selectors. For example: “Mere Hostel A mein paani nahi aa raha hai.”

## Notes and limits

- This is a **demo campus help desk**, not integrated with a real college system. Ticket creation and status changes in its own Supabase database are real.
- Tickets are shared in the demo instance; there is no user identity, departmental routing, or authentication. For a public demo, set `DEMO_ACCESS_CODE` and share that code with judges separately. Production use would require authentication, per-user authorization, rate limiting, audit logs, and stricter permissions.
- SpeechRecognition browser support varies; Chrome desktop is the best initial demo target. Text fallback is provided if speech input is unsupported.
- The current demo limits ticket listings to the most recent 60 and does not send actual emails. Departments are assigned as labels, not contacted.
- If a location is missing, the app asks for one rather than inventing a room. For the clearest demo, include a location in every complaint.
- If an API request fails, no success message is issued. Check Vercel function logs, Gemini quota/model, database table, and environment values.
