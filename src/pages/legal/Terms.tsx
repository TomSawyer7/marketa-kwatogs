import { LegalLayout } from "@/components/legal/LegalLayout";
import { termsDoc } from "@/content/legal/terms";
import { LEGAL_VERSIONS } from "@/lib/legal-version";

const Terms = () => (
  <LegalLayout
    doc={termsDoc}
    version={LEGAL_VERSIONS.terms}
    seoTitle="Terms & Conditions · Marketa"
    seoDescription="The rules and responsibilities that govern your use of Marketa."
  />
);

export default Terms;
