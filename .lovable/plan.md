
## Plan: Generate ERD diagram for the Marketa system

I'll create an Entity Relationship Diagram (Mermaid `.mmd` file) reflecting the current Supabase schema and deliver it as a downloadable artifact.

### Entities to include
Based on the live database schema:

1. **profiles** — user profile (id → auth.users), name fields, verification flag, visibility, notifications
2. **user_roles** — role assignments (admin/user) per user
3. **listings** — marketplace items posted by sellers
4. **saved_listings** — join table (user ↔ listing) for bookmarks
5. **verifications** — ID verification submissions with OCR fields, liveness, face match
6. **verified_users** — finalized verified identity record (post-admin-approval)
7. **auth.users** — shown as external Supabase-managed entity (reference only)

### Relationships
```text
auth.users 1───1 profiles            (profiles.id = auth.users.id)
auth.users 1───* user_roles          (user_id)
auth.users 1───* listings            (seller_id)
auth.users 1───* saved_listings      (user_id)
listings   1───* saved_listings      (listing_id)
auth.users 1───1 verifications       (user_id, one active submission)
auth.users 1───1 verified_users      (user_id PK, post-approval)
auth.users 0───* verifications       (id_approved_by, admin who approved)
```

### Deliverable
- A Mermaid ER diagram (`erDiagram` syntax) covering all tables, columns (key fields + types), PK/FK markers, and cardinality.
- Saved to `/mnt/documents/Marketa_ERD.mmd`
- Delivered via `<lov-artifact>` tag with `text/vnd.mermaid` mime type so the user can preview/download.

### Notes
- Supabase-managed `auth.users` is shown as an external node (no FK enforcement in `public` schema, but it's the logical anchor).
- I'll keep column lists concise (key + important fields) so the diagram remains readable rather than dumping every OCR column.
