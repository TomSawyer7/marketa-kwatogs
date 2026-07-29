import { Link } from "react-router-dom";
import { Store } from "lucide-react";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-12 border-t border-border bg-card/40">
      <div className="px-4 md:px-6 lg:px-8 py-8 max-w-7xl mx-auto grid gap-8 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center">
              <Store className="h-4 w-4" />
            </div>
            <span className="font-bold tracking-tight">Marketa</span>
          </div>
          <p className="text-sm text-muted-foreground mt-3 max-w-xs">
            A verified peer-to-peer marketplace built for trust and safety in the Philippines.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Legal</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/legal/terms" className="hover:text-foreground">Terms &amp; Conditions</Link></li>
            <li><Link to="/legal/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
            <li><Link to="/legal/community" className="hover:text-foreground">Community Guidelines</Link></li>
            <li><Link to="/contact" className="hover:text-foreground">Contact Us</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Marketplace</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/browse" className="hover:text-foreground">Browse listings</Link></li>
            <li><Link to="/sell" className="hover:text-foreground">Sell an item</Link></li>
            <li><Link to="/saved" className="hover:text-foreground">Saved</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="px-4 md:px-6 lg:px-8 py-4 max-w-7xl mx-auto text-xs text-muted-foreground flex flex-col md:flex-row items-center justify-between gap-2">
          <p>© {year} Marketa. All rights reserved.</p>
          <p>Governed by the laws of the Republic of the Philippines.</p>
        </div>
      </div>
    </footer>
  );
}
