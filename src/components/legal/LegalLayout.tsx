import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import type { LegalDoc } from "@/content/legal/types";
import { LEGAL_LAST_UPDATED } from "@/lib/legal-version";

type Props = {
  doc: LegalDoc;
  version: string;
  seoTitle: string;
  seoDescription: string;
};

export function LegalLayout({ doc, version, seoTitle, seoDescription }: Props) {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = seoTitle;
    const el = document.querySelector('meta[name="description"]');
    if (el) el.setAttribute("content", seoDescription);
  }, [seoTitle, seoDescription]);

  return (
    <AppShell>
      <div className="px-4 md:px-6 lg:px-8 py-6 max-w-6xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <header className="border-b border-border pb-5 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{doc.title}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated {LEGAL_LAST_UPDATED} · Version {version}
          </p>
          <div className="prose prose-neutral dark:prose-invert max-w-none mt-4 text-[15px] leading-relaxed">
            {doc.intro}
          </div>
        </header>

        <div className="grid lg:grid-cols-[240px_1fr] gap-8">
          <aside className="lg:sticky lg:top-20 self-start">
            <nav aria-label="Table of contents" className="text-sm">
              <p className="font-semibold text-foreground mb-2">On this page</p>
              <ol className="space-y-1.5">
                {doc.sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="text-muted-foreground hover:text-foreground block leading-snug"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
              <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground space-y-1.5">
                <Link to="/legal/terms" className="block hover:text-foreground">
                  Terms &amp; Conditions
                </Link>
                <Link to="/legal/privacy" className="block hover:text-foreground">
                  Privacy Policy
                </Link>
                <Link to="/legal/community" className="block hover:text-foreground">
                  Community Guidelines
                </Link>
                <Link to="/contact" className="block hover:text-foreground">
                  Contact Us
                </Link>
              </div>
            </nav>
          </aside>

          <article className="prose prose-neutral dark:prose-invert max-w-none text-[15px] leading-relaxed">
            {doc.sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24 mb-8">
                <h2 className="text-xl font-semibold tracking-tight mt-0 mb-2 text-foreground">
                  {s.title}
                </h2>
                <div className="text-muted-foreground">{s.body}</div>
              </section>
            ))}
          </article>
        </div>
      </div>
    </AppShell>
  );
}
