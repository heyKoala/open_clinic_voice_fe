# Gunasheela front desk (simplified ManageOPD frontend)

The web app for Gunasheela Surgical & Maternity Hospital's front desk and admin. Patients book by phone
through the AI receptionist (Kavya); this app is where staff see those bookings, move each visit along,
and follow the AI's reminder and feedback calls.

It talks to the ManageOPD backend (`open_clinic_voice_be`) and works alongside the original, full
ManageOPD frontend (`open_clinic_voice_fe`); both use the same backend and database.

## The flow it supports

1. A patient calls the hospital number. The AI answers, books, cancels or reschedules, and answers questions
   from the knowledge base. The call appears in **Call logs** with transcript, recording, AI summary,
   caller mood and an outcome tag (booked, cancelled, rescheduled, information only, needs callback).
2. The booking appears in **Appointments** and the **Calendar**. The day before, the AI places a **reminder call**.
3. On the day, the desk checks the patient in and marks the visit completed on **Visits** (recording any
   follow-up the doctor asked for).
4. The next day the AI places a **feedback call**; a good rating gets the Google review link, a poor one becomes
   a callback task on the **Dashboard**.

## Who sees what

| Role | Lands on | Pages |
| --- | --- | --- |
| Admin | Admin console | Dashboard, Calendar, Appointments, Doctors, Patients, Reports, AI Agent, Integrations, Settings. Can switch to the reception desk from the account menu. |
| Receptionist | Reception desk | Dashboard, Calendar, Appointments, Visits, Patient directory, Call logs |
| Doctor | Doctor workspace | Own queue and patients (separate login; not the focus of this app) |

Main pages, under `src/pages` unless noted:

- `FrontDesk.tsx`: the dashboard. Today's numbers, the task list (check-ins, visits, callbacks, reschedules,
  reminder and feedback calls) and bookings by channel.
- `Visits.tsx`: today's visits with Check in, Visit completed and No-show, plus pending follow-ups.
- `Appointments.tsx` and `src/components/CalendarView.tsx`: every booking, with the patient journey.
- `PatientWorkspace.tsx`: patient directory and record, including call history and follow-ups.
- `Reports.tsx`, `CallDetail.tsx`: call analytics, call logs, transcripts and recordings.
- `AIAgent.tsx`: agent settings (greeting, instructions, models, call audio), call scripts, knowledge base,
  phone number and a browser test call.
- `Integrations.tsx`: WATI (WhatsApp), PMS and Razorpay connections.
- `ClinicSettings.tsx`: hospital details, holidays, reminder and feedback call settings, team, billing.
- `Workspace.tsx`: the shell and routes for each role.

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Zustand, Axios, Recharts, date-fns, and
LiveKit for the in-browser test call.

## Running it

Needs Node 20 or newer and the backend running on port 8001.

```
npm install
npm run dev
```

Open the address Vite prints. The dev server forwards `/api`, `/media` and `/ws` to `http://localhost:8001`,
so the browser only ever talks to the dev server, and the app also works when shared through a tunnel.

Other scripts:

```
npm run build     # type-check and build into dist/
npm run preview   # serve the build locally
npm run lint      # oxlint
```

## Configuration

No environment file is needed for development. Two optional variables, documented in `.env.example`
(copy it to `.env.local`):

- `VITE_API_BASE_URL`: the backend's API address in production when it is on another domain, e.g.
  `https://api.example.com/api/v1`. Empty means `/api/v1` on the app's own address.
- `VITE_PUBLIC_BACKEND_URL`: only for the Test call page, and not needed when the backend has
  `PUBLIC_BASE_URL` set.

Every `VITE_` value ends up in the public JavaScript, so never put keys or secrets here; they belong in the
backend's `.env`.

### From AWS Secrets Manager (deployed builds)

Same pattern as the backend. Before every `npm run build`, `scripts/load-aws-secrets.mjs` runs:

- `USE_AWS_SECRETS` off (the default): nothing changes; the build uses the normal environment.
- On: it reads the JSON secret `AWS_SECRETS_NAME` in `AWS_REGION_NAME` (default `ap-south-1`) with the build
  machine's AWS role and writes its `VITE_*` keys to `.env.production.local` (git-ignored) for Vite. If the
  secret can't be read, the build fails.

```
USE_AWS_SECRETS=True AWS_SECRETS_NAME=<frontend secret> npm run build
```

The secret only needs `{"VITE_API_BASE_URL": "https://clinic-api.heykoala.ai/api/v1"}`. Keys without the `VITE_`
prefix are ignored, and nothing secret may ever use a `VITE_` name, since those values are public.

## Notes for developers

- API calls go through `src/lib/api.ts` (cookie auth, CSRF header, and the active hospital in
  `X-Active-Clinic-Id`). Page-level data loading uses `Promise.allSettled` so one failing endpoint does not
  blank the page.
- Shared types and helpers live in `src/lib` (`appointments.ts`, `analytics.ts`, `patientCalls.ts`,
  `knowledge.ts`, `integrations.ts`, `phone.ts`).
- The hospital currently has one centre; the centre switcher appears only when there is more than one.
- Run `npx tsc -b` before committing; the build fails on type errors.
