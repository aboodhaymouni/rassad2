import { ConfidenceRing } from "./ConfidenceRing";
import { VerdictBadge, Verdict } from "./Badge";
import { Clock, MapPin, Link2, ArrowLeft } from "lucide-react";

export const NewsCard = ({
  title, category, verdict, confidence, sources, time, image,
}: {
  title: string; category: string; verdict: Verdict; confidence: number; sources: number; time: string; image?: string;
}) => (
  <article className="glass-panel group overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/30">
    <div className="relative h-44 overflow-hidden bg-surface-2">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-80 transition group-hover:scale-105"
        style={{ backgroundImage: image ? `url(${image})` : "linear-gradient(135deg,#16213e,#0f1722)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      <div className="absolute end-3 top-3"><VerdictBadge verdict={verdict} /></div>
      <span className="absolute start-3 top-3 chip mono">{category}</span>
    </div>

    <div className="space-y-3 p-5">
      <h3 className="line-clamp-2 text-base font-bold leading-7">{title}</h3>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> {sources} مصدر</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {time}</span>
        </div>
        <ConfidenceRing value={confidence} size={42} />
      </div>
      <div className="h-px bg-white/[0.05]" />
      <button className="flex w-full items-center justify-between text-sm font-medium text-foreground/90 hover:text-primary">
        عرض تقرير التحقق <ArrowLeft className="h-4 w-4" />
      </button>
    </div>
  </article>
);

export const _icons = { MapPin };
