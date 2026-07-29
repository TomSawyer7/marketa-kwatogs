import type { LegalDoc } from "./types";

export const communityDoc: LegalDoc = {
  title: "Community Guidelines",
  intro: (
    <p>
      Marketa is a community of buyers and sellers built on trust and respect. These Community
      Guidelines describe the behavior we expect from every member and the actions we take when
      they are broken.
    </p>
  ),
  sections: [
    {
      id: "respect",
      title: "1. Respectful Communication",
      body: (
        <p>
          Treat every member with courtesy. Personal attacks, insults, threats, and demeaning
          language are not tolerated in messages, listings, reviews, or appeals.
        </p>
      ),
    },
    {
      id: "conduct",
      title: "2. Marketplace Conduct",
      body: (
        <p>
          Honor your commitments. Show up for agreed meetups, respond to messages in good faith,
          and complete transactions as promised. Cancelling repeatedly without cause harms other
          members and may trigger restrictions.
        </p>
      ),
    },
    {
      id: "prohibited",
      title: "3. Prohibited Listings",
      body: (
        <ul className="list-disc pl-6 space-y-1">
          <li>Weapons, ammunition, and explosives.</li>
          <li>Illegal drugs and drug paraphernalia.</li>
          <li>Counterfeit or replica items.</li>
          <li>Live animals and wildlife products.</li>
          <li>Hazardous chemicals and regulated substances.</li>
          <li>Stolen goods and items you do not have the right to sell.</li>
          <li>Adult content and services.</li>
          <li>Any item restricted by Philippine law.</li>
        </ul>
      ),
    },
    {
      id: "fake",
      title: "4. Fake Accounts",
      body: (
        <p>
          Every Marketa account must correspond to a real, verified person. Duplicate accounts,
          bots, and accounts created to impersonate others are not allowed.
        </p>
      ),
    },
    {
      id: "fraud",
      title: "5. Fraudulent Activities",
      body: (
        <p>
          Do not misrepresent items, prices, or your identity. Do not attempt payment scams,
          chargebacks in bad faith, or off-platform tactics designed to evade platform safeguards.
        </p>
      ),
    },
    {
      id: "spam",
      title: "6. Spam",
      body: (
        <p>
          Do not send unsolicited promotional messages, mass-forward identical content, post
          duplicate listings, or use the Service to advertise unrelated services.
        </p>
      ),
    },
    {
      id: "harassment",
      title: "7. Harassment",
      body: (
        <p>
          Repeated unwanted contact, intimidation, doxxing, and coordinated targeting of another
          member are prohibited.
        </p>
      ),
    },
    {
      id: "hate",
      title: "8. Hate Speech",
      body: (
        <p>
          Content that attacks people based on race, ethnicity, religion, gender, sexual
          orientation, disability, or nationality is not allowed and will be removed on sight.
        </p>
      ),
    },
    {
      id: "scams",
      title: "9. Scams",
      body: (
        <p>
          Phishing, fake payment screenshots, advance-fee schemes, and bait-and-switch listings are
          strictly prohibited and will result in immediate account action.
        </p>
      ),
    },
    {
      id: "identity",
      title: "10. Identity Misrepresentation",
      body: (
        <p>
          Do not use false documents, borrow another person's identity, or manipulate liveness
          checks. Identity fraud may be reported to law enforcement.
        </p>
      ),
    },
    {
      id: "reporting",
      title: "11. Reporting Abuse",
      body: (
        <p>
          Use the in-app reporting tools on listings, users, and reviews to flag violations. False
          or malicious reporting is itself a violation and is monitored.
        </p>
      ),
    },
    {
      id: "consequences",
      title: "12. Consequences of Violations",
      body: (
        <p>
          Violations may result in content removal, warnings, temporary restrictions, suspension,
          or permanent termination of the account. Serious violations may be referred to the
          appropriate authorities.
        </p>
      ),
    },
  ],
};
