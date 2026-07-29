// Bump these strings when you materially change the corresponding document.
// A newer version prompts users to re-accept from Settings → Legal.
export const LEGAL_VERSIONS = {
  terms: "2026-07-29",
  privacy: "2026-07-29",
  community: "2026-07-29",
  kyc_certification: "2026-07-29",
} as const;

export type LegalDocument = keyof typeof LEGAL_VERSIONS;

export const LEGAL_LAST_UPDATED = "July 29, 2026";
export const LEGAL_CONTACT_EMAIL = "support@marketa.ph";
