import { Radar } from "lucide-react";

export const Logo = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <div className="relative grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow signal-glow">
      <Radar className="h-5 w-5 text-primary-foreground" strokeWidth={2.25} />
      <span className="absolute inset-0 rounded-lg ring-1 ring-white/20" />
    </div>
    <div className="leading-none">
      <div className="text-xl font-extrabold tracking-tight">رصد</div>
      <div className="mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">RASAD</div>
    </div>
  </div>
);
