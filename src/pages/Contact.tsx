import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-version";

const Contact = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Contact Us · Marketa";
  }, []);

  return (
    <AppShell>
      <div className="px-4 md:px-6 lg:px-8 py-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Contact Us</h1>
        <p className="text-muted-foreground mt-2">
          We're here to help with account, safety, and legal questions.
        </p>

        <div className="mt-6 grid gap-4">
          <div className="bg-card border border-border rounded-lg p-5 flex items-start gap-3">
            <Mail className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h2 className="font-semibold">General support</h2>
              <p className="text-sm text-muted-foreground">
                For account, verification, or transaction questions.
              </p>
              <a
                href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                className="text-sm text-primary underline mt-1 inline-block"
              >
                {LEGAL_CONTACT_EMAIL}
              </a>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h2 className="font-semibold">Privacy &amp; Data Protection</h2>
              <p className="text-sm text-muted-foreground">
                Contact our Data Protection Officer for privacy inquiries, access, correction, or
                erasure requests under RA 10173.
              </p>
              <a
                href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                className="text-sm text-primary underline mt-1 inline-block"
              >
                {LEGAL_CONTACT_EMAIL}
              </a>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5 flex items-start gap-3">
            <MessageCircle className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h2 className="font-semibold">Report abuse or fraud</h2>
              <p className="text-sm text-muted-foreground">
                Use the in-app reporting tools on any listing, message, or review, or email us with
                details and screenshots.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-sm text-muted-foreground">
          See also our{" "}
          <Link to="/legal/terms" className="text-primary underline">Terms</Link>,{" "}
          <Link to="/legal/privacy" className="text-primary underline">Privacy Policy</Link>, and{" "}
          <Link to="/legal/community" className="text-primary underline">Community Guidelines</Link>.
        </div>
      </div>
    </AppShell>
  );
};

export default Contact;
