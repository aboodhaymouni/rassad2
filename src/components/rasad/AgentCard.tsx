import { LucideIcon, CheckCircle2 } from "lucide-react";

export const AgentCard = ({
  Icon, title, desc, status = "نشط", placeholder, accent,
}: {
  Icon: LucideIcon; title: string; desc: string; status?: string; placeholder?: string; accent?: boolean;
}) => (
  <div className={`glass-panel group relative overflow-hidden p-6 transition hover:-translate-y-0.5 ${accent ? "border-primary/30" : ""}`}>
    <div className="absolute -start-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl opacity-0 transition group-hover:opacity-100" />
    <div className="flex items-start justify-between">
      <div className="grid h-12 w-12 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
        <Icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-verified/30 bg-verified/10 px-2 py-0.5 text-[10px] font-semibold text-verified">
        <span className="h-1.5 w-1.5 rounded-full bg-verified pulse-ring" />
        <CheckCircle2 className="h-3 w-3" /> {status}
      </span>
    </div>
    <h3 className="mt-5 text-lg font-bold">{title}</h3>
    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{desc}</p>

    {placeholder && (
      <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-background/50 p-1.5">
        <input
          placeholder={placeholder}
          className="flex-1 bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/60"
        />
        <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110">
          تشغيل
        </button>
      </div>
    )}

    <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4 text-[11px] text-muted-foreground">
      <span className="mono">UPTIME 99.9%</span>
      <span className="mono">LAT 240ms</span>
    </div>
  </div>
);
