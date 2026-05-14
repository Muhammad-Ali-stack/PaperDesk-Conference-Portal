# ConForum — Conference Management System

A production-grade REST API backend for managing academic and professional conferences. Built with Node.js, Express, and MongoDB.

---

## Features

- JWT-based authentication with role-specific guards
- Multi-role support: Admin, Organizer, Reviewer, Author
- Conference lifecycle management (create, approve, reject)
- Paper submission with Supabase file storage
- IEEE compliance checking via a Python script
- AI content detection via Eden AI
- Reviewer invitation and assignment workflows
- Weighted peer review scoring with configurable criteria
- Proceedings PDF generation using pdf-lib

---

## Folder Structure

```
conforum-backend/
├── config/
│   ├── db.js               # MongoDB connection
│   ├── multer.js           # Multer in-memory storage config
│   ├── nodemailer.js       # Gmail SMTP transporter
│   └── supabase.js         # Supabase client
├── controller/
│   ├── authController.js   # Registration, login, password reset
│   ├── authorController.js # Paper submission, compliance, plagiarism
│   ├── conferenceController.js # Conference CRUD and invite flow
│   ├── emailController.js  # Reviewer email invitations
│   ├── organizerController.js  # Assignments, reviews, proceedings
│   └── reviewerController.js   # Reviewer auth and review submission
├── middleware/
│   ├── authMiddleware.js   # JWT verification and role guards
│   └── multer.js           # File upload middleware
├── model/
│   ├── assignmentModel.js
│   ├── authorModel.js
│   ├── conferenceModel.js
│   ├── InvitationModel.js
│   ├── researchPaperModel.js
│   ├── reviewFormModel.js
│   ├── reviwerModel.js
│   ├── technicalWeightage.js
│   ├── userConferenceModel.js
│   └── userModel.js
├── routes/
│   ├── authRoute.js
│   ├── authorRoute.js
│   ├── conferenceRoute.js
│   ├── emailRoute.js
│   ├── organizerRoute.js
│   └── reviewerRoute.js
├── scripts/
│   └── ieee_checker.py     # IEEE formatting compliance checker
├── utils_helpers/
│   └── authHelper.js       # bcrypt hash and compare utilities
├── .env.example            # Environment variable template
├── package.json
├── server.js               # Entry point
└── start.sh                # Startup script (MongoDB + Node)
```

---

## Prerequisites

- Node.js 20+
- MongoDB (local or MongoDB Atlas)
- Gmail account with App Password enabled
- Supabase project with storage buckets: `paper-submissions`, `proceedings-pdfs`
- Eden AI account with API key (for AI content detection)

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values.

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 8080) |
| `MONGO_URL` | MongoDB connection string |
| `JWT_SECRET` | Secret key for signing JWT tokens |
| `GMAIL_USER` | Gmail address for sending emails |
| `GMAIL_PASSWORD` | Gmail App Password |
| `BASE_URL` | Frontend base URL (used in email invite links) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_API_KEY` | Supabase anon/public API key |
| `EDEN_API_KEY` | Eden AI API key for AI detection |

---

## Running the Server

```bash
node server.js
```

Or using the startup script (also starts MongoDB if running locally):

```bash
bash start.sh
```

---

## API Reference

### Authentication — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | Public | Register a new user |
| POST | `/login` | Public | Login and receive a JWT |
| POST | `/forgot-password` | Public | Reset password via recovery key |
| PUT | `/profile` | JWT | Update user profile |
| GET | `/user-auth` | JWT | Verify user token |
| GET | `/admin-auth` | JWT + Admin | Verify admin token |
| GET | `/user-roles/:userId` | Public | Get all roles for a user |
| GET | `/conferences/:userId` | Public | Get conferences by role |

### Conferences — `/api/conference`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/create-conference` | JWT + Organizer | Create a new conference |
| POST | `/send-invite` | JWT + Admin | Send organizer invitation |
| GET | `/get-conference/:id` | Public | Get conference by ID |
| GET | `/all-conferences` | Public | Get all approved conferences |
| GET | `/all-reg-conferences` | Public | Get all conferences |
| GET | `/pending` | Public | Get pending conferences |
| GET | `/rejected-conferences` | Public | Get rejected conferences |
| PUT | `/update-conference/:id` | Public | Update conference details |
| DELETE | `/delete-conference/:id` | Public | Delete a conference |
| PUT | `/approve/:id` | Public | Approve a conference |
| PUT | `/reject/:id` | Public | Reject a conference |
| GET | `/:acronym` | Public | Get conference by acronym |
| GET | `/:conferenceId/papers` | Public | Get all papers for a conference |

### Authors — `/api/author`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/submit-paper` | Public | Submit a research paper |
| POST | `/check-compliance` | Public | Run IEEE compliance check on a PDF |
| GET | `/research-paper/:id` | Public | Get a paper by ID |
| GET | `/all-research-papers` | Public | Get all papers |
| PUT | `/update-paper-details/:id` | Public | Update a paper |
| DELETE | `/delete-paper/:id/:conferenceId` | Public | Delete a paper |
| GET | `/:userId/:conferenceId/papers` | Public | Get papers by user and conference |

### Reviewers — `/api/reviewer`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register-reviewer` | Public | Register a reviewer account |
| POST | `/login-reviewer` | Public | Login as a reviewer |
| POST | `/check-reviewer-details` | Public | Check if reviewer is registered |
| GET | `/:conferenceId/reviewers` | Public | Get accepted reviewers |
| POST | `/respond-invitation` | Public | Accept or decline invitation |
| GET | `/assigned-papers/reviewer/:reviewerId` | Public | Get assigned papers |
| POST | `/submit-reviewform` | Public | Submit a review form |

### Organizer — `/api/organizer`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/assign-papers/:id` | Public | Auto-assign papers to reviewers |
| POST | `/assign-paper-manual` | Public | Manually assign a paper to a reviewer |
| GET | `/assigned-papers/:conferenceId` | Public | Get all assignments |
| GET | `/review-management/:conferenceId` | Public | Get review management data |
| GET | `/reviews/:paperId` | Public | Get reviews for a paper |
| GET | `/reviews/all-papers` | Public | Get reviews for multiple papers |
| POST | `/update-decision` | Public | Set final decision on a paper |
| POST | `/set-technical-weightage` | Public | Set review score weights |
| GET | `/get-technical-weightage/:conferenceId` | Public | Get score weights |
| POST | `/papers/assigned-reviewers` | Public | Get assignment counts by paper |
| GET | `/get-proceedings-data/:conferenceId` | Public | Get accepted papers for proceedings |
| POST | `/upload-proceedings/:conferenceId` | Public | Generate and upload proceedings PDF |

### Email — `/api/email`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/invite-reviewers` | Public | Send reviewer invitation emails |

---

## Role System

| Role | Access |
|---|---|
| Admin (`role === 1`) | Approves conferences, sends organizer invitations |
| Organizer | Creates and manages conferences they are assigned to |
| Reviewer | Reviews papers assigned to them |
| Author | Submits and manages their research papers |

---

## Gmail Setup

1. Enable 2-Step Verification on your Google account.
2. Go to **Security > App Passwords**.
3. Generate a password for "Mail".
4. Use the generated password as `GMAIL_PASSWORD`.

---

## License

MIT
