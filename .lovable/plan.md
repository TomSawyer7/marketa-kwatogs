# Appendix D — Use Case, DFD, and Sequence Diagrams

A standalone, print-ready PDF appendix for your paper, with clean vector diagrams drawn to match Marketa's actual implemented flows. No changes to the app itself.

## Output
- `marketa_appendix_d_diagrams.pdf` — A4 portrait (landscape for wide diagrams), formal academic styling, numbered figures with captions, page footers.

## Contents

**D.1 Use Case Diagram (whole system)**
Actors: Guest, Registered User (Buyer/Seller), Admin, and external systems (Email OTP service, ID/OCR verification service, Liveness verification service).
Use cases grouped by module: register and accept legal terms, verify email via OTP, submit ID for KYC, complete liveness challenge, set/verify MPIN, browse and search listings, post listing, message and send proposal, complete or cancel transaction, leave review, file review appeal, deactivate/delete account; admin: review KYC submissions, resolve appeals, monitor audit logs and behavioral alerts.
Includes `<<include>>` / `<<extend>>` relations where they apply (e.g. verification gate included in protected actions).

**D.2 Data Flow Diagrams**
- Context diagram (Level 0): Marketa as a single process between User, Admin, and the external verification/email services.
- Level 1 DFD: the main processes — Account & Legal Consent, Three-Phase Verification, MPIN Security, Listing Management, Messaging & Transactions, Ratings & Appeals, Audit & Behavior Monitoring — with data stores (profiles, verifications, listings, threads/messages, transactions, reviews/appeals, audit logs, behavior events) and labelled data flows.
- Level 2 DFD for the verification sub-process (email OTP → ID scan/OCR → liveness → admin review → verified status).

**D.3 Sequence Diagram — Three-Phase Verification Gate**
Lifelines: User, App (Verification Gate), Auth service, Scan/OCR function, Liveness function, Database, Admin.
Phases shown in order: email OTP confirmation → ID upload with data extraction → liveness challenge capture → pending admin review → approval sets verified status → gate releases access to the marketplace, including the redirect behaviour at each unmet phase.

**D.4 Sequence Diagram — MPIN Authentication**
Two scenarios: first-time MPIN setup after verification, and MPIN unlock when opening Inbox / Add Listing / Settings, showing verification attempts, failed-attempt counter, lockout after 5 failures, and the Forgot-MPIN reset path (email OTP + account password → new MPIN).

## Technical notes
- Diagrams drawn programmatically as vector graphics (ReportLab shapes/flowables) so lines, boxes, actor figures, lifelines and arrows stay sharp at print resolution — no bitmap screenshots.
- Diagram content taken from the real code: verification gate order, MPIN gate sections and lockout rules, edge functions, and database tables.
- Wide diagrams (use case, Level 1 DFD, sequences) placed on landscape pages so nothing is cramped.
- QA: every page rendered to an image and inspected for overlap, clipping, crossed labels, or blank pages; the script is iterated until the whole document is clean.
