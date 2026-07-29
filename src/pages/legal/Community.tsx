import { LegalLayout } from "@/components/legal/LegalLayout";
import { communityDoc } from "@/content/legal/community";
import { LEGAL_VERSIONS } from "@/lib/legal-version";

const Community = () => (
  <LegalLayout
    doc={communityDoc}
    version={LEGAL_VERSIONS.community}
    seoTitle="Community Guidelines · Marketa"
    seoDescription="The behavior expected of every Marketa member and what happens when the rules are broken."
  />
);

export default Community;
