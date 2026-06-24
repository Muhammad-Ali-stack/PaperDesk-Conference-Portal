-- ============================================================
-- PaperDesk — Supabase PostgreSQL Schema
-- Version: 2.0
--
-- Changes from v1.x:
--   - Removed password and recovery_key from users (OTP-only auth)
--   - Added trusted_devices table (refresh token store)
--   - Added attempts column to login_otps (brute-force guard)
--   - Added due_date to assignments (review deadlines)
--   - Added validation_info JSONB to research_papers
--   - Added organizer_comments_for_authors to research_papers
--   - Added proceedings_pdf_url and mode to conferences
--   - Added max_resubmissions to conferences
--   - Added corresponding_author to paper_authors
--   - Deprecated: reviewers table (kept for backward compat only)
--
-- Usage:
--   Fresh database  → run this entire file.
--   Existing database → run only the "Safe Migrations" section
--                       at the bottom. Every statement is
--                       idempotent (IF NOT EXISTS / ADD COLUMN IF
--                       NOT EXISTS).
--
-- Design decisions:
--   - RLS is OFF. The backend uses the service-role key which
--     bypasses RLS. Add policies later if you need client-side
--     row security.
--   - All PKs are UUID (gen_random_uuid()).
--   - All timestamps are TIMESTAMPTZ (stored in UTC).
--   - Denormalised columns (conference_name, conference_acronym,
--     organizer_name, organizer_email) are intentional — they
--     keep rows readable after renames or soft-deletes without
--     requiring a join.
-- ============================================================


-- ============================================================
-- TABLE: users
--
-- Central identity table. Every person who touches the system
-- (author, reviewer, organizer, admin) has exactly one row here.
--
-- role:  0 = regular user  |  1 = admin
--
-- No password column — authentication is fully OTP-based.
-- The trusted_devices table holds the long-lived refresh token
-- hashes that let users skip OTP on returning visits.
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL UNIQUE,
  phone       TEXT        NOT NULL,
  address     TEXT        NOT NULL DEFAULT '',
  -- 0 = regular user | 1 = admin
  role        INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: reviewers  [DEPRECATED — do not use for new features]
--
-- Legacy reviewer accounts from the old reviewer-register flow.
-- The current invitation flow stores reviewers in users +
-- user_conference_roles instead. This table is empty in
-- production and exists only so existing foreign keys do not
-- break during the transition period.
-- ============================================================
CREATE TABLE IF NOT EXISTS reviewers (
  id        UUID   NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name      TEXT   NOT NULL,
  email     TEXT   NOT NULL UNIQUE,
  password  TEXT   NOT NULL,
  expertise TEXT[] NOT NULL DEFAULT '{}'
);


-- ============================================================
-- TABLE: conferences
--
-- One row per conference.
--
-- organizer_id → users.id  ON DELETE SET NULL
--   The conference row survives organizer account deletion.
--   organizer_name and organizer_email stay readable without
--   a join — useful for audit and display after deletion.
--   When an admin creates a conference they supply an
--   organizerEmail; the controller resolves it to a user id
--   and stores that id here (never the admin's own id).
--
-- mode:   "single-blind" | "double-blind" | "open"
-- status: "pending" → "approved" | "rejected"
--
-- max_resubmissions: NULL = unlimited. A positive integer caps
--   how many times a paper may be resubmitted per decision cycle.
--   Checked in submitPaperController.
--
-- proceedings_pdf_url: set after the organizer generates the
--   proceedings PDF via proceedingsPdfGenerationController.
-- ============================================================
CREATE TABLE IF NOT EXISTS conferences (
  id                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conference_name      TEXT        NOT NULL,
  -- Short identifier used in URLs and submission links (globally unique)
  acronym              TEXT        NOT NULL UNIQUE,
  web_page             TEXT,
  -- Review blind policy: "single-blind" | "double-blind" | "open"
  mode                 TEXT,
  venue                TEXT,
  city                 TEXT,
  country              TEXT,
  start_date           DATE,
  end_date             DATE,
  abstract_deadline    DATE,
  submission_deadline  DATE,
  primary_area         TEXT,
  secondary_area       TEXT,
  -- Free-form topic tags used for display and search
  topics               TEXT[]      DEFAULT '{}',
  -- Required expertise keywords used when inviting reviewers
  expertise            TEXT[]      DEFAULT '{}',
  -- Lifecycle status: "pending" | "approved" | "rejected"
  status               TEXT        NOT NULL DEFAULT 'pending',
  -- Auto-generated public URL for paper submissions
  submission_link      TEXT,
  -- Denormalised organizer identity (survives account deletion)
  organizer_id         UUID        REFERENCES users (id) ON DELETE SET NULL,
  organizer_name       TEXT,
  organizer_email      TEXT,
  -- Set after the organizer generates the proceedings PDF
  proceedings_pdf_url  TEXT,
  -- NULL = unlimited resubmissions; positive integer caps per-paper rewrites
  max_resubmissions    INTEGER     DEFAULT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: user_conference_roles
--
-- Junction table: one row per (user, conference, role).
-- A user can hold multiple roles across different conferences
-- and also multiple roles within the same conference (e.g.
-- both "author" and "reviewer").
--
-- Roles: "author" | "reviewer" | "organizer"
--
-- conference_id NULL case (organizers only):
--   When an admin invites an organizer before the conference
--   exists, conference_id is NULL. Once the organizer creates
--   their conference this NULL row is replaced with a real one.
--   When an admin creates a conference directly for an existing
--   organizer, the controller inserts a row with the real id
--   immediately (no NULL placeholder needed).
--
-- expertise: populated only when role = 'reviewer'. Stored as
--   an array of keyword strings matching conferences.expertise.
--
-- UNIQUE (user_id, conference_id, role) prevents duplicate
--   assignments. Two NULL conference_ids for the same user and
--   role are not caught by this constraint in PostgreSQL (NULLs
--   are not equal in UNIQUE indexes). Application logic in
--   registerController prevents that edge case.
-- ============================================================
CREATE TABLE IF NOT EXISTS user_conference_roles (
  id             UUID   NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID   NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- NULL only for organizers awaiting conference creation
  conference_id  UUID   REFERENCES conferences (id) ON DELETE CASCADE,
  -- "author" | "reviewer" | "organizer"
  role           TEXT   NOT NULL,
  -- Reviewer keywords; empty array for non-reviewer roles
  expertise      TEXT[] DEFAULT '{}',
  UNIQUE (user_id, conference_id, role)
);


-- ============================================================
-- TABLE: invitations
--
-- Token-based invitations for organizers and reviewers.
--
-- conference_id is NULL for organizer invitations because the
--   conference does not exist yet when the admin sends the invite.
--
-- token: crypto.randomUUID() embedded in the invitation link.
--   The email address is never exposed in the URL.
--
-- user_id: populated once an existing user responds to the
--   invitation (respondToInvitationController). NULL for
--   recipients who have not yet registered.
--
-- status: "pending" → "accepted" | "declined"
-- ============================================================
CREATE TABLE IF NOT EXISTS invitations (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email          TEXT        NOT NULL,
  -- "organizer" | "reviewer"
  role           TEXT        NOT NULL DEFAULT 'reviewer',
  -- NULL for organizer invitations (conference not yet created)
  conference_id  UUID        REFERENCES conferences (id) ON DELETE CASCADE,
  -- Populated after the recipient registers or logs in
  user_id        UUID        REFERENCES users (id) ON DELETE SET NULL,
  -- "pending" | "accepted" | "declined"
  status         TEXT        NOT NULL DEFAULT 'pending',
  -- UUID embedded in the invitation link
  token          TEXT        UNIQUE,
  invited_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: login_otps
--
-- 6-digit one-time codes for passwordless login.
--
-- otp_code: bcrypt hash of the raw 6-digit code. The plain
--   code is emailed to the user and never stored.
--
-- attempts: incremented on each wrong guess. Once it hits
--   MAX_OTP_ATTEMPTS (10), the row is marked used and the
--   user must request a new code. Protects against brute force.
--
-- used: TRUE after a successful verification OR after hitting
--   max attempts. Prevents replay attacks.
--
-- expires_at: NOW() + 10 minutes at insert time.
-- ============================================================
CREATE TABLE IF NOT EXISTS login_otps (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- bcrypt hash of the raw 6-digit code
  otp_code    TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  -- TRUE when verified successfully or max attempts exceeded
  used        BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Failed attempt counter for brute-force protection
  attempts    INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: trusted_devices
--
-- Stores hashed refresh tokens for the trusted-device flow.
-- After a successful OTP, a 64-byte random token is generated,
-- bcrypt-hashed, and stored here. The raw token goes into an
-- HttpOnly Secure cookie on the client (never stored server-side).
--
-- On subsequent logins the cookie is compared against every
-- active hash for the user. A match skips OTP entirely.
--
-- Token rotation: every successful match replaces the old hash
--   with a new one and resets expires_at. The raw old token is
--   invalidated on the client by overwriting the cookie.
--
-- Normal logout:   clears the cookie only. This row is KEPT so
--                  the next login from this device is seamless.
-- Logout all:      deletes ALL rows for the user. Every device
--                  must do OTP on its next login.
-- ============================================================
CREATE TABLE IF NOT EXISTS trusted_devices (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- bcrypt hash of the raw refresh token stored in the client cookie
  token_hash    TEXT        NOT NULL,
  -- Tokens expire 30 days after creation or last use
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: authors
--
-- Author metadata collected at paper submission time.
-- An author row is reused across submissions when the same
-- email is submitted again (submitPaperController does a
-- bulk fetch + upsert to avoid N+1 queries).
--
-- user_id: links back to the user who submitted the paper.
--   NULL for co-authors who do not have a PaperDesk account.
--
-- corresponding_author: TRUE for the primary contact. Stored
--   on the authors row for the single-author case and on
--   paper_authors for multi-author cases.
-- ============================================================
CREATE TABLE IF NOT EXISTS authors (
  id                    UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name            TEXT    NOT NULL,
  last_name             TEXT,
  email                 TEXT    NOT NULL,
  country               TEXT,
  affiliation           TEXT,
  web_page              TEXT,
  -- TRUE for the primary contact author
  corresponding_author  BOOLEAN NOT NULL DEFAULT FALSE,
  -- NULL for co-authors without a PaperDesk account
  user_id               UUID    REFERENCES users (id) ON DELETE SET NULL
);


-- ============================================================
-- TABLE: research_papers
--
-- One row per submitted paper.
--
-- Status lifecycle:
--   "pending"
--     → "assigned"   (after reviewer assignment)
--     → "reviewed"   (after all reviews submitted)
--     → final_decision set by organizer
--   On resubmission: status resets to "resubmitted", then
--   goes through "assigned" → "reviewed" again.
--
-- final_decision:
--   NULL until organizer decides.
--   "Accepted" | "Rejected" | "Modification Required"
--   "Modification Required" resets status to "pending" so
--   the author can resubmit.
--
-- compliance_report: JSONB from the Flask IEEE compliance
--   service. Schema: { percentage: number, details: [] }
--   Initialised with a placeholder at submission; updated
--   asynchronously after the Flask check completes.
--
-- plagiarism_report: reserved for future AI/plagiarism
--   detection. Schema: { score: number, isAIGenerated: bool }
--
-- validation_info: JSONB for any future structured validation
--   metadata from external services. GIN-indexed.
--
-- organizer_plagiarism_score: a 0-100 number entered manually
--   by the organizer. Papers without this score cannot be
--   auto-assigned to reviewers (enforced in controllers).
--
-- organizer_comments_for_authors: free-text feedback written
--   by the organizer when they review a paper directly (the
--   "Review Myself" flow). Shown to authors after the decision
--   is published. NULL when paper goes through normal reviewer flow.
--
-- resubmission_count: incremented on every resubmission.
--   Checked against conferences.max_resubmissions.
--
-- manuscript_number: unique ID generated at submission time.
--   Format: NED2026-<Acronym>-<n> where n is the per-conference
--   sequential number.
--
-- conference_id: ON DELETE SET NULL (safety net only).
--   deleteConferenceController explicitly deletes papers and
--   storage files before deleting the conference, so this
--   column should never actually become NULL in practice.
--
-- conference_name / conference_acronym: denormalised so paper
--   listings are readable after a conference is renamed or
--   deleted without a join.
-- ============================================================
CREATE TABLE IF NOT EXISTS research_papers (
  id                              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title                           TEXT,
  abstract                        TEXT,
  keywords                        TEXT[]      DEFAULT '{}',
  -- Supabase Storage public URL for the uploaded PDF
  paper_file_path                 TEXT,
  -- Safety net; controller deletes papers before the conference
  conference_id                   UUID        REFERENCES conferences (id) ON DELETE SET NULL,
  -- Denormalised for display without a join
  conference_name                 TEXT,
  conference_acronym              TEXT,
  -- "pending" | "resubmitted" | "assigned" | "reviewed"
  status                          TEXT        NOT NULL DEFAULT 'pending',
  -- NULL until set: "Accepted" | "Rejected" | "Modification Required"
  final_decision                  TEXT        DEFAULT NULL,
  -- IEEE compliance result; placeholder inserted at submission time
  compliance_report               JSONB       NOT NULL DEFAULT '{"percentage": 0, "details": []}',
  -- Reserved for future plagiarism / AI detection
  plagiarism_report               JSONB       NOT NULL DEFAULT '{"score": 0, "isAIGenerated": false}',
  -- Structured validation metadata from external services (GIN indexed)
  validation_info                 JSONB       DEFAULT NULL,
  -- Manually entered by the organizer before reviewer assignment
  organizer_plagiarism_score      NUMERIC     DEFAULT NULL,
  -- Organizer feedback shown to authors in the "Review Myself" flow
  organizer_comments_for_authors  TEXT        DEFAULT NULL,
  -- Incremented on every resubmission
  resubmission_count              INTEGER     NOT NULL DEFAULT 0,
  -- Unique manuscript ID: NED2026-<Acronym>-<n>
  manuscript_number               TEXT        DEFAULT NULL,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: paper_authors
--
-- Junction table linking research_papers → authors.
-- Composite PK prevents duplicate linkings.
-- CASCADE deletes clean up orphan rows when a paper or author
-- is removed.
--
-- corresponding_author: TRUE for the primary contact on this
--   specific paper (a person can be corresponding on one paper
--   and not on another).
-- ============================================================
CREATE TABLE IF NOT EXISTS paper_authors (
  paper_id              UUID    NOT NULL REFERENCES research_papers (id) ON DELETE CASCADE,
  author_id             UUID    NOT NULL REFERENCES authors (id)         ON DELETE CASCADE,
  -- TRUE for the primary contact on this specific paper
  corresponding_author  BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (paper_id, author_id)
);


-- ============================================================
-- TABLE: assignments
--
-- Tracks which reviewer is assigned to which paper for a given
-- conference.
--
-- Business rules (enforced in application logic):
--   - Maximum 3 reviewers per paper.
--   - All assignments for the same paper share the same due_date.
--     updateAssignmentDueDateController updates all rows for a
--     paper_id in a single query.
--
-- reviewer_id → users (not reviewers). All reviewers go through
--   the invitation flow and live in the users table.
--
-- due_date: optional review deadline in UTC. NULL = no deadline.
--   The organizer sets it when assigning or via the edit control.
--   The frontend converts UTC → local timezone via the browser
--   Intl API — timezone is never stored.
--
-- reminder_sent: TRUE once the 2-day-before-deadline reminder
--   email has been sent. Prevents the background reminderService
--   from sending duplicate reminders.
-- ============================================================
CREATE TABLE IF NOT EXISTS assignments (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id       UUID        NOT NULL REFERENCES research_papers (id) ON DELETE CASCADE,
  -- FK to users (invited reviewers live in the users table)
  reviewer_id    UUID        NOT NULL REFERENCES users (id)            ON DELETE CASCADE,
  conference_id  UUID        NOT NULL REFERENCES conferences (id)      ON DELETE CASCADE,
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Optional review deadline in UTC. NULL = no deadline set.
  -- All assignments for the same paper_id share this value.
  due_date       TIMESTAMPTZ          DEFAULT NULL,
  -- TRUE once a 2-day reminder email has been sent for this assignment
  reminder_sent  BOOLEAN     NOT NULL DEFAULT FALSE,
  UNIQUE (paper_id, reviewer_id)
);


-- ============================================================
-- TABLE: reviews
--
-- One review per (paper, reviewer) pair.
-- All reviews for a paper are deleted when the paper is
-- resubmitted so the reviewer portal shows the paper as
-- "pending review" again (updatePaperController).
--
-- Score fields (1–10 integers supplied by the reviewer):
--   originality, technical_quality, significance,
--   clarity, relevance
--
-- technical_confidence: weighted composite score calculated
--   server-side using technical_weightage for the conference.
--   Formula: (originality×w1 + technical_quality×w2 + …) / 100
--
-- overall_recommendation:
--   "Accept" | "Accept with minor correction" | "Reject"
--
-- comments_for_authors:    visible to paper authors.
-- comments_for_organizers: visible only to the organizer.
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id                       UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id                 UUID        NOT NULL REFERENCES research_papers (id) ON DELETE CASCADE,
  -- FK to users (the reviewer's main account)
  reviewer_id              UUID        NOT NULL REFERENCES users (id)           ON DELETE CASCADE,
  -- Reviewer-supplied integer scores (1–10)
  originality              INTEGER,
  technical_quality        INTEGER,
  significance             INTEGER,
  clarity                  INTEGER,
  relevance                INTEGER,
  -- "Accept" | "Accept with minor correction" | "Reject"
  overall_recommendation   TEXT,
  -- Shown to paper authors after the decision is published
  comments_for_authors     TEXT,
  -- Shown only to the organizer
  comments_for_organizers  TEXT,
  -- Weighted composite score computed at review submission time
  technical_confidence     NUMERIC,
  reviewed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: technical_weightage
--
-- Per-conference weighting for the five review criteria.
-- Weights must sum to 100 (enforced in setTechnicalWeightageController).
--
-- Used by submitReviewFormController to compute technical_confidence.
--
-- Default weights when no row exists for a conference:
--   originality=30, technical_quality=25, significance=20,
--   clarity=15, relevance=10
-- ============================================================
CREATE TABLE IF NOT EXISTS technical_weightage (
  id                UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- One row per conference; upsert on conference_id
  conference_id     UUID    NOT NULL UNIQUE REFERENCES conferences (id) ON DELETE CASCADE,
  originality       INTEGER NOT NULL DEFAULT 30,
  technical_quality INTEGER NOT NULL DEFAULT 25,
  significance      INTEGER NOT NULL DEFAULT 20,
  clarity           INTEGER NOT NULL DEFAULT 15,
  relevance         INTEGER NOT NULL DEFAULT 10
);


-- ============================================================
-- INDEXES
--
-- All indexes named: idx_<table>_<column(s)>
-- Implicit indexes already exist on every PRIMARY KEY and
-- UNIQUE constraint — those are not duplicated here.
-- ============================================================

-- users
-- (email already indexed by the UNIQUE constraint)

-- user_conference_roles — filtered by all three columns in hot paths
CREATE INDEX IF NOT EXISTS idx_ucr_user
  ON user_conference_roles (user_id);

CREATE INDEX IF NOT EXISTS idx_ucr_conference
  ON user_conference_roles (conference_id);

CREATE INDEX IF NOT EXISTS idx_ucr_role
  ON user_conference_roles (role);

-- conferences
CREATE INDEX IF NOT EXISTS idx_conferences_status
  ON conferences (status);

-- (acronym already indexed by the UNIQUE constraint)

-- invitations
CREATE INDEX IF NOT EXISTS idx_invitations_email
  ON invitations (email);

-- (token already indexed by the UNIQUE constraint)

-- login_otps
CREATE INDEX IF NOT EXISTS idx_login_otps_user
  ON login_otps (user_id);

-- trusted_devices
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user
  ON trusted_devices (user_id);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_expires
  ON trusted_devices (expires_at);

-- authors
CREATE INDEX IF NOT EXISTS idx_authors_email
  ON authors (email);

CREATE INDEX IF NOT EXISTS idx_authors_user
  ON authors (user_id);

-- research_papers
CREATE INDEX IF NOT EXISTS idx_papers_conference
  ON research_papers (conference_id);

CREATE INDEX IF NOT EXISTS idx_papers_status
  ON research_papers (status);

CREATE INDEX IF NOT EXISTS idx_papers_final_decision
  ON research_papers (final_decision);

CREATE INDEX IF NOT EXISTS idx_papers_validation
  ON research_papers USING GIN (validation_info);

-- paper_authors — join from both directions
CREATE INDEX IF NOT EXISTS idx_paper_authors_paper
  ON paper_authors (paper_id);

CREATE INDEX IF NOT EXISTS idx_paper_authors_author
  ON paper_authors (author_id);

-- assignments
CREATE INDEX IF NOT EXISTS idx_assignments_paper
  ON assignments (paper_id);

CREATE INDEX IF NOT EXISTS idx_assignments_reviewer
  ON assignments (reviewer_id);

CREATE INDEX IF NOT EXISTS idx_assignments_conference
  ON assignments (conference_id);

CREATE INDEX IF NOT EXISTS idx_assignments_due_date
  ON assignments (due_date);

-- reviews
CREATE INDEX IF NOT EXISTS idx_reviews_paper
  ON reviews (paper_id);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewer
  ON reviews (reviewer_id);


-- ============================================================
-- SAFE MIGRATIONS
--
-- Run ONLY this section on an existing database.
-- Every statement is idempotent — safe to run multiple times.
-- ============================================================

-- users: remove password auth (login is now OTP-only)
ALTER TABLE users DROP COLUMN IF EXISTS password;
ALTER TABLE users DROP COLUMN IF EXISTS recovery_key;

-- users: address was NOT NULL without a default in v1 — add a default
-- so existing rows with empty address are valid
ALTER TABLE users ALTER COLUMN address SET DEFAULT '';

-- conferences: columns added after v1.0 deployment
ALTER TABLE conferences ADD COLUMN IF NOT EXISTS max_resubmissions    INTEGER DEFAULT NULL;
ALTER TABLE conferences ADD COLUMN IF NOT EXISTS proceedings_pdf_url  TEXT;
ALTER TABLE conferences ADD COLUMN IF NOT EXISTS mode                 TEXT;

-- user_conference_roles: expertise for reviewer roles
ALTER TABLE user_conference_roles ADD COLUMN IF NOT EXISTS expertise TEXT[] DEFAULT '{}';

-- invitations: token and user_id added post-v1
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token   TEXT UNIQUE;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users (id) ON DELETE SET NULL;

-- login_otps: attempt counter for brute-force protection
ALTER TABLE login_otps ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

-- trusted_devices: full table (introduced in v2.0)
CREATE TABLE IF NOT EXISTS trusted_devices (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash    TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user    ON trusted_devices (user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_expires ON trusted_devices (expires_at);

-- authors: columns added post-v1
ALTER TABLE authors ADD COLUMN IF NOT EXISTS web_page TEXT;
ALTER TABLE authors ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES users (id) ON DELETE SET NULL;

-- research_papers: columns added post-v1
ALTER TABLE research_papers ADD COLUMN IF NOT EXISTS organizer_plagiarism_score     NUMERIC  DEFAULT NULL;
ALTER TABLE research_papers ADD COLUMN IF NOT EXISTS resubmission_count             INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE research_papers ADD COLUMN IF NOT EXISTS final_decision                 TEXT     DEFAULT NULL;
ALTER TABLE research_papers ADD COLUMN IF NOT EXISTS plagiarism_report              JSONB    NOT NULL DEFAULT '{"score": 0, "isAIGenerated": false}';
ALTER TABLE research_papers ADD COLUMN IF NOT EXISTS conference_acronym             TEXT;
ALTER TABLE research_papers ADD COLUMN IF NOT EXISTS organizer_comments_for_authors TEXT     DEFAULT NULL;
ALTER TABLE research_papers ADD COLUMN IF NOT EXISTS validation_info                JSONB    DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_papers_validation ON research_papers USING GIN (validation_info);

-- assignments: columns added post-v1
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS due_date       TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS reminder_sent  BOOLEAN     NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments (due_date);

-- reviews: columns added post-v1
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS comments_for_organizers TEXT;

-- paper_authors: corresponding_author flag per paper
ALTER TABLE paper_authors ADD COLUMN IF NOT EXISTS corresponding_author BOOLEAN NOT NULL DEFAULT FALSE;

-- users: password auth columns (introduced in v2.1)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_key_hash  TEXT;