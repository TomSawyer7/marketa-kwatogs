import { LegalLayout } from "@/components/legal/LegalLayout";
import { privacyDoc } from "@/content/legal/privacy";
import { LEGAL_VERSIONS } from "@/lib/legal-version";

const Privacy = () => (
  <LegalLayout
    doc={privacyDoc}
    version={LEGAL_VERSIONS.privacy}
    seoTitle="Privacy Policy · Marketa"
    seoDescription="How Marketa collects, uses, and protects your personal information under RA 10173."
  />
);

export default Privacy;
