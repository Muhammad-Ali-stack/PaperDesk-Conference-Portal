-- ============================================================
-- PaperDesk — Development Seed Data  v3.0
-- ============================================================
--
-- HOW TO USE
--   1. Run schema.sql in full first (creates all tables + indexes).
--   2. Apply every statement in schema.sql's "SAFE MIGRATIONS"
--      section (idempotent — safe to run again).
--   3. Then run this file.
--
-- CREDENTIALS  (all seed accounts share the same values)
--   Password    : password123
--   Recovery key: recoverykey123
--   bcrypt hash : $2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6
--
-- IDEMPOTENCY
--   The file is fully idempotent. Run it repeatedly on the same
--   database — the wipe block at the top removes only seed rows
--   identified by the @paperdesk.dev email domain and the fixed
--   seed conference acronyms, so real data is never touched.
--
-- WHAT IS COVERED
--   ✓ users            — admin, 2 organizers, 3 reviewers, 3 authors,
--                         1 reviewer-author (conflict-of-interest case)
--   ✓ conferences      — 3 conferences across every status
--   ✓ user_conference_roles
--   ✓ invitations      — pending / accepted / declined / organizer
--   ✓ authors          — corresponding + co-authors + external
--   ✓ research_papers  — every status: pending, assigned, reviewed,
--                         Accepted, Rejected, Modification Required,
--                         resubmitted (after modification)
--   ✓ paper_authors
--   ✓ assignments      — full (3 reviewers), partial (2), none
--   ✓ reviews          — scores match the ICSE2025 custom weights
--                         exactly as submitReviewFormController computes
--   ✓ technical_weightage — custom for ICSE2025, default elsewhere
--   ✓ login_otps       — one expired (used), one fresh (unused)
--   ✓ trusted_devices  — one active device record per reviewer
--
-- CONFLICT-OF-INTEREST TEST CASE
--   Henry (reviewer_author@paperdesk.dev) holds both the "reviewer"
--   and "author" roles on ICSE2025. Paper P4 lists him as author.
--   The backend MUST block assigning him to review P4.
--   That constraint is deliberately NOT in the assignments table here.
-- ============================================================


-- ============================================================
-- SECTION 0 — SAFE MIGRATIONS
-- Run these before any inserts so every column referenced below
-- already exists, even on databases created before v2.0.
-- ============================================================
ALTER TABLE login_otps
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE research_papers
  ADD COLUMN IF NOT EXISTS validation_info JSONB DEFAULT NULL;

ALTER TABLE research_papers
  ADD COLUMN IF NOT EXISTS organizer_comments_for_authors TEXT DEFAULT NULL;

ALTER TABLE research_papers
  ADD COLUMN IF NOT EXISTS organizer_plagiarism_score NUMERIC DEFAULT NULL;

ALTER TABLE research_papers
  ADD COLUMN IF NOT EXISTS resubmission_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE research_papers
  ADD COLUMN IF NOT EXISTS final_decision TEXT DEFAULT NULL;

ALTER TABLE research_papers
  ADD COLUMN IF NOT EXISTS conference_acronym TEXT;

ALTER TABLE research_papers
  ADD COLUMN IF NOT EXISTS plagiarism_report JSONB
    NOT NULL DEFAULT '{"score": 0, "isAIGenerated": false}';

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS comments_for_organizers TEXT;

ALTER TABLE conferences
  ADD COLUMN IF NOT EXISTS max_resubmissions INTEGER DEFAULT NULL;

ALTER TABLE conferences
  ADD COLUMN IF NOT EXISTS proceedings_pdf_url TEXT;

ALTER TABLE conferences
  ADD COLUMN IF NOT EXISTS mode TEXT;

ALTER TABLE user_conference_roles
  ADD COLUMN IF NOT EXISTS expertise TEXT[] DEFAULT '{}';

ALTER TABLE authors
  ADD COLUMN IF NOT EXISTS web_page TEXT;

ALTER TABLE authors
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE;

ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users (id) ON DELETE SET NULL;

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


-- ============================================================
-- SECTION 1 — WIPE SEED DATA (idempotent re-run)
-- Delete in FK-safe order: children before parents.
-- Only touches rows belonging to the @paperdesk.dev domain
-- and the three fixed seed conference acronyms.
-- ============================================================
DO $$
DECLARE
  seed_user_ids UUID[];
  seed_conf_ids UUID[];
  seed_paper_ids UUID[];
BEGIN
  seed_user_ids := ARRAY(
    SELECT id FROM users WHERE email LIKE '%@paperdesk.dev'
  );
  seed_conf_ids := ARRAY(
    SELECT id FROM conferences WHERE acronym IN ('ICSE2025', 'ML2025', 'SECS2025')
  );
  seed_paper_ids := ARRAY(
    SELECT id FROM research_papers WHERE conference_id = ANY(seed_conf_ids)
  );

  DELETE FROM trusted_devices WHERE user_id = ANY(seed_user_ids);
  DELETE FROM login_otps       WHERE user_id = ANY(seed_user_ids);
  DELETE FROM reviews          WHERE paper_id = ANY(seed_paper_ids)
                                  OR reviewer_id = ANY(seed_user_ids);
  DELETE FROM assignments      WHERE conference_id = ANY(seed_conf_ids);
  DELETE FROM paper_authors    WHERE paper_id = ANY(seed_paper_ids);
  DELETE FROM research_papers  WHERE conference_id = ANY(seed_conf_ids);
  DELETE FROM technical_weightage WHERE conference_id = ANY(seed_conf_ids);
  DELETE FROM invitations      WHERE conference_id = ANY(seed_conf_ids)
                                  OR conference_id IS NULL
                                  AND token LIKE 'seed_%';
  DELETE FROM user_conference_roles WHERE user_id = ANY(seed_user_ids);
  DELETE FROM conferences      WHERE acronym IN ('ICSE2025', 'ML2025', 'SECS2025');
  DELETE FROM authors          WHERE email LIKE '%@paperdesk.dev'
                                  OR email = 'coauthor.external@example.com';
  DELETE FROM users            WHERE email LIKE '%@paperdesk.dev';
END $$;


-- ============================================================
-- SECTION 2 — USERS
-- role: 0 = regular user | 1 = admin
-- All share bcrypt hash of "password123" and "recoverykey123".
-- ============================================================
INSERT INTO users
  (id, name, email, password, phone, address, recovery_key, role)
VALUES
  -- ── Admin ────────────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000001',
   'System Admin',
   'admin@paperdesk.dev',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   '+1-555-0100',
   '1 Admin Plaza, San Francisco, CA 94102',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   1),

  -- ── Organizers ───────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000010',
   'Dr. Alice Chen',
   'organizer1@paperdesk.dev',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   '+1-555-0101',
   '42 University Ave, Cambridge, MA 02139',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   0),
  ('00000000-0000-0000-0000-000000000011',
   'Prof. Bob Martinez',
   'organizer2@paperdesk.dev',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   '+1-555-0102',
   '88 Research Blvd, Princeton, NJ 08540',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   0),

  -- ── Reviewers ────────────────────────────────────────────
  -- (invited via user_conference_roles, not the legacy reviewers table)
  ('00000000-0000-0000-0000-000000000020',
   'Dr. Carol Singh',
   'reviewer1@paperdesk.dev',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   '+1-555-0201',
   '10 Science Park, Boston, MA 02110',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   0),
  ('00000000-0000-0000-0000-000000000021',
   'Dr. Daniel Kim',
   'reviewer2@paperdesk.dev',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   '+1-555-0202',
   '55 Tech Square, Austin, TX 73301',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   0),
  ('00000000-0000-0000-0000-000000000022',
   'Dr. Eva Nakamura',
   'reviewer3@paperdesk.dev',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   '+1-555-0203',
   '7 Maple Street, Seattle, WA 98101',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   0),

  -- ── Authors ──────────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000030',
   'Frank Okonkwo',
   'author1@paperdesk.dev',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   '+1-555-0301',
   '3 Academic Drive, New Haven, CT 06510',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   0),
  ('00000000-0000-0000-0000-000000000031',
   'Grace Petrova',
   'author2@paperdesk.dev',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   '+1-555-0302',
   '19 Innovation Loop, Chicago, IL 60601',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   0),

  -- ── Reviewer-Author (conflict-of-interest test) ───────────
  -- This user holds BOTH reviewer and author roles on ICSE2025.
  -- Paper P4 lists this user as an author.
  -- manuallyAssignPaperController and assignPapersToReviewersController
  -- MUST reject assigning this user as a reviewer for P4.
  ('00000000-0000-0000-0000-000000000032',
   'Henry Walsh',
   'reviewer_author@paperdesk.dev',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   '+1-555-0303',
   '2 Crossroads Ave, Denver, CO 80201',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   0);


-- ============================================================
-- SECTION 3 — CONFERENCES
-- Three conferences exercising every status.
-- ============================================================
INSERT INTO conferences (
  id, conference_name, acronym, web_page, mode,
  venue, city, country, start_date, end_date,
  abstract_deadline, submission_deadline,
  primary_area, secondary_area, topics, expertise,
  status, submission_link,
  organizer_id, organizer_name, organizer_email,
  max_resubmissions
) VALUES

  -- ── ICSE2025 — approved, full lifecycle ───────────────────
  ('10000000-0000-0000-0000-000000000001',
   'International Conference on Software Engineering 2025',
   'ICSE2025',
   'https://icse2025.paperdesk.dev',
   'double-blind',
   'Moscone Convention Center, Hall A',
   'San Francisco', 'USA',
   '2025-10-15', '2025-10-18',
   '2025-06-01', '2025-07-01',
   'Software Engineering', 'Artificial Intelligence',
   ARRAY['software engineering','testing','DevOps','AI','ML','security'],
   ARRAY['software engineering','testing','DevOps','artificial intelligence','security'],
   'approved',
   'https://paperdesk.dev/submit/ICSE2025',
   '00000000-0000-0000-0000-000000000010',
   'Dr. Alice Chen',
   'organizer1@paperdesk.dev',
   3),

  -- ── ML2025 — pending admin approval ─────────────────────
  ('10000000-0000-0000-0000-000000000002',
   'International Workshop on Machine Learning 2025',
   'ML2025',
   'https://ml2025.paperdesk.dev',
   'single-blind',
   'Royal Lancaster Hotel',
   'London', 'UK',
   '2025-11-05', '2025-11-07',
   '2025-07-15', '2025-08-15',
   'Machine Learning', 'Data Science',
   ARRAY['machine learning','deep learning','neural networks','NLP','computer vision'],
   ARRAY['machine learning','deep learning','NLP','computer vision'],
   'pending',
   'https://paperdesk.dev/submit/ML2025',
   '00000000-0000-0000-0000-000000000011',
   'Prof. Bob Martinez',
   'organizer2@paperdesk.dev',
   NULL),

  -- ── SECS2025 — approved, has a rejected paper ─────────────
  ('10000000-0000-0000-0000-000000000003',
   'Symposium on Emerging Computing Systems 2025',
   'SECS2025',
   'https://secs2025.paperdesk.dev',
   'open',
   'MaRS Discovery District, Auditorium',
   'Toronto', 'Canada',
   '2025-12-01', '2025-12-03',
   '2025-08-01', '2025-09-01',
   'Computer Systems', 'Distributed Systems',
   ARRAY['distributed systems','cloud computing','edge computing','IoT','fault tolerance'],
   ARRAY['distributed systems','cloud computing','edge computing'],
   'approved',
   'https://paperdesk.dev/submit/SECS2025',
   '00000000-0000-0000-0000-000000000011',
   'Prof. Bob Martinez',
   'organizer2@paperdesk.dev',
   2);


-- ============================================================
-- SECTION 4 — USER_CONFERENCE_ROLES
-- ============================================================
INSERT INTO user_conference_roles (user_id, conference_id, role, expertise) VALUES

  -- ── Organizer roles ───────────────────────────────────────
  ('00000000-0000-0000-0000-000000000010',
   '10000000-0000-0000-0000-000000000001', 'organizer', '{}'),
  ('00000000-0000-0000-0000-000000000011',
   '10000000-0000-0000-0000-000000000002', 'organizer', '{}'),
  ('00000000-0000-0000-0000-000000000011',
   '10000000-0000-0000-0000-000000000003', 'organizer', '{}'),

  -- ── Reviewer roles — ICSE2025 ────────────────────────────
  ('00000000-0000-0000-0000-000000000020',
   '10000000-0000-0000-0000-000000000001', 'reviewer',
   ARRAY['software engineering','testing','DevOps']),
  ('00000000-0000-0000-0000-000000000021',
   '10000000-0000-0000-0000-000000000001', 'reviewer',
   ARRAY['artificial intelligence','ML','software engineering']),
  ('00000000-0000-0000-0000-000000000022',
   '10000000-0000-0000-0000-000000000001', 'reviewer',
   ARRAY['security','software engineering','testing']),
  -- Henry: reviewer on ICSE2025, but also an author of P4 → conflict guard fires
  ('00000000-0000-0000-0000-000000000032',
   '10000000-0000-0000-0000-000000000001', 'reviewer',
   ARRAY['software engineering','testing']),

  -- ── Reviewer roles — SECS2025 ────────────────────────────
  ('00000000-0000-0000-0000-000000000020',
   '10000000-0000-0000-0000-000000000003', 'reviewer',
   ARRAY['distributed systems','cloud computing']),
  ('00000000-0000-0000-0000-000000000021',
   '10000000-0000-0000-0000-000000000003', 'reviewer',
   ARRAY['edge computing','IoT','distributed systems']),

  -- ── Author roles ─────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000030',
   '10000000-0000-0000-0000-000000000001', 'author', '{}'),
  ('00000000-0000-0000-0000-000000000031',
   '10000000-0000-0000-0000-000000000001', 'author', '{}'),
  ('00000000-0000-0000-0000-000000000030',
   '10000000-0000-0000-0000-000000000003', 'author', '{}'),
  -- Henry: holds both reviewer + author on ICSE2025
  ('00000000-0000-0000-0000-000000000032',
   '10000000-0000-0000-0000-000000000001', 'author', '{}');


-- ============================================================
-- SECTION 5 — AUTHORS  (paper-submission metadata)
-- ============================================================
INSERT INTO authors
  (id, first_name, last_name, email, country, affiliation,
   web_page, corresponding_author, user_id)
VALUES
  ('20000000-0000-0000-0000-000000000001',
   'Frank', 'Okonkwo', 'author1@paperdesk.dev',
   'USA', 'MIT CSAIL',
   'https://frankokonkwo.mit.edu', TRUE,
   '00000000-0000-0000-0000-000000000030'),

  ('20000000-0000-0000-0000-000000000002',
   'Grace', 'Petrova', 'author2@paperdesk.dev',
   'USA', 'Stanford Computer Science',
   'https://gracepetrova.stanford.edu', FALSE,
   '00000000-0000-0000-0000-000000000031'),

  -- Henry: the reviewer-author whose papers must block him from self-review
  ('20000000-0000-0000-0000-000000000003',
   'Henry', 'Walsh', 'reviewer_author@paperdesk.dev',
   'USA', 'Carnegie Mellon University',
   NULL, TRUE,
   '00000000-0000-0000-0000-000000000032'),

  -- External co-author (no PaperDesk account — user_id is NULL)
  ('20000000-0000-0000-0000-000000000004',
   'Irene', 'Fontaine', 'coauthor.external@example.com',
   'Canada', 'University of Toronto',
   NULL, FALSE,
   NULL);


-- ============================================================
-- SECTION 6 — RESEARCH PAPERS
--
-- Status progression reference:
--   pending → assigned → reviewed → (Accepted | Rejected |
--                                    Modification Required)
--   Modification Required resets status to "pending" so author
--   can resubmit; resubmission_count increments.
--   After resubmit, status = "resubmitted" and cycle repeats.
--
-- Papers seeded (all ICSE2025 unless noted):
--   P1  — reviewed + Accepted  (3 reviews, organizer comment)
--   P2  — assigned             (2 reviewers, no reviews yet)
--   P3  — pending              (no plagiarism score, not assignable)
--   P4  — pending w/ score     (authored by Henry — COI test)
--   P5  — reviewed + Modification Required (resubmission_count=0)
--   P6  — resubmitted          (was P5 after author resubmit,
--                               status reset, count=1)
--          ↑ represented as a separate paper row to show two
--            distinct lifecycle rows side by side in the UI
--   P7  — SECS2025, reviewed + Rejected  (2 reviews)
--   P8  — ML2025,  pending              (no reviewers yet)
-- ============================================================
INSERT INTO research_papers (
  id, title, abstract, keywords,
  paper_file_path,
  conference_id, conference_name, conference_acronym,
  status, final_decision,
  organizer_plagiarism_score, resubmission_count,
  organizer_comments_for_authors, validation_info
) VALUES

  -- ── P1: Accepted ─────────────────────────────────────────
  ('30000000-0000-0000-0000-000000000001',
   'Towards Automated Testing of Microservice Architectures',
   'This paper presents a novel approach to automated integration testing for microservice-based systems. We introduce a lightweight instrumentation layer that captures inter-service communication patterns and generates test cases automatically using a combination of dynamic analysis and constraint solving. A controlled experiment on five open-source microservice benchmarks shows a 73% reduction in manual test-writing effort with equivalent fault-detection rates.',
   ARRAY['microservices','testing','automation','integration testing','dynamic analysis'],
   'seed/paper-submissions/p1_microservice_testing.pdf',
   '10000000-0000-0000-0000-000000000001',
   'International Conference on Software Engineering 2025', 'ICSE2025',
   'reviewed', 'Accepted',
   12.5, 0,
   'Excellent contribution. The evaluation section is particularly strong. Camera-ready instructions will follow.',
   '{"isValid":true,"message":"PDF is valid and ready for submission.","fileInfo":{"pages":10,"sizeMB":"1.45","author":"Frank Okonkwo"}}'::jsonb),

  -- ── P2: Assigned — 2 reviewers active, no reviews yet ────
  ('30000000-0000-0000-0000-000000000002',
   'DevSecOps Pipeline Hardening: A Systematic Approach',
   'Software supply chain attacks have increased significantly in recent years. This paper proposes a systematic methodology for hardening CI/CD pipelines against both insider threats and external supply chain compromises, including automated SBOM generation, policy-as-code enforcement, and real-time anomaly detection. We evaluate the approach on three large open-source projects.',
   ARRAY['DevOps','security','CI/CD','supply chain','SBOM'],
   'seed/paper-submissions/p2_devsecops.pdf',
   '10000000-0000-0000-0000-000000000001',
   'International Conference on Software Engineering 2025', 'ICSE2025',
   'assigned', NULL,
   8.0, 0,
   NULL,
   '{"isValid":true,"message":"PDF is valid and ready for submission.","fileInfo":{"pages":12,"sizeMB":"2.10","author":"Grace Petrova"}}'::jsonb),

  -- ── P3: Pending — no plagiarism score (not yet assignable) ──
  ('30000000-0000-0000-0000-000000000003',
   'LLM-Assisted Code Review: Opportunities and Pitfalls',
   'Large language models have demonstrated impressive code understanding capabilities. In this paper we conduct an empirical study of LLM-assisted code review across 10,000 open-source pull requests, quantifying the rate of missed defects, false positives, and reviewer workload reduction. Our findings suggest that LLMs are most effective for stylistic issues but miss 40% of semantic bugs that human reviewers catch.',
   ARRAY['LLM','code review','AI','software engineering','empirical study'],
   'seed/paper-submissions/p3_llm_code_review.pdf',
   '10000000-0000-0000-0000-000000000001',
   'International Conference on Software Engineering 2025', 'ICSE2025',
   'pending', NULL,
   NULL, 0,  -- No plagiarism score: auto-assign will skip this paper
   NULL,
   '{"isValid":true,"message":"PDF is valid and ready for submission.","fileInfo":{"pages":8,"sizeMB":"0.95","author":"Frank Okonkwo"}}'::jsonb),

  -- ── P4: Pending — authored by Henry (COI test case) ───────
  -- Henry is also a reviewer on ICSE2025.
  -- getAcceptedReviewersController MUST return isConflict:true for Henry.
  -- manuallyAssignPaperController MUST reject assigning Henry to this paper.
  -- assignPapersToReviewersController MUST skip Henry for this paper.
  ('30000000-0000-0000-0000-000000000004',
   'Conflict-of-Interest Detection in Academic Peer Review Systems',
   'Automated conflict-of-interest detection is critical for fair peer review. This paper surveys existing approaches across 20 conference management systems, identifies gaps, and proposes a graph-based method that models direct co-authorship, institutional affiliation, and indirect collaboration paths. We demonstrate a 94% recall rate on a gold-standard COI annotation dataset.',
   ARRAY['peer review','conflict of interest','software engineering','fairness','graph algorithms'],
   'seed/paper-submissions/p4_coi_detection.pdf',
   '10000000-0000-0000-0000-000000000001',
   'International Conference on Software Engineering 2025', 'ICSE2025',
   'pending', NULL,
   5.0, 0,
   NULL,
   '{"isValid":true,"message":"PDF is valid and ready for submission.","fileInfo":{"pages":9,"sizeMB":"1.20","author":"Henry Walsh"}}'::jsonb),

  -- ── P5: Modification Required (first round, not yet resubmitted) ──
  ('30000000-0000-0000-0000-000000000005',
   'Static Analysis for Detecting Race Conditions in Go Programs',
   'Go is widely adopted for concurrent systems programming, yet race conditions remain a persistent source of bugs. This paper presents GoRace, a static analysis tool that detects potential race conditions in Go programs by constructing a happens-before graph from source code. We evaluate GoRace on 50 real-world Go repositories, finding 128 previously unreported race conditions.',
   ARRAY['static analysis','concurrency','Go','race conditions','program analysis'],
   'seed/paper-submissions/p5_gorace.pdf',
   '10000000-0000-0000-0000-000000000001',
   'International Conference on Software Engineering 2025', 'ICSE2025',
   'pending', 'Modification Required',
   -- status resets to "pending" when decision = "Modification Required"
   -- so the author can upload a revised PDF
   15.0, 0,
   NULL,
   '{"isValid":true,"message":"PDF is valid and ready for submission.","fileInfo":{"pages":11,"sizeMB":"1.80","author":"Grace Petrova"}}'::jsonb),

  -- ── P6: Resubmitted — same paper after P5 modification ────
  -- resubmission_count = 1, status = "resubmitted" awaiting re-assignment
  ('30000000-0000-0000-0000-000000000006',
   'Static Analysis for Detecting Race Conditions in Go Programs (Revised)',
   'Go is widely adopted for concurrent systems programming, yet race conditions remain a persistent source of bugs. This revised version addresses reviewer comments from the first round. GoRace is extended with alias analysis and inter-procedural reasoning, improving precision by 22%. We evaluate on 65 real-world Go repositories, finding 172 previously unreported race conditions.',
   ARRAY['static analysis','concurrency','Go','race conditions','program analysis','alias analysis'],
   'seed/paper-submissions/p6_gorace_revised.pdf',
   '10000000-0000-0000-0000-000000000001',
   'International Conference on Software Engineering 2025', 'ICSE2025',
   'resubmitted', NULL,
   15.0, 1,
   NULL,
   '{"isValid":true,"message":"PDF is valid and ready for submission.","fileInfo":{"pages":13,"sizeMB":"2.05","author":"Grace Petrova"}}'::jsonb),

  -- ── P7: SECS2025 — reviewed + Rejected ─────────────────
  ('30000000-0000-0000-0000-000000000007',
   'A Survey of Edge Computing Paradigms for IoT Applications',
   'Edge computing has emerged as a critical enabler for latency-sensitive IoT applications. This survey categorises existing edge computing paradigms, benchmarks representative frameworks under realistic IoT workloads, and identifies open research challenges. Unfortunately the survey methodology lacks rigor and misses a significant body of related work published in 2024.',
   ARRAY['edge computing','IoT','distributed systems','cloud computing','survey'],
   'seed/paper-submissions/p7_edge_survey.pdf',
   '10000000-0000-0000-0000-000000000003',
   'Symposium on Emerging Computing Systems 2025', 'SECS2025',
   'reviewed', 'Rejected',
   22.0, 1,
   NULL,
   '{"isValid":true,"message":"PDF is valid and ready for submission.","fileInfo":{"pages":15,"sizeMB":"3.80","author":"Frank Okonkwo"}}'::jsonb),

  -- ── P8: ML2025 — pending (conference itself is pending) ───
  ('30000000-0000-0000-0000-000000000008',
   'Efficient Fine-Tuning of Large Language Models via Sparse Adapter Networks',
   'Full fine-tuning of large language models is prohibitively expensive for most practitioners. We propose SparseAdapters, a parameter-efficient fine-tuning method that inserts sparse, structured adapters between transformer layers. SparseAdapters achieves within 1.2% of full fine-tuning accuracy on GLUE benchmarks while reducing trainable parameters by 97% and GPU memory usage by 60%.',
   ARRAY['LLM','fine-tuning','parameter efficient','adapters','NLP','transformers'],
   'seed/paper-submissions/p8_sparse_adapters.pdf',
   '10000000-0000-0000-0000-000000000002',
   'International Workshop on Machine Learning 2025', 'ML2025',
   'pending', NULL,
   NULL, 0,
   NULL,
   '{"isValid":true,"message":"PDF is valid and ready for submission.","fileInfo":{"pages":9,"sizeMB":"1.10","author":"Grace Petrova"}}'::jsonb);


-- ============================================================
-- SECTION 7 — PAPER_AUTHORS
-- ============================================================
INSERT INTO paper_authors (paper_id, author_id) VALUES
  -- P1: Frank (corresponding) + Irene (external co-author)
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004'),

  -- P2: Grace (corresponding)
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002'),

  -- P3: Frank + Grace
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002'),

  -- P4: Henry — COI: he must not be assigned as a reviewer for this paper
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003'),

  -- P5: Grace (original submission)
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002'),

  -- P6: Grace (revised submission — same author)
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002'),

  -- P7: Frank (SECS2025)
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001'),

  -- P8: Grace (ML2025)
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002');


-- ============================================================
-- SECTION 8 — ASSIGNMENTS
--
-- ICSE2025 custom weights: originality=35, technical_quality=25,
-- significance=20, clarity=12, relevance=8  (sum=100)
--
-- SECS2025 uses system defaults: 30/25/20/15/10
-- ============================================================
INSERT INTO assignments
  (id, paper_id, reviewer_id, conference_id, due_date)
VALUES
  -- ── P1: 3 reviewers (fully assigned, all have reviewed) ──
  ('40000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000020',  -- Carol
   '10000000-0000-0000-0000-000000000001',
   '2025-08-15 23:59:00+00'),
  ('40000000-0000-0000-0000-000000000002',
   '30000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000021',  -- Daniel
   '10000000-0000-0000-0000-000000000001',
   '2025-08-15 23:59:00+00'),
  ('40000000-0000-0000-0000-000000000003',
   '30000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000022',  -- Eva
   '10000000-0000-0000-0000-000000000001',
   '2025-08-15 23:59:00+00'),

  -- ── P2: 2 reviewers (assigned, no reviews submitted yet) ─
  ('40000000-0000-0000-0000-000000000004',
   '30000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000020',  -- Carol
   '10000000-0000-0000-0000-000000000001',
   '2025-08-20 23:59:00+00'),
  ('40000000-0000-0000-0000-000000000005',
   '30000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000021',  -- Daniel
   '10000000-0000-0000-0000-000000000001',
   '2025-08-20 23:59:00+00'),

  -- ── P5: was assigned and reviewed before Modification Reqd ──
  ('40000000-0000-0000-0000-000000000008',
   '30000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000021',  -- Daniel
   '10000000-0000-0000-0000-000000000001',
   '2025-08-25 23:59:00+00'),
  ('40000000-0000-0000-0000-000000000009',
   '30000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000022',  -- Eva
   '10000000-0000-0000-0000-000000000001',
   '2025-08-25 23:59:00+00'),

  -- ── P7: SECS2025 — 2 reviewers, both reviewed → Rejected ─
  ('40000000-0000-0000-0000-000000000006',
   '30000000-0000-0000-0000-000000000007',
   '00000000-0000-0000-0000-000000000020',  -- Carol
   '10000000-0000-0000-0000-000000000003',
   '2025-10-01 23:59:00+00'),
  ('40000000-0000-0000-0000-000000000007',
   '30000000-0000-0000-0000-000000000007',
   '00000000-0000-0000-0000-000000000021',  -- Daniel
   '10000000-0000-0000-0000-000000000003',
   '2025-10-01 23:59:00+00');

-- P3, P4, P6, P8 are deliberately unassigned:
--   P3 — no plagiarism score yet (auto-assign would skip it)
--   P4 — pending assignment; Henry MUST NOT be assigned (COI guard)
--   P6 — resubmitted, awaiting a fresh assignment round
--   P8 — ML2025 conference itself is still pending


-- ============================================================
-- SECTION 9 — REVIEWS
--
-- technical_confidence is computed server-side by submitReviewFormController:
--   (score * weight / 100) summed over the five criteria.
--
-- ICSE2025 weights:  originality=35, tq=25, sig=20, clar=12, rel=8
-- SECS2025 defaults: originality=30, tq=25, sig=20, clar=15, rel=10
--
-- Worked examples:
--
-- P1 / Carol  (9,8,9,8,7):
--   (9×35 + 8×25 + 9×20 + 8×12 + 7×8) / 100
--   = (315 + 200 + 180 + 96 + 56) / 100 = 847/100 = 8.47
--
-- P1 / Daniel (8,9,8,9,8):
--   (8×35 + 9×25 + 8×20 + 9×12 + 8×8) / 100
--   = (280 + 225 + 160 + 108 + 64) / 100 = 837/100 = 8.37
--
-- P1 / Eva    (8,7,8,8,9):
--   (8×35 + 7×25 + 8×20 + 8×12 + 9×8) / 100
--   = (280 + 175 + 160 + 96 + 72) / 100 = 783/100 = 7.83
--
-- P5 / Daniel (6,7,6,7,5):
--   (6×35 + 7×25 + 6×20 + 7×12 + 5×8) / 100
--   = (210 + 175 + 120 + 84 + 40) / 100 = 629/100 = 6.29
--
-- P5 / Eva    (5,6,5,6,5):
--   (5×35 + 6×25 + 5×20 + 6×12 + 5×8) / 100
--   = (175 + 150 + 100 + 72 + 40) / 100 = 537/100 = 5.37
--
-- P7 / Carol  (4,5,4,6,5) — SECS2025 defaults:
--   (4×30 + 5×25 + 4×20 + 6×15 + 5×10) / 100
--   = (120 + 125 + 80 + 90 + 50) / 100 = 465/100 = 4.65
--
-- P7 / Daniel (3,4,3,5,4) — SECS2025 defaults:
--   (3×30 + 4×25 + 3×20 + 5×15 + 4×10) / 100
--   = (90 + 100 + 60 + 75 + 40) / 100 = 365/100 = 3.65
-- ============================================================
INSERT INTO reviews (
  id, paper_id, reviewer_id,
  originality, technical_quality, significance, clarity, relevance,
  overall_recommendation,
  comments_for_authors, comments_for_organizers,
  technical_confidence
) VALUES

  -- ── P1 × Carol — Accept ──────────────────────────────────
  ('50000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000020',
   9, 8, 9, 8, 7,
   'Accept',
   'A significant contribution to automated testing in microservice environments. The evaluation is rigorous and the results are convincing. Minor suggestion: add a discussion on scalability limits of the instrumentation layer when service counts exceed a few hundred.',
   'Strong paper. Ready for acceptance with minor revisions to the scalability discussion.',
   8.47),

  -- ── P1 × Daniel — Accept with minor correction ───────────
  ('50000000-0000-0000-0000-000000000002',
   '30000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000021',
   8, 9, 8, 9, 8,
   'Accept with minor correction',
   'Good contribution. The related work section could be expanded to cover recent work on chaos engineering. The threat to validity discussion is thorough and appreciated.',
   'Recommend accept. Ask authors to expand the related work section.',
   8.37),

  -- ── P1 × Eva — Accept ────────────────────────────────────
  ('50000000-0000-0000-0000-000000000003',
   '30000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000022',
   8, 7, 8, 8, 9,
   'Accept',
   'Well-written paper with a clear problem statement and sound methodology. The tool is open-sourced which is a plus for reproducibility. I would appreciate a brief discussion on false-negative rates.',
   'Accept. Good reproducibility story. Minor: discuss false-negative rate.',
   7.83),

  -- ── P5 × Daniel — Modification Required ─────────────────
  ('50000000-0000-0000-0000-000000000004',
   '30000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000021',
   6, 7, 6, 7, 5,
   'Accept with minor correction',
   'The core idea is sound but the evaluation is limited. Please add inter-procedural analysis and evaluate on a larger benchmark set (at least 30 repositories). Also address the alias-analysis gap noted in Section 4.',
   'Promising work but needs a stronger evaluation. Request modification.',
   6.29),

  -- ── P5 × Eva — Modification Required ────────────────────
  ('50000000-0000-0000-0000-000000000005',
   '30000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000022',
   5, 6, 5, 6, 5,
   'Accept with minor correction',
   'The paper addresses an important problem. However, the false-positive rate of 38% is too high for a practical tool. Please reduce false positives and provide a comparison with existing race detectors (e.g., Go race detector, TSan).',
   'Needs significant improvement in precision before acceptance. Modification required.',
   5.37),

  -- ── P7 × Carol — Reject (SECS2025, default weights) ─────
  ('50000000-0000-0000-0000-000000000006',
   '30000000-0000-0000-0000-000000000007',
   '00000000-0000-0000-0000-000000000020',
   4, 5, 4, 6, 5,
   'Reject',
   'The survey provides a broad overview but lacks methodological rigor. The literature search is undocumented, the taxonomy is ad hoc, and a significant number of 2024 papers are missing. Without a systematic review protocol the contribution does not meet the bar for SECS.',
   'Reject. Survey methodology is insufficient for a top-tier venue.',
   4.65),

  -- ── P7 × Daniel — Reject (SECS2025, default weights) ────
  ('50000000-0000-0000-0000-000000000007',
   '30000000-0000-0000-0000-000000000007',
   '00000000-0000-0000-0000-000000000021',
   3, 4, 3, 5, 4,
   'Reject',
   'I agree with the other reviewer. The paper misses foundational work on fog computing and recent serverless edge frameworks. The claims about latency improvements are unsupported by the benchmarks provided. Reject.',
   'Reject. Incomplete coverage and unsupported performance claims.',
   3.65);


-- ============================================================
-- SECTION 10 — TECHNICAL WEIGHTAGE
-- ICSE2025 uses custom weights (sum = 100).
-- SECS2025 and ML2025 use system defaults (30/25/20/15/10).
-- ============================================================
INSERT INTO technical_weightage
  (conference_id, originality, technical_quality, significance, clarity, relevance)
VALUES
  ('10000000-0000-0000-0000-000000000001', 35, 25, 20, 12, 8);
--  35 + 25 + 20 + 12 + 8 = 100 ✓


-- ============================================================
-- SECTION 11 — INVITATIONS
-- ============================================================
INSERT INTO invitations
  (id, user_id, email, conference_id, role, status, token)
VALUES
  -- Pending reviewer invitation for ICSE2025 (not yet acted on)
  ('60000000-0000-0000-0000-000000000001',
   NULL,
   'new_reviewer@external.example.com',
   '10000000-0000-0000-0000-000000000001',
   'reviewer', 'pending',
   'seed_inv_icse_reviewer_pending'),

  -- Accepted reviewer invitation — Carol's record (already processed)
  ('60000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000020',
   'reviewer1@paperdesk.dev',
   '10000000-0000-0000-0000-000000000001',
   'reviewer', 'accepted',
   'seed_inv_icse_carol_accepted'),

  -- Accepted reviewer invitation — Daniel's record
  ('60000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000021',
   'reviewer2@paperdesk.dev',
   '10000000-0000-0000-0000-000000000001',
   'reviewer', 'accepted',
   'seed_inv_icse_daniel_accepted'),

  -- Accepted reviewer invitation — Eva's record
  ('60000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000022',
   'reviewer3@paperdesk.dev',
   '10000000-0000-0000-0000-000000000001',
   'reviewer', 'accepted',
   'seed_inv_icse_eva_accepted'),

  -- Accepted reviewer invitation — Henry (reviewer-author)
  ('60000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000032',
   'reviewer_author@paperdesk.dev',
   '10000000-0000-0000-0000-000000000001',
   'reviewer', 'accepted',
   'seed_inv_icse_henry_accepted'),

  -- Declined invitation — SECS2025
  ('60000000-0000-0000-0000-000000000006',
   NULL,
   'declined_reviewer@external.example.com',
   '10000000-0000-0000-0000-000000000003',
   'reviewer', 'declined',
   'seed_inv_secs_declined'),

  -- Pending reviewer invitation — ML2025
  ('60000000-0000-0000-0000-000000000007',
   NULL,
   'ml_reviewer@university.example.com',
   '10000000-0000-0000-0000-000000000002',
   'reviewer', 'pending',
   'seed_inv_ml2025_reviewer_pending'),

  -- Pending organizer invitation — future conference (no conference_id yet)
  ('60000000-0000-0000-0000-000000000008',
   NULL,
   'future_organizer@university.example.com',
   NULL,
   'organizer', 'pending',
   'seed_inv_organizer_future');


-- ============================================================
-- SECTION 12 — LOGIN_OTPS
-- Demonstrates the two states of the login_otps table.
-- ============================================================
INSERT INTO login_otps
  (id, user_id, otp_code, expires_at, used, attempts, created_at)
VALUES
  -- Expired and used OTP (Carol already verified; otp_code is a bcrypt hash)
  ('70000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000020',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   NOW() - INTERVAL '30 minutes',  -- already expired
   TRUE,
   0,
   NOW() - INTERVAL '40 minutes'),

  -- An OTP that was brute-forced and burned (5 failed attempts)
  ('70000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000031',  -- Grace
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   NOW() + INTERVAL '5 minutes',
   TRUE,   -- marked used after hitting MAX_OTP_ATTEMPTS
   5,
   NOW() - INTERVAL '5 minutes');


-- ============================================================
-- SECTION 13 — TRUSTED_DEVICES
-- One active device per reviewer to simulate trusted-device flow.
-- token_hash values are bcrypt hashes of dummy raw tokens.
-- Raw tokens are never stored here — only the hash.
-- ============================================================
INSERT INTO trusted_devices
  (id, user_id, token_hash, expires_at, created_at, last_used_at)
VALUES
  -- Carol's laptop (active, expires in 25 days)
  ('80000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000020',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   NOW() + INTERVAL '25 days',
   NOW() - INTERVAL '5 days',
   NOW() - INTERVAL '1 hour'),

  -- Daniel's workstation (active, expires in 28 days)
  ('80000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000021',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   NOW() + INTERVAL '28 days',
   NOW() - INTERVAL '2 days',
   NOW() - INTERVAL '3 hours'),

  -- Organizer Alice's device (active)
  ('80000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000010',
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   NOW() + INTERVAL '20 days',
   NOW() - INTERVAL '10 days',
   NOW() - INTERVAL '2 hours'),

  -- Expired device (should be ignored by refreshTokenController)
  ('80000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000022',  -- Eva
   '$2b$10$4garfWKductUlBYSpeufxeQXwq6rzaxBPcehrNwiR4YLkwTIQsWL6',
   NOW() - INTERVAL '3 days',   -- already expired
   NOW() - INTERVAL '33 days',
   NOW() - INTERVAL '3 days');


-- ============================================================
-- SECTION 14 — VERIFICATION QUERIES
-- Uncomment and run in the SQL Editor to confirm row counts.
-- ============================================================
/*
SELECT 'users'               AS table_name, COUNT(*) AS rows FROM users             WHERE email LIKE '%@paperdesk.dev'
UNION ALL
SELECT 'conferences',                        COUNT(*) FROM conferences              WHERE acronym IN ('ICSE2025','ML2025','SECS2025')
UNION ALL
SELECT 'user_conference_roles',              COUNT(*) FROM user_conference_roles    WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@paperdesk.dev')
UNION ALL
SELECT 'authors',                            COUNT(*) FROM authors                  WHERE email LIKE '%@paperdesk.dev' OR email = 'coauthor.external@example.com'
UNION ALL
SELECT 'research_papers',                    COUNT(*) FROM research_papers          WHERE conference_id IN (SELECT id FROM conferences WHERE acronym IN ('ICSE2025','ML2025','SECS2025'))
UNION ALL
SELECT 'paper_authors',                      COUNT(*) FROM paper_authors            WHERE paper_id IN (SELECT id FROM research_papers WHERE conference_id IN (SELECT id FROM conferences WHERE acronym IN ('ICSE2025','ML2025','SECS2025')))
UNION ALL
SELECT 'assignments',                        COUNT(*) FROM assignments              WHERE conference_id IN (SELECT id FROM conferences WHERE acronym IN ('ICSE2025','ML2025','SECS2025'))
UNION ALL
SELECT 'reviews',                            COUNT(*) FROM reviews                  WHERE paper_id IN (SELECT id FROM research_papers WHERE conference_id IN (SELECT id FROM conferences WHERE acronym IN ('ICSE2025','ML2025','SECS2025')))
UNION ALL
SELECT 'technical_weightage',               COUNT(*) FROM technical_weightage      WHERE conference_id IN (SELECT id FROM conferences WHERE acronym IN ('ICSE2025','ML2025','SECS2025'))
UNION ALL
SELECT 'invitations',                        COUNT(*) FROM invitations              WHERE token LIKE 'seed_%'
UNION ALL
SELECT 'login_otps',                         COUNT(*) FROM login_otps              WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@paperdesk.dev')
UNION ALL
SELECT 'trusted_devices',                    COUNT(*) FROM trusted_devices         WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@paperdesk.dev')
ORDER BY table_name;

-- Expected counts:
--   assignments            9   (P1×3, P2×2, P5×2, P7×2)
--   authors                4   (Frank, Grace, Henry, Irene)
--   conferences            3   (ICSE2025, ML2025, SECS2025)
--   invitations            8
--   login_otps             2
--   paper_authors         10   (P1:2, P2:1, P3:2, P4:1, P5:1, P6:1, P7:1, P8:1)
--   research_papers        8   (P1–P8)
--   reviews                7   (P1×3, P5×2, P7×2)
--   technical_weightage    1   (ICSE2025 custom; SECS2025+ML2025 use defaults)
--   trusted_devices        4   (Carol, Daniel, Alice, Eva-expired)
--   user_conference_roles 13   (3 organizer, 4+2 reviewer, 3+1 author)
--   users                  9   (1 admin, 2 organizers, 3 reviewers, 2 authors, 1 reviewer-author)
*/
