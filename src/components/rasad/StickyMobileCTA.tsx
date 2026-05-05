import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export const StickyMobileCTA = () => (
  <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-background/95 p-3 backdrop-blur-xl md:hidden">
    <Link
      to="/social"
      className="flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b from-primary to-primary/80 py-3 text-sm font-bold text-primary-foreground signal-glow ring-1 ring-white/10"
      style={{ minHeight: 48 }}
    >
      <ShieldCheck className="h-4 w-4" />
      ابدأ التحقق مجاناً
    </Link>
  </div>
);
