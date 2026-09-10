# Appendix D — Simplified Data Flow Diagrams

Only the DFD pages change (context, Level 1, Level 2). The title page, use case diagram, and the two sequence diagrams stay exactly as they are.

## What gets simpler

**Context diagram (Level 0)**
- Three external entities only: User, Admin, Verification Services (email OTP, ID/OCR, liveness combined into one box).
- One process circle in the middle: "Marketa System".
- Short two-word flow labels: "account data", "listings", "review actions", "ID / face check", "results".

**Level 1**
- Cut from the current long process list to five processes:
  1. Accounts & Verification
  2. Listings
  3. Messaging & Transactions
  4. Ratings & Appeals
  5. Admin & Monitoring
- Four data stores instead of eight: Users, Listings, Messages & Transactions, Reviews & Logs.
- Every flow label is one or two words (e.g. "profile", "post", "chat", "rating", "logs"). No sentences.

**Level 2 (verification)**
- Straight left-to-right chain of four steps: Email code → ID scan → Face check → Admin review, then "Verified".
- One data store: Verification records.
- Labels reduced to single words above each arrow.

## Layout rules applied to all three pages
- Fewer boxes, more white space, larger text.
- No crossing lines; all arrows horizontal or vertical.
- Numbered processes (1.0, 2.0, ...) kept so the diagrams stay academically standard.
- Figure numbers and captions unchanged so the paper's references still match.

## Technical notes
- The same ReportLab generator script is edited; only the three DFD page sections are rewritten.
- The PDF is regenerated and every page rendered to an image and visually checked for overlap or clipping before delivery.
