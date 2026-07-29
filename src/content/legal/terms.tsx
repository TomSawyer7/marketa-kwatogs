import type { LegalDoc } from "./types";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-version";

export const termsDoc: LegalDoc = {
  title: "Terms & Conditions",
  intro: (
    <p>
      Welcome to Marketa. These Terms &amp; Conditions ("Terms") govern your access to and use of
      the Marketa platform, including our website, mobile-optimized web app, and related services
      (collectively, the "Service"). By creating an account or using the Service, you agree to be
      bound by these Terms.
    </p>
  ),
  sections: [
    {
      id: "acceptance",
      title: "1. Acceptance of Terms",
      body: (
        <p>
          By registering for, accessing, or using Marketa, you acknowledge that you have read,
          understood, and agree to be bound by these Terms and our Privacy Policy. If you do not
          agree, you must not use the Service.
        </p>
      ),
    },
    {
      id: "eligibility",
      title: "2. Eligibility",
      body: (
        <p>
          You must be at least eighteen (18) years old and legally capable of entering into a
          binding contract under the laws of the Republic of the Philippines to use Marketa. By
          registering, you represent and warrant that you meet these requirements.
        </p>
      ),
    },
    {
      id: "registration",
      title: "3. User Registration",
      body: (
        <p>
          You agree to provide accurate, current, and complete information during registration and
          to keep such information up to date. You may register only one account and may not
          impersonate another person or entity.
        </p>
      ),
    },
    {
      id: "security",
      title: "4. Account Security",
      body: (
        <p>
          You are responsible for maintaining the confidentiality of your credentials and for all
          activities that occur under your account. Notify us immediately of any unauthorized use.
        </p>
      ),
    },
    {
      id: "mpin",
      title: "5. Password and MPIN Responsibility",
      body: (
        <p>
          Your password and 6-digit MPIN are personal to you. Never share them with anyone. Marketa
          will never ask you for your password or MPIN. You are solely responsible for any actions
          performed using your credentials.
        </p>
      ),
    },
    {
      id: "email",
      title: "6. Email Verification",
      body: (
        <p>
          After registration, we require verification of your email address via an 8-digit
          one-time code. You may not access the marketplace until email verification is complete.
        </p>
      ),
    },
    {
      id: "kyc",
      title: "7. Identity Verification (KYC)",
      body: (
        <p>
          To transact on Marketa, you must complete Know-Your-Customer verification by submitting a
          valid government-issued Philippine National ID and passing a liveness check. Submissions
          are reviewed by our compliance team. Providing false documents is prohibited and may
          result in permanent suspension and legal action.
        </p>
      ),
    },
    {
      id: "marketplace",
      title: "8. Marketplace Usage Rules",
      body: (
        <p>
          Marketa is a peer-to-peer marketplace. We do not take custody of items, funds, or
          shipments. All transactions are directly between buyers and sellers. You agree to use the
          Service only for lawful personal or small-scale commercial purposes.
        </p>
      ),
    },
    {
      id: "listings",
      title: "9. Listing Rules",
      body: (
        <p>
          Sellers must accurately describe items, provide honest photographs, and set fair prices.
          Listings must comply with all applicable Philippine laws. Prohibited items include
          weapons, illegal drugs, counterfeit goods, live animals, hazardous materials, and any
          items restricted or regulated by law.
        </p>
      ),
    },
    {
      id: "buyers",
      title: "10. Buyer Responsibilities",
      body: (
        <p>
          Buyers must inspect items before completing a transaction, communicate respectfully with
          sellers, and honor agreed meetups or transfers. Buyers are responsible for verifying the
          suitability and legality of any purchase.
        </p>
      ),
    },
    {
      id: "sellers",
      title: "11. Seller Responsibilities",
      body: (
        <p>
          Sellers must deliver items as described, respond to buyer inquiries in good faith, and
          honor the terms of any agreed transaction. Sellers are responsible for any applicable
          taxes and legal obligations related to their sales.
        </p>
      ),
    },
    {
      id: "messaging",
      title: "12. Messaging Rules",
      body: (
        <p>
          The in-app messaging system is provided for transaction-related communication. Spamming,
          harassment, phishing, sharing off-platform payment or contact details for the purpose of
          evading platform safeguards, and sending unsolicited promotional content are prohibited.
        </p>
      ),
    },
    {
      id: "trust",
      title: "13. Trust Score System",
      body: (
        <p>
          Marketa uses a trust-score system based on verified transactions, ratings, and reviews.
          Accounts with consistently low ratings or multiple upheld reports may be restricted or
          suspended. The trust score is calculated automatically and is intended to promote a safe
          marketplace.
        </p>
      ),
    },
    {
      id: "antifraud",
      title: "14. Anti-Fraud and Behavioral Monitoring",
      body: (
        <p>
          We operate rule-based behavioral monitoring to detect suspicious activity such as
          abnormal login attempts, spam bursts, listing floods, and coordinated abuse. When
          thresholds are exceeded, your account may be temporarily locked or flagged for manual
          review.
        </p>
      ),
    },
    {
      id: "audit",
      title: "15. Audit Logging and Security Monitoring",
      body: (
        <p>
          Marketa maintains tamper-resistant audit logs of key actions (authentication, KYC,
          transactions, moderation) for security, compliance, and forensic purposes. Logs are
          stored securely and reviewed only by authorized personnel.
        </p>
      ),
    },
    {
      id: "prohibited",
      title: "16. Prohibited Activities",
      body: (
        <ul className="list-disc pl-6 space-y-1">
          <li>Fraud, misrepresentation, or impersonation.</li>
          <li>Posting illegal, obscene, hateful, or infringing content.</li>
          <li>Circumventing security features or attempting to access data of others.</li>
          <li>Automated scraping, crawling, or reverse-engineering the Service.</li>
          <li>Off-platform payments intended to avoid platform safeguards.</li>
        </ul>
      ),
    },
    {
      id: "fraud",
      title: "17. Fraud Prevention",
      body: (
        <p>
          We reserve the right to investigate suspected fraud, share information with law
          enforcement when legally required, and take any action necessary to protect the
          community, including restriction, suspension, or termination of accounts.
        </p>
      ),
    },
    {
      id: "suspension",
      title: "18. Account Suspension",
      body: (
        <p>
          Accounts may be temporarily suspended for violations pending review. You may appeal a
          suspension through the in-app appeal workflow.
        </p>
      ),
    },
    {
      id: "termination",
      title: "19. Account Termination",
      body: (
        <p>
          You may deactivate or delete your account at any time from Settings. We may terminate
          accounts for serious or repeated violations, illegal activity, or as required by law.
        </p>
      ),
    },
    {
      id: "ip",
      title: "20. Intellectual Property",
      body: (
        <p>
          The Marketa name, logo, design, software, and content are our intellectual property or
          used under license. You retain ownership of content you post but grant Marketa a
          non-exclusive, royalty-free license to display it as necessary to operate the Service.
        </p>
      ),
    },
    {
      id: "liability",
      title: "21. Limitation of Liability",
      body: (
        <p>
          To the maximum extent permitted by law, Marketa shall not be liable for indirect,
          incidental, consequential, or punitive damages arising from your use of the Service or
          from transactions between users.
        </p>
      ),
    },
    {
      id: "disclaimer",
      title: "22. Disclaimer",
      body: (
        <p>
          The Service is provided "as is" and "as available" without warranties of any kind, express
          or implied. Marketa does not guarantee the accuracy of listings, the conduct of users, or
          the outcome of any transaction.
        </p>
      ),
    },
    {
      id: "changes",
      title: "23. Changes to the Terms",
      body: (
        <p>
          We may update these Terms from time to time. Material changes will be communicated in-app
          or by email. Continued use of the Service after changes take effect constitutes
          acceptance of the revised Terms.
        </p>
      ),
    },
    {
      id: "law",
      title: "24. Governing Law",
      body: (
        <p>
          These Terms are governed by and construed in accordance with the laws of the Republic of
          the Philippines. Any dispute shall be resolved before the appropriate courts of the
          Philippines.
        </p>
      ),
    },
    {
      id: "contact",
      title: "25. Contact Information",
      body: (
        <p>
          For questions about these Terms, contact us at{" "}
          <a className="text-primary underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      ),
    },
  ],
};
