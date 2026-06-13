# ConForum — Conference Management System

## Overview
ConForum is a full-stack conference management platform that handles the entire lifecycle of academic and professional conferences — from submission to peer review to proceedings generation.

## Architecture
The project has two services that run in parallel:

### 1. `conforum-backend/` — Node.js/Express REST API (port 5000)
The core backend API handling:
- **Authentication**: JWT-based auth with role-based access (Admin, Organizer, Reviewer, Author)
- **Conference Management**: Create, approve/reject conferences
- **Paper Submissions**: Authors upload PDFs stored in Supabase; triggers IEEE compliance check and AI content detection (Eden AI)
- **Peer Review Workflow**: Assign reviewers, collect structured feedback
- **Proceedings Generation**: Compile accepted papers into a PDF using pdf-lib
- **Email Notifications**: Transactional emails via Nodemailer with queue management

### 2. `conforum-ieee-checker/` — Python/Flask microservice (port 6000)
A PDF analysis service that:
- Checks IEEE formatting compliance (layout, fonts, abstract length, headings, references, etc.)
- Called internally by the Node.js backend via HTTP at `http://localhost:6000`
- Uses PyMuPDF (fitz) for advanced PDF parsing

## Database
PostgreSQL managed via **Supabase**. Schema defined in `conforum-backend/schema.sql`.

## Key Dependencies
- **Node.js backend**: express, @supabase/supabase-js, jsonwebtoken, bcrypt, nodemailer, multer, pdf-lib, axios, p-queue
- **Python microservice**: flask, pymupdf

## Workflows
- **Start application**: `cd conforum-backend && node server.js` → port 5000 (webview)
- **Flask IEEE Checker**: `cd conforum-ieee-checker && python3 app.py` → port 6000 (console)

## Environment Variables Required
The following environment variables must be set for full functionality:
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_KEY` — Supabase anon/service key
- `JWT_SECRET` — Secret for signing JWT tokens
- `IEEE_CHECKER_URL` — Set to `http://localhost:6000` (already configured in .replit)
- `PORT` — Set to `5000` (already configured in .replit)
- Email transporter credentials for organizer, reviewer, invitation, otp, and fallback email types

## Project Structure

```
workspace/
├── Conforum Backend/       ← Node.js / Express REST API (Supabase PostgreSQL)
│   ├── config/             # Multer, nodemailer, supabase, env
│   ├── controller/         # Route handlers (all use Supabase)
│   ├── middleware/         # JWT auth & file upload
│   ├── model/              # Legacy Mongoose schemas (unused — kept for reference)
│   ├── routes/             # Express route definitions
│   ├── utils_helpers/      # bcrypt utilities
│   ├── schema.sql          # Supabase PostgreSQL schema (run once in Supabase SQL editor)
│   ├── server.js           # Entry point (no MongoDB)
│   ├── package.json
│   └── .env                # All backend environment variables
│
└── Conforum IEEE Checker/  ← Flask IEEE compliance microservice
    ├── app.py              # Flask app (single file)
    ├── requirements.txt
    └── .env                # FLASK_PORT
```

---

## Database — Supabase PostgreSQL

All data is stored in Supabase PostgreSQL. MongoDB/Mongoose has been fully removed.

### Tables

| Table | Description |
|---|---|
| `users` | User accounts (admins, organizers, authors) |
| `reviewers` | Separate reviewer accounts |
| `conferences` | Conference records |
| `user_conference_roles` | Flat junction: one row per (user, conference, role) |
| `invitations` | Reviewer and organizer invitations (now includes `token` column) |
| `login_otps` | One-time 6-digit codes for login email verification |
| `authors` | Author metadata attached to papers |
| `research_papers` | Submitted papers with compliance/plagiarism JSONB |
| `paper_authors` | Junction: paper ↔ author |
| `assignments` | Reviewer assignments to papers |
| `reviews` | Submitted review forms |
| `technical_weightage` | Per-conference review criteria weights |

**Setup (fresh):** Run `Conforum Backend/schema.sql` once in the Supabase SQL Editor to create all tables.

**Migration (existing DB):** Run these two statements in the Supabase SQL Editor:
```sql
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token TEXT UNIQUE;
CREATE TABLE IF NOT EXISTS login_otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_otps_user ON login_otps (user_id);
```

---

## Invitation Flow (Token-Based)

Invitation links now use a secure random token instead of putting the user's email in the URL. This prevents anyone from manipulating the URL to register with a different email.

- `POST /api/conference/send-invite` — generates a UUID token, stores it on the invitation, sends a link like `/register?role=organizer&token=<uuid>`
- `POST /api/email/invite-reviewers` — same token approach for reviewer invitations
- `GET /api/v1/auth/invitation/:token` — frontend calls this to look up the email/conference from the token before showing the registration form
- Registration (`POST /api/v1/auth/register`) accepts `invitationToken` in the body; the backend looks up the invitation by token to validate the role

## Login OTP Flow

Login is now two-step for extra security:

1. `POST /api/v1/auth/login` — verifies email + password, then sends a 6-digit code to the user's email; returns `{ requiresOtp: true, userId }`
2. `POST /api/v1/auth/verify-otp` — accepts `{ userId, otp }`; if valid and not expired (10 minutes), returns the JWT and user info

The OTP is stored in the `login_otps` table and marked `used = true` once consumed.

## Paper Status Emails

Authors automatically receive email notifications at each stage of the review process:

| Event | Trigger |
|---|---|
| Paper submitted | `POST /api/v1/author/submit-paper` |
| Paper assigned to reviewer(s) | Auto-assign or manual assign by organizer |
| Decision made (Accepted / Rejected / Modification Required) | `POST /api/v1/organizer/update-decision` |

---

## Running Locally

### Node/Express Backend
```bash
cd "conforum-backend"
npm install
node server.js   # port 8080
```

### Flask IEEE Checker
```bash
cd "conforum-ieee-checker"
pip install -r requirements.txt
python app.py    # port 6000
```

---

## Replit Workflows

| Workflow | Command | Port |
|---|---|---|
| **Start application** | `cd "Conforum Backend" && node server.js` | 8080 |
| **Flask IEEE Checker** | `cd "Conforum IEEE Checker" && python app.py` | 6000 |

---

## Environment Variables

### Conforum Backend — `.env`

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Server port (default `8080`) |
| `JWT_SECRET` | Yes | JWT signing secret |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_API_KEY` | Yes | Supabase anon/service-role key |
| `IEEE_CHECKER_URL` | Yes | Flask service URL (default `http://localhost:6000`) |
| `BASE_URL` | No | Frontend base URL used in email links |
| `GMAIL_USER` | No | Gmail address for sending emails |
| `GMAIL_PASSWORD` | No | Gmail App Password |
| `EDEN_API_KEY` | No | Eden AI key for AI content detection |

### Conforum IEEE Checker — `.env`

| Variable | Required | Description |
|---|---|---|
| `FLASK_PORT` | No | Flask port (default `6000`) |

---

## API Base Routes (Node backend — port 8080)

- `GET /` — Health check
- `POST /check-compliance` — Public proxy: forwards PDF to Flask, returns compliance report
- `POST /api/auth/*` — Authentication (register, login, forgot password, profile)
- `GET/PUT /api/auth/user-roles/:userId` — User role lookup
- `POST /api/author/submit-paper` — Paper submission (uploads to Supabase storage)
- `POST /api/author/check-compliance` — IEEE compliance standalone check
- `/api/conference/*` — Conference management (CRUD, approve/reject, invite organizer)
- `/api/organizer/*` — Organizer tools (assign papers, review management, proceedings)
- `/api/email/*` — Reviewer email invitations
- `/api/reviewer/*` — Reviewer accounts and review submission

## Flask IEEE Checker API (port 6000)

- `GET /` — Health check
- `POST /check-compliance` — Accepts PDF (`multipart/form-data`, field `file`), returns compliance JSON

---

## How IEEE Compliance Works

1. Client sends PDF to Node backend (`POST /api/author/check-compliance`)
2. Node backend forwards the PDF to the Flask service (`POST IEEE_CHECKER_URL/check-compliance`)
3. Flask analyzes the PDF with PyMuPDF and returns a structured compliance report
4. Node backend returns the report to the client

External backends (e.g. Railway) set `IEEE_CHECKER_URL` to the public Replit URL so compliance checks proxy through Replit → Flask.

---

## Deployment

Run command: `bash start.sh`  
Deployment type: `vm` (two processes run concurrently — Flask on 6000, Node on 8080).  
Only port 8080 is exposed externally; Flask on 6000 is internal.
