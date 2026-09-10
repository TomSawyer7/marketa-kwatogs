# Appendix D — Simplified Diagrams (DFDs + Sequence)

Simplify the three data flow diagrams and the two sequence diagrams. Title page and use case diagram stay as they are. Figure numbers and captions stay the same so the paper's references still match.

## Data flow diagrams

**Context (Level 0)**
- Three external entities: User, Admin, Verification Services (email OTP, ID scan and face check merged into one box).
- One process in the middle: Marketa System.
- Two-word flow labels only: "account data", "listings", "review actions", "ID / face check", "results".

**Level 1 — five processes**
1. Accounts & Verification
2. Listings
3. Messaging & Transactions
4. Ratings & Appeals
5. Admin & Monitoring

Four data stores: Users, Listings, Messages & Transactions, Reviews & Logs. Every flow label is one or two words ("profile", "post", "chat", "rating", "logs").

**Level 2 — verification**
- Straight left-to-right chain: Email code → ID scan → Face check → Admin review → Verified.
- One data store: Verification records. Single-word arrow labels.

## Sequence diagrams

**Verification gate**
- Cut to four lifelines: User, Marketa App, Verification Services, Admin.
- Five steps in order: enter email code → upload ID → face check → admin reviews → access granted.
- Short labels, no technical function or table names, no nested notes.

**MPIN**
- Cut to three lifelines: User, Marketa App, Database.
- Two blocks: Set up MPIN (once after verification), and Unlock (enter MPIN → correct opens the page; wrong counts a failure, locked after 5).
- Forgot MPIN shown as one short branch: password + emailed code → set new MPIN.

## Layout rules for all five diagrams
- Fewer elements, more white space, larger readable text.
- Straight arrows, no crossings, no long sentences.

## Technical notes
- Same ReportLab generator script; the DFD and sequence page sections are rewritten.
- PDF regenerated, every page rendered to an image and visually checked for overlap or clipping before delivery.
