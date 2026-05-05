import { ReactNode } from "react";

export const SectionHeader = ({
  eyebrow, title, subtitle, align = "center",
}: { eyebrow?: string; title: string; subtitle?: string | ReactNode; align?: "center" | "right" }) => (
  <div className={`mb-14 ${align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-3xl"}`}>
    {eyebrow && (
      <div className={`mono mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-primary`}>
        <span className="h-px w-8 bg-primary/60" />
        {eyebrow}
      </div>
    )}
    <h2 className="text-3xl font-extrabold leading-[1.4] md:text-4xl md:leading-[1.35]">{title}</h2>
    {subtitle && <p className="mt-5 text-base leading-[2] text-muted-foreground">{subtitle}</p>}
  </div>
);
