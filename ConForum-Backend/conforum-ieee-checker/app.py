import os
import re
import unicodedata
from collections import defaultdict

import fitz
from flask import Flask, request, jsonify

app = Flask(__name__)

MAX_UPLOAD_MB = 20
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Words that look like names but are not person names.
# Used to filter false positives from the name detection patterns.
_NON_NAME_WORDS = frozenset({
    "IEEE", "International", "Conference", "Journal", "Transactions", "Abstract",
    "Index", "Terms", "Introduction", "Conclusion", "References", "University",
    "Institute", "Department", "School", "College", "Faculty", "Laboratory",
    "Center", "Centre", "Research", "Science", "Technology", "Engineering",
    "Computer", "Information", "Systems", "Digital", "Data", "Network",
    "Artificial", "Machine", "Deep", "Neural", "Natural", "Language",
    "Fig", "Table", "Section", "This", "The", "And", "For", "With", "From",
    "Based", "Using", "Method", "Approach", "Study", "Analysis", "Design",
    "New", "Novel", "Improved", "Enhanced", "Advanced", "Smart", "Robust",
    "Proposed", "Review", "Survey", "Application", "Implementation", "Model",
    "System", "Framework", "Algorithm", "Efficient", "Optimal", "Multiple",
    "Received", "Accepted", "Published", "Revised", "Manuscript", "Paper",
    "Work", "Result", "Performance", "Evaluation", "Experiment", "Dataset",
    "Learning", "Training", "Testing", "Validation", "Feature", "Detection",
    "Classification", "Prediction", "Optimization", "Generation", "Recognition",
    "January", "February", "March", "April", "June", "July", "August",
    "September", "October", "November", "December",
})

# Compiled regex patterns for name and email detection.
# Order matters: three-part names must be checked before two-part names.

# "John Smith" or "John A. Smith"
_NAME_PATTERN = re.compile(
    r"\b([A-Z][a-z]{1,20})(?:\s+[A-Z]{1,2}\.)?\s+([A-Z][a-z]{1,20})\b"
)

# "J. Smith" or "J. A. Smith"
_INITIAL_NAME_PATTERN = re.compile(
    r"\b([A-Z]\.\s*){1,2}([A-Z][a-z]{1,20})\b"
)

# "John Andrew Smith"
_THREE_PART_NAME_PATTERN = re.compile(
    r"\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})\b"
)

# Standard email address pattern
_EMAIL_PATTERN = re.compile(
    r"\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b"
)


# ---------------------------------------------------------------------------
# Name and email detection helpers
# ---------------------------------------------------------------------------

def _is_valid_name_parts(*parts):
    """
    Returns True if none of the given name parts appear in the non-name
    blocklist. Used to filter out academic / institutional terms that match
    the name patterns but are not person names.
    """
    return not any(part in _NON_NAME_WORDS for part in parts)


def _collect_names_from_text(text, detected_names):
    """
    Runs all three name patterns against the given text and appends any
    new matches to detected_names.

    Three-part names are checked first so that "John Andrew Smith" is not
    also captured as two separate two-part names ("John Andrew", "Andrew Smith").
    """
    # Three-part names -- most specific, checked first
    for match in _THREE_PART_NAME_PATTERN.finditer(text):
        first  = match.group(1)
        middle = match.group(2)
        last   = match.group(3)
        if not _is_valid_name_parts(first, middle, last):
            continue
        full_name = match.group(0).strip()
        if full_name not in detected_names:
            detected_names.append(full_name)

    # Two-part names -- checked after three-part to avoid duplicates
    for match in _NAME_PATTERN.finditer(text):
        first = match.group(1)
        last  = match.group(2)
        if not _is_valid_name_parts(first, last):
            continue
        full_name = match.group(0).strip()
        # Skip if this two-part name is already a substring of a detected three-part name
        if not any(full_name in existing for existing in detected_names):
            detected_names.append(full_name)

    # Initial-based names e.g. "J. Smith" or "J. A. Smith"
    for match in _INITIAL_NAME_PATTERN.finditer(text):
        last = match.group(2)
        if last in _NON_NAME_WORDS:
            continue
        full_name = match.group(0).strip()
        if full_name not in detected_names:
            detected_names.append(full_name)


def _detect_author_identifiers(doc):
    """
    Scans the first two pages of the document for potential author names
    and email addresses.

    Strategy
    --------
    1. Wide-region text extraction covers the full author band on page 1
       (y: 50 to 560) and the top of page 2 (y: 0 to 500) so no author
       information is missed regardless of the template used.
    2. Span-level block analysis targets individual text spans for more
       precise matching, avoiding artifacts from cross-block concatenation.
    3. All three name patterns are tried against both the region text and
       individual line text extracted from spans.

    Parameters
    ----------
    doc : fitz.Document

    Returns
    -------
    detected_names  : list[str]  -- unique potential person name strings
    detected_emails : list[str]  -- unique email addresses found
    """
    detected_names  = []
    detected_emails = []

    pages_to_scan = min(2, len(doc))

    for page_idx in range(pages_to_scan):
        page = doc[page_idx]
        page_width  = page.rect.width
        page_height = page.rect.height

        # Define the vertical scan region for each page.
        # Page 1: skip the very top (running headers) and scan through
        #         the typical abstract boundary at y=560.
        # Page 2: scan from the top through y=500.
        if page_idx == 0:
            clip = fitz.Rect(0, 50, page_width, min(560, page_height))
        else:
            clip = fitz.Rect(0, 0, page_width, min(500, page_height))

        # ---- Pass 1: wide region text extraction ----------------------------
        region_text = page.get_text("text", clip=clip)

        for email in _EMAIL_PATTERN.findall(region_text):
            if email not in detected_emails:
                detected_emails.append(email)

        _collect_names_from_text(region_text, detected_names)

        # ---- Pass 2: span-level analysis ------------------------------------
        text_dict = page.get_text("dict")
        blocks     = text_dict.get("blocks", [])

        for block in blocks:
            if block.get("type") != 0:
                continue

            block_top = block["bbox"][1]

            # Apply the same vertical bounds as the clip region above
            if page_idx == 0 and (block_top < 50 or block_top > 560):
                continue
            if page_idx == 1 and block_top > 500:
                continue

            for line in block.get("lines", []):
                # Reconstruct the full line text from all its spans
                line_text = " ".join(
                    span["text"]
                    for span in line.get("spans", [])
                    if span.get("text", "").strip()
                ).strip()

                if not line_text:
                    continue

                for email in _EMAIL_PATTERN.findall(line_text):
                    if email not in detected_emails:
                        detected_emails.append(email)

                _collect_names_from_text(line_text, detected_names)

    # De-duplicate while preserving insertion order
    seen_names = set()
    unique_names = []
    for name in detected_names:
        key = name.lower()
        if key not in seen_names:
            seen_names.add(key)
            unique_names.append(name)

    seen_emails = set()
    unique_emails = []
    for email in detected_emails:
        key = email.lower()
        if key not in seen_emails:
            seen_emails.add(key)
            unique_emails.append(email)

    return unique_names, unique_emails


# ---------------------------------------------------------------------------
# IEEE compliance checker
# ---------------------------------------------------------------------------

def check_ieee_formatting(pdf_buffer, conference_mode=""):
    """
    Runs all IEEE compliance checks on the given PDF buffer and returns a
    structured report.

    Parameters
    ----------
    pdf_buffer      : bytes
        Raw PDF file content.
    conference_mode : str
        Conference review mode (e.g. "double-blind", "single-blind", "open").
        When "double-blind", the Author Anonymity check is a hard failure if
        any names or emails are detected.  For all other modes the check is
        advisory: it passes but surfaces a warning with detected identifiers.

    Returns
    -------
    dict
        {
          "percentage": float,       -- overall compliance score 0-100
          "details":   list[dict],   -- per-rule result objects
        }

    Each detail object has the shape:
        {
          "rule":       str,
          "passed":     bool,
          "message":    str,
          "severity":   str,          -- "pass" | "warning" | "error"
          "suggestion": str | None,   -- present when there is something to fix
          ...                         -- rule-specific extra keys
        }
    """
    try:
        if not pdf_buffer or len(pdf_buffer) < 100:
            raise ValueError("PDF buffer is empty or too small to process.")

        doc = fitz.open(stream=pdf_buffer, filetype="pdf")

        if len(doc) == 0:
            raise ValueError("The uploaded PDF contains no pages.")

        results               = []
        full_text             = "\n".join(page.get_text() for page in doc).lower()
        conference_mode_lower = (conference_mode or "").lower().strip()

        # ------------------------------------------------------------------ #
        # Rule 1 -- Layout                                                    #
        # ------------------------------------------------------------------ #
        # Checks: two-column layout, Times New Roman font, body font size
        # between 8 and 12 pt, and absence of page numbers.

        def _is_times_new_roman(font_name):
            return any(
                token in font_name.lower()
                for token in ["times", "roman", "tim", "tmr"]
            )

        num_pages_to_check   = min(10, len(doc))
        two_column_pages     = 0
        fonts                = set()
        body_font_size       = None
        body_font_size_round = None
        pages_with_numbers   = 0

        for page_idx in range(num_pages_to_check):
            page       = doc[page_idx]
            text_dict  = page.get_text("dict")
            blocks     = text_dict.get("blocks", [])
            page_width = page.mediabox[2]

            # A gap larger than one quarter of the page width between two
            # text lines on the same horizontal band indicates two columns.
            gap_threshold = page_width / 4

            lines = [
                line["bbox"]
                for block in blocks
                if block["type"] == 0 and block["bbox"][1] > 100
                for line in block["lines"]
            ]

            # Bin lines by their vertical position (10 pt buckets)
            y_bin_dict = defaultdict(list)
            for x0, y0, x1, y1 in lines:
                y_bin = round(y0 / 10) * 10
                y_bin_dict[y_bin].append(x0)

            multi_col_bins = 0
            total_bins     = 0

            for y_bin, x0_list in y_bin_dict.items():
                if len(x0_list) >= 2:
                    total_bins += 1
                    sorted_x0 = sorted(x0_list)
                    gaps = [
                        sorted_x0[j] - sorted_x0[j - 1]
                        for j in range(1, len(sorted_x0))
                    ]
                    if gaps and max(gaps) > gap_threshold:
                        multi_col_bins += 1

            if total_bins > 0 and (multi_col_bins / total_bins) > 0.5:
                two_column_pages += 1

            for font in page.get_fonts():
                fonts.add(font[3])

            # Detect body font size from the first block that has a span
            # with a size in the expected body text range.
            if body_font_size is None:
                for block in blocks:
                    if block["type"] != 0:
                        continue
                    for line in block["lines"]:
                        for span in line["spans"]:
                            if 8 <= span["size"] <= 12:
                                body_font_size       = span["size"]
                                body_font_size_round = round(body_font_size)
                                break
                        if body_font_size:
                            break
                    if body_font_size:
                        break

            # Check for page numbers (a block whose full text is just digits)
            has_page_number = any(
                re.search(
                    r"^\s*\d+\s*$",
                    " ".join(
                        span["text"]
                        for line in block["lines"]
                        for span in line["spans"]
                    ).strip(),
                )
                for block in blocks
                if block["type"] == 0 and block["bbox"][1] > 50
            )
            if has_page_number:
                pages_with_numbers += 1

        two_columns        = two_column_pages >= (num_pages_to_check / 2)
        times_new_roman    = any(_is_times_new_roman(f) for f in fonts)
        font_size_valid    = (
            body_font_size is not None and 8 <= body_font_size_round <= 12
        )
        no_page_numbers    = pages_with_numbers == 0

        passing_count = sum([
            1 if two_columns     else 0,
            1 if times_new_roman else 0,
            1 if font_size_valid else 0,
            1 if no_page_numbers else 0,
        ])

        layout_passed = two_columns and (passing_count >= 2)

        layout_suggestions = []
        if not two_columns:
            layout_suggestions.append(
                "Two-column format not found. Use a two-column layout."
            )
        if not times_new_roman:
            layout_suggestions.append(
                "Use Times New Roman or a similar serif font for the body text."
            )
        if not font_size_valid:
            if body_font_size is None:
                layout_suggestions.append(
                    "Set body font size between 8 and 12 points (ideally 10 pt)."
                )
            else:
                layout_suggestions.append(
                    f"Body font size is {body_font_size} pt "
                    f"(rounded to {body_font_size_round} pt); adjust to 8-12 pt."
                )
        if not no_page_numbers:
            layout_suggestions.append(
                "Remove page numbers from the document."
            )

        layout_result = {
            "rule":    "Layout",
            "passed":  layout_passed,
            "message": (
                f"Two-column: {two_columns}, "
                f"Times New Roman: {times_new_roman}, "
                f"Body font ~{body_font_size_round or 'N/A'} pt, "
                f"No page numbers: {no_page_numbers}"
            ),
            "severity": "pass" if layout_passed else "error",
        }
        if layout_suggestions:
            layout_result["suggestion"] = " ".join(layout_suggestions)

        results.append(layout_result)

        # ------------------------------------------------------------------ #
        # Rule 2 -- Title                                                     #
        # ------------------------------------------------------------------ #
        # A title must appear in the top 200 points of the first page and
        # contain at least 5 words.  Known IEEE header patterns are excluded.

        _TITLE_EXCLUSION = re.compile(
            r"IEEE|VOL\.|NO\.|\d{4}|SPECIAL SECTION|TRANSACTIONS|JOURNAL|ACCESS"
            r"|^\s*\d+\s*$"
            r"|RECEIVED\s+THE\b|MEMBER|DATE\s+OF\s+PUBLICATION"
            r"|^[A-Z]+\s+\d{4}$"
            r"|^\[\d+\]"
            r"|^(?:[A-Z]\.\s*)+[A-Z]+"
        )

        title_present = False
        first_page    = doc[0]
        fp_text_dict  = first_page.get_text("dict")
        fp_blocks     = fp_text_dict.get("blocks", [])

        for block in fp_blocks:
            if block["type"] != 0:
                continue
            if block["bbox"][1] > 200:
                break
            block_text = " ".join(
                span["text"]
                for line in block["lines"]
                for span in line["spans"]
            ).strip().upper()
            if _TITLE_EXCLUSION.search(block_text):
                continue
            if len(block_text.split()) >= 5:
                title_present = True
                break

        if not title_present:
            clip_rect = fitz.Rect(0, 0, first_page.rect.width, 200)
            raw_lines = first_page.get_text("text", clip=clip_rect).upper().splitlines()
            for line in raw_lines:
                line = line.strip()
                if not line or _TITLE_EXCLUSION.search(line):
                    continue
                if len(line.split()) >= 5:
                    title_present = True
                    break

        title_result = {
            "rule":     "Title",
            "passed":   title_present,
            "message":  (
                "Title found in the top section of the page."
                if title_present
                else "No title found in the top 200 points of the first page."
            ),
            "severity": "pass" if title_present else "error",
        }
        if not title_present:
            title_result["suggestion"] = (
                "Ensure a clear title with at least 5 words is present "
                "in the top 200 points of the first page."
            )
        results.append(title_result)

        # ------------------------------------------------------------------ #
        # Rule 3 -- Abstract                                                  #
        # ------------------------------------------------------------------ #
        # Abstract must be present and contain 100 to 300 words.

        abstract_match = re.search(
            r"abstract\s*[-\u2014]?\s*([\s\S]*?)"
            r"(?=\n\s*(index\s+terms|keywords|i\.|\d+\.|references|$))",
            full_text,
            re.I,
        )

        if abstract_match:
            abstract_text  = abstract_match.group(1).strip()
            abstract_words = len(abstract_text.split())
            abstract_ok    = 100 <= abstract_words <= 300

            abstract_result = {
                "rule":     "Abstract",
                "passed":   abstract_ok,
                "message":  f"Abstract found with {abstract_words} words.",
                "severity": "pass" if abstract_ok else "error",
            }
            if not abstract_ok:
                if abstract_words < 100:
                    abstract_result["suggestion"] = (
                        f"Abstract has {abstract_words} words. "
                        "It should have at least 100 words (maximum 300)."
                    )
                else:
                    abstract_result["suggestion"] = (
                        f"Abstract has {abstract_words} words. "
                        "It should have no more than 300 words (minimum 100)."
                    )
        else:
            abstract_result = {
                "rule":       "Abstract",
                "passed":     False,
                "message":    "Abstract section not found.",
                "severity":   "error",
                "suggestion": (
                    "Include an abstract section with 100 to 300 words, "
                    "starting with the word 'Abstract'."
                ),
            }

        results.append(abstract_result)

        # ------------------------------------------------------------------ #
        # Rule 4 -- Index Terms                                               #
        # ------------------------------------------------------------------ #

        index_terms_match = re.search(
            r"(index\s+terms|keywords)\s*[-\u2014]?\s*([\s\S]*?)"
            r"(?=\n{2,}|\n\s*[a-zA-Z0-9]+\s*[-\u2014]"
            r"|\n\s*(i\.|\d+\.|references|manuscript|$))",
            full_text,
            re.I,
        )

        if index_terms_match:
            terms_text = index_terms_match.group(2).strip()
            terms = [
                t.strip().rstrip(".")
                for t in re.split(r"[,;]", terms_text)
                if t.strip()
            ]
            terms = [
                t for t in terms
                if not re.search(
                    r"(received|revised|accepted|publication|supported|e-mail)",
                    t.lower(),
                )
            ]
            index_ok = bool(terms)

            index_result = {
                "rule":     "Index Terms",
                "passed":   index_ok,
                "message":  (
                    f"Index Terms / Keywords found: {len(terms)} term(s)."
                    if index_ok
                    else "Index Terms section found but contained no valid terms."
                ),
                "severity": "pass" if index_ok else "error",
            }
            if not index_ok:
                index_result["suggestion"] = (
                    "Add a comma-separated list of relevant terms under "
                    "the 'Index Terms' or 'Keywords' heading."
                )
        else:
            index_result = {
                "rule":       "Index Terms",
                "passed":     False,
                "message":    "Index Terms / Keywords section not found.",
                "severity":   "error",
                "suggestion": (
                    "Include an 'Index Terms' or 'Keywords' section with a "
                    "comma-separated list of relevant terms "
                    "(e.g. 'machine learning, AI, robotics')."
                ),
            }

        results.append(index_result)

        # ------------------------------------------------------------------ #
        # Rule 5 -- Headings                                                  #
        # ------------------------------------------------------------------ #

        heading_patterns = [
            r"\n\s*[ivx]+\.\s+[a-z]+",   # Roman numeral  e.g. "II. Related Work"
            r"\n\s*[a-z]\.\s+[a-z]+",    # Letter         e.g. "A. Background"
            r"\n\s*\d+\.?\s*[a-z]+",     # Numeric        e.g. "1. Introduction"
        ]
        headings_found = any(re.search(p, full_text) for p in heading_patterns)

        headings_result = {
            "rule":     "Headings",
            "passed":   headings_found,
            "message":  (
                "Structured headings detected."
                if headings_found
                else "No structured headings detected."
            ),
            "severity": "pass" if headings_found else "error",
        }
        if not headings_found:
            headings_result["suggestion"] = (
                "Use numbered or Roman numeral headings to structure the document "
                "(e.g. 'I. Introduction', '1. Methods', 'A. Background')."
            )
        results.append(headings_result)

        # ------------------------------------------------------------------ #
        # Rule 6 -- Figures / Tables / Equations                             #
        # ------------------------------------------------------------------ #

        figs_found = False
        for page in doc:
            page_dict = page.get_text("dict")
            for block in page_dict.get("blocks", []):
                if block["type"] != 0:
                    continue
                block_text = " ".join(
                    span["text"]
                    for line in block["lines"]
                    for span in line["spans"]
                ).lower()
                if re.search(
                    r"(figure|fig\.?|table)\s+[\divxlcdm\d]+|\(\d+\)",
                    block_text,
                ):
                    figs_found = True
                    break
            if figs_found:
                break

        figs_result = {
            "rule":     "Figures/Tables/Equations",
            "passed":   figs_found,
            "message":  (
                "Figures, tables, or equations detected."
                if figs_found
                else "No figures, tables, or equations detected."
            ),
            "severity": "pass" if figs_found else "warning",
        }
        if not figs_found:
            figs_result["suggestion"] = (
                "Include at least one figure, table, or numbered equation "
                "labeled as 'Figure 1', 'Table I', or '(1)'."
            )
        results.append(figs_result)

        # ------------------------------------------------------------------ #
        # Rule 7 -- Optional Elements                                         #
        # ------------------------------------------------------------------ #

        optional_patterns = [
            r"note\s+to\s+practitioners",
            r"nomenclature",
            r"appendix",
            r"acknowledg\s*(?:e|ements|ments)",
        ]
        optional_found = any(
            re.search(p, full_text, re.I | re.M)
            for p in optional_patterns
        )

        optional_result = {
            "rule":     "Optional Elements",
            "passed":   True,
            "message":  (
                "Optional elements detected (acknowledgements, appendix, etc.)."
                if optional_found
                else "No optional elements detected."
            ),
            "severity": "pass",
        }
        if not optional_found:
            optional_result["suggestion"] = (
                "Consider adding optional sections such as 'Acknowledgements', "
                "'Nomenclature', or 'Appendix' if relevant to your work."
            )
        results.append(optional_result)

        # ------------------------------------------------------------------ #
        # Rule 8 -- References                                                #
        # ------------------------------------------------------------------ #

        full_text_raw = "\n".join(page.get_text("text") for page in doc)
        full_text_raw = unicodedata.normalize("NFKD", full_text_raw).replace("\xa0", " ")
        full_text_raw = re.sub(r"\s+", " ", full_text_raw.lower())

        has_ref_section = bool(
            re.search(
                r"(references|bibliography|works\s*cited|reference\s*list)",
                full_text_raw,
            )
        )
        has_numbered_citations = bool(
            re.search(r"(?<!\d)\[\d+\](?!\d)", full_text)
        )
        references_ok = has_ref_section or has_numbered_citations

        ref_suggestions = []
        if not has_ref_section:
            ref_suggestions.append(
                "Include a 'References' or 'Bibliography' section at the end of the document."
            )
        if not has_numbered_citations:
            ref_suggestions.append(
                "Use numbered in-text citations (e.g. [1], [2]) "
                "corresponding to the references list."
            )

        references_result = {
            "rule":     "References",
            "passed":   references_ok,
            "message":  (
                f"References section found: {has_ref_section}. "
                f"Numbered citations found: {has_numbered_citations}."
            ),
            "severity": "pass" if references_ok else "error",
        }
        if ref_suggestions:
            references_result["suggestion"] = " ".join(ref_suggestions)
        results.append(references_result)

        # ------------------------------------------------------------------ #
        # Rule 9 -- Author Anonymity                                          #
        # ------------------------------------------------------------------ #
        # This check always runs regardless of conference mode.
        #
        # Behaviour by mode:
        #   double-blind  -> hard failure if names or emails are detected
        #   all others    -> advisory warning; check always passes but
        #                    detected identifiers are surfaced to the author
        #
        # The try/except ensures that even if the detection logic raises an
        # unexpected exception in production, a well-formed result object is
        # still appended to results and returned to the caller.

        try:
            detected_names, detected_emails = _detect_author_identifiers(doc)

            has_leakage      = bool(detected_names or detected_emails)
            is_double_blind  = conference_mode_lower == "double-blind"

            # In double-blind mode the check fails when leakage is found.
            # In all other modes the check passes (advisory only).
            anonymity_passed = (not has_leakage) if is_double_blind else True

            mode_label = conference_mode.strip() if conference_mode.strip() else "this conference"

            if has_leakage:
                # Build a human-readable summary of what was found
                parts = []
                if detected_names:
                    name_preview = ", ".join(f'"{n}"' for n in detected_names[:5])
                    parts.append(f"Potential author name(s) detected: {name_preview}.")
                if detected_emails:
                    email_preview = ", ".join(f'"{e}"' for e in detected_emails[:3])
                    parts.append(f"Email address(es) detected: {email_preview}.")

                anonymity_message = (
                    f"Author identity information found in the manuscript "
                    f"({mode_label} mode). " + " ".join(parts)
                )
                anonymity_suggestion = (
                    "Remove all author names, affiliations, email addresses, "
                    "and any other identifying information from the manuscript "
                    "to comply with the blind review requirement. Replace "
                    "self-referential language (e.g. 'In our previous work') "
                    "with third-person phrasing."
                )
                # error = hard fail (double-blind), warning = advisory (other modes)
                severity = "error" if is_double_blind else "warning"

            else:
                anonymity_message = (
                    f"No author names or email addresses detected "
                    f"({mode_label} mode)."
                )
                anonymity_suggestion = None
                severity             = "pass"

            anonymity_result = {
                "rule":     "Author Anonymity",
                "passed":   anonymity_passed,
                "message":  anonymity_message,
                "severity": severity,
            }
            if anonymity_suggestion:
                anonymity_result["suggestion"] = anonymity_suggestion
            if detected_names:
                anonymity_result["detectedNames"]  = detected_names[:10]
            if detected_emails:
                anonymity_result["detectedEmails"] = detected_emails[:5]

        except Exception as anonymity_error:
            # Log the exact error for production diagnostics
            print(
                f"[Author Anonymity] Detection failed with error: {anonymity_error}",
                flush=True,
            )
            anonymity_result = {
                "rule":       "Author Anonymity",
                "passed":     False,
                "message":    (
                    "Author anonymity check could not be completed due to an "
                    f"internal error: {str(anonymity_error)}"
                ),
                "severity":   "error",
                "suggestion": (
                    "The anonymity check encountered an error. Please manually "
                    "verify that all author names, affiliations, and email "
                    "addresses have been removed from the manuscript."
                ),
            }

        results.append(anonymity_result)

        # ------------------------------------------------------------------ #
        # Score calculation                                                   #
        # ------------------------------------------------------------------ #
        # Weights sum to 100. Layout weight is 25 to accommodate the
        # Author Anonymity check at weight 5.

        weights = {
            "Layout":                   25,
            "Title":                     5,
            "Abstract":                 15,
            "Index Terms":              10,
            "Headings":                 10,
            "Figures/Tables/Equations": 10,
            "Optional Elements":         5,
            "References":               15,
            "Author Anonymity":          5,
        }

        total_weight = sum(weights.values())   # 100

        score = round(
            sum(
                weights.get(r["rule"], 0)
                for r in results
                if r["passed"]
            )
            / total_weight * 100,
            2,
        )

        doc.close()

        return {"percentage": score, "details": results}

    except Exception as top_level_error:
        print(
            f"[check_ieee_formatting] Top-level error: {top_level_error}",
            flush=True,
        )
        return {
            "percentage": 0,
            "details": [
                {
                    "rule":       "Parsing",
                    "passed":     False,
                    "message":    str(top_level_error),
                    "severity":   "error",
                    "suggestion": (
                        "Ensure the uploaded file is a valid, non-corrupted PDF."
                    ),
                }
            ],
        }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "IEEE Compliance Checker"})


@app.route("/check-compliance", methods=["POST"])
def check_compliance():
    """
    Accepts a multipart PDF upload and returns an IEEE compliance report.

    Form fields
    -----------
    file            : PDF file (required)
    conference_mode : str     (optional) -- e.g. "double-blind", "single-blind", "open"

    Returns
    -------
    200 JSON  { "percentage": float, "details": list }
    400 JSON  { "error": str }   -- bad request (no file, wrong type, etc.)
    500 JSON  { "error": str }   -- unexpected server error
    """
    # ---- Validate request --------------------------------------------------
    if "file" not in request.files:
        return jsonify({
            "error": "No file provided. Send a PDF as a multipart field named 'file'."
        }), 400

    uploaded_file = request.files["file"]

    if not uploaded_file or uploaded_file.filename == "":
        return jsonify({"error": "Empty filename. Please select a PDF file."}), 400

    if not uploaded_file.filename.lower().endswith(".pdf"):
        return jsonify({
            "error": "Invalid file type. Only PDF files are accepted."
        }), 400

    # ---- Read inputs -------------------------------------------------------
    conference_mode = request.form.get("conference_mode", "").strip()

    # Log inputs for production diagnostics (safe to remove once stable)
    print(
        f"[check-compliance] file='{uploaded_file.filename}' "
        f"conference_mode='{conference_mode}'",
        flush=True,
    )

    # ---- Run compliance check ----------------------------------------------
    try:
        pdf_buffer = uploaded_file.read()
        result     = check_ieee_formatting(pdf_buffer, conference_mode=conference_mode)
    except Exception as err:
        print(f"[check-compliance] Unexpected error: {err}", flush=True)
        return jsonify({"error": f"Compliance check failed: {str(err)}"}), 500

    # Log the anonymity result specifically for production diagnostics
    anonymity = next(
        (r for r in result.get("details", []) if r["rule"] == "Author Anonymity"),
        None,
    )
    print(f"[check-compliance] Anonymity result: {anonymity}", flush=True)

    return jsonify(result), 200


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("FLASK_PORT", 6000))
    app.run(host="0.0.0.0", port=port, debug=False)