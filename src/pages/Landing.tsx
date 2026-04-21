import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, ArrowRight, ScanFace, Store, Eye, Lock,
  AlertTriangle, Shield, Activity, Globe, Fingerprint, BadgeCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const HOW = [
  {
    icon: ShieldCheck,
    title: "PhilSys ID Check",
    desc: "Every user verifies through the official PhilSys eVerify portal with automated anti-tampering detection.",
  },
  {
    icon: ScanFace,
    title: "Biometric Liveness",
    desc: "Real-time webcam liveness detection with randomized challenges prevents spoofing and impersonation.",
  },
  {
    icon: Store,
    title: "Verified-Only Market",
    desc: "Only fully verified users can sell. Face re-authentication is required for every transaction.",
  },
];

const SECURITY = [
  { icon: ShieldCheck, title: "PhilSys ID Verification", desc: "Government-issued National ID verification through the official PhilSys eVerify portal with 8-check automated anti-tampering engine." },
  { icon: Fingerprint, title: "Biometric Liveness Detection", desc: "Real-time webcam liveness detection with randomized challenges (blink, smile, head turn, nod) using face-api.js to prevent spoofing." },
  { icon: Eye, title: "Face Re-Authentication", desc: "Mandatory real-time Face ID re-authentication required before every high-stakes action like buying or chatting." },
  { icon: Lock, title: "Brute Force Protection", desc: "Client-side rate limiting with progressive lockouts after failed login attempts. Account temporarily locked after 5 failures." },
  { icon: AlertTriangle, title: "HIBP Breach Detection", desc: "Passwords checked against the Have I Been Pwned database to prevent use of compromised credentials." },
  { icon: Shield, title: "Row-Level Security (RLS)", desc: "PostgreSQL Row-Level Security policies enforce data isolation — users can only access their own data." },
  { icon: Activity, title: "Comprehensive Audit Trail", desc: "Every security event is logged with timestamps, user agents, and metadata for forensic analysis." },
  { icon: Globe, title: "Session Monitoring", desc: "All login/logout events tracked with device fingerprinting for suspicious activity detection." },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto h-16 px-5 md:px-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2.2} />
            </div>
            <span className="font-bold text-lg tracking-tight text-primary">Marketa</span>
          </Link>

          <nav className="flex items-center gap-2">
            {user ? (
              <Button asChild className="rounded-md h-9 px-4 bg-primary text-primary-foreground hover:bg-primary-hover">
                <Link to="/browse">Enter market <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="rounded-md h-9 px-4 text-foreground/80">
                  <Link to="/auth">Log in</Link>
                </Button>
                <Button asChild size="sm" className="rounded-md h-9 px-4 bg-primary text-primary-foreground hover:bg-primary-hover">
                  <Link to="/auth">Sign up</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 70% 40%, hsl(var(--primary) / 0.35), transparent 60%), linear-gradient(135deg, hsl(var(--primary-soft)) 0%, hsl(var(--background)) 60%, hsl(var(--primary) / 0.15) 100%)",
          }}
        />
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-20 md:py-28 grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary-soft text-xs font-medium uppercase tracking-wider text-accent-foreground">
              <Lock className="h-3.5 w-3.5" />
              PhilSys-Verified Marketplace
            </div>
            <h1 className="mt-6 text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              The marketplace<br />where every<br /><span className="text-primary">seller is verified.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              PhilSys National ID verification, biometric liveness checks, and Face ID
              re-authentication. No scammers — only trusted transactions.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <Button asChild size="lg" className="rounded-md h-12 px-6 bg-primary text-primary-foreground hover:bg-primary-hover">
                  <Link to="/browse">
                    Enter market <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="rounded-md h-12 px-6 bg-primary text-primary-foreground hover:bg-primary-hover">
                    <Link to="/auth">
                      Get Started <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="rounded-md h-12 px-6 bg-card border-primary/30 text-primary hover:bg-primary-soft">
                    <Link to="/auth">Sign In</Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Decorative shield network */}
          <div className="relative h-[360px] md:h-[420px] hidden lg:block" aria-hidden>
            <svg viewBox="0 0 500 420" className="absolute inset-0 w-full h-full">
              <defs>
                <radialGradient id="dot" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                </radialGradient>
              </defs>
              {[
                [120, 80], [220, 60], [340, 110], [430, 70],
                [80, 200], [180, 220], [300, 240], [410, 200],
                [140, 320], [260, 340], [380, 320], [460, 360],
              ].map(([x, y], i) => (
                <g key={i}>
                  {[[120, 80], [220, 60], [340, 110], [430, 70], [80, 200], [180, 220], [300, 240], [410, 200], [140, 320], [260, 340], [380, 320], [460, 360]]
                    .filter((_, j) => j > i && Math.hypot(x - _[0], y - _[1]) < 180)
                    .map(([x2, y2], j) => (
                      <line key={j} x1={x} y1={y} x2={x2} y2={y2}
                        stroke="hsl(var(--primary))" strokeOpacity="0.25" strokeWidth="1" />
                    ))}
                </g>
              ))}
              {[[120, 80], [220, 60], [340, 110], [430, 70], [80, 200], [180, 220], [300, 240], [410, 200], [140, 320], [260, 340], [380, 320], [460, 360]].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="14" fill="url(#dot)" />
              ))}
              {[[200, 130], [350, 200], [150, 280]].map(([x, y], i) => (
                <g key={i} transform={`translate(${x - 22} ${y - 26})`} opacity="0.85">
                  <path
                    d="M22 2 L42 10 L42 24 C42 36 32 46 22 50 C12 46 2 36 2 24 L2 10 Z"
                    fill="hsl(var(--primary) / 0.18)"
                    stroke="hsl(var(--primary))"
                    strokeWidth="1.5"
                  />
                </g>
              ))}
            </svg>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-20">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground mb-10">
            How it works
          </p>
          <div className="grid md:grid-cols-3 gap-10 md:gap-14">
            {HOW.map(({ icon: Icon, title, desc }) => (
              <div key={title}>
                <div className="h-11 w-11 rounded-lg border border-primary/20 bg-primary-soft text-primary grid place-items-center">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security architecture */}
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-20 md:py-24">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary-soft text-xs font-medium uppercase tracking-wider text-accent-foreground">
            <BadgeCheck className="h-3.5 w-3.5" />
            Security Architecture
          </div>
          <h2 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight">Built for Cybersecurity</h2>
          <p className="mt-4 text-base text-muted-foreground max-w-2xl">
            Multi-layered security architecture protecting every user interaction from registration to transaction.
          </p>

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SECURITY.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-card p-6 hover:shadow-[var(--shadow-pop)] hover:border-primary/40 transition-all"
              >
                <div className="h-10 w-10 rounded-lg border border-primary/20 bg-primary-soft text-primary grid place-items-center">
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                </div>
                <h3 className="mt-5 text-base font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-border relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 50% 50%, hsl(var(--primary) / 0.18), transparent 70%), hsl(var(--primary-soft))",
          }}
        />
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-20 text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight max-w-3xl mx-auto">
            Trade with people you can <span className="text-primary">actually trust.</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Join a marketplace where identity is proven, not promised.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg" className="rounded-md h-12 px-6 bg-primary text-primary-foreground hover:bg-primary-hover">
              <Link to={user ? "/browse" : "/auth"}>
                {user ? "Browse listings" : "Create your verified account"} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="max-w-7xl mx-auto px-5 md:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="font-semibold text-primary">Marketa</span>
          <span>· PhilSys-verified marketplace</span>
        </div>
        <p>© {new Date().getFullYear()} Marketa. All rights reserved.</p>
      </footer>
    </div>
  );
}
