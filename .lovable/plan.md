# Marketa UAT Document — Strict 3-Page PDF

Generate a printable, signature-ready UAT document as a standalone PDF artifact (not an app page), delivered to your documents folder for download.

## Output
- `marketa_uat_document.pdf` — exactly 3 pages, A4, professional formal styling, page footer "Page X of 3".

## Page contents
1. **Client Consent Form** — title block ("USER ACCEPTANCE TESTING (UAT) / CLIENT CONSENT FORM"), formal consent letter covering purpose of UAT, selected test cases on major features, feedback collection, documentation of results, and acceptance determination; the exact consent statement; Client/Tester Information block (Name, Position/Designation, Organization, Signature, Date) and Development Team Representative block (Name, Signature, Date), all with printable ruled lines.
2. **UAT Test Cases** — title, instructions paragraph, then all five cases in a compact bordered table: UAT-REG-001 (Account Registration), UAT-KYC-001 (ID Upload), UAT-KYC-002 (Liveness Verification), UAT-MKT-001 (Marketplace Transaction), UAT-PRIV-001 (Right to Be Forgotten). Each row keeps Test Case ID, Objective, numbered Steps, Expected Result, PASS / FAIL / PASS WITH COMMENTS checkboxes, and a Client Comments / Suggested Improvements writing line. All five fit one page via ~7.5–8pt compact type and tight row padding; no case split across pages.
3. **Client UAT Evaluation and Acceptance** — A. 9-statement evaluation survey table with 5/4/3/2/1 checkbox columns and the rating legend; B. Overall client comments with two large ruled writing areas; C. Final acceptance checkboxes (ACCEPTED / ACCEPTED WITH MINOR IMPROVEMENTS / NOT YET ACCEPTED) plus client and development team signature/date lines.

Wording uses Marketa's actual terminology (KYC ID verification, liveness verification, marketplace transaction/proposal flow, account deletion / right to be forgotten).

## Technical notes
- Built with a Python ReportLab Platypus script (registered DejaVu Sans Unicode font for checkbox glyphs), using explicit `PageBreak`s so page boundaries are fixed.
- QA: render each page to an image and inspect for overflow, clipping, or a stray 4th page; iterate the script until the PDF is verifiably exactly 3 clean pages.
- No changes to the app codebase.
