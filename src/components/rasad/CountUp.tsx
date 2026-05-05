import { useEffect, useRef, useState } from "react";

interface Props {
  /** target numeric value */
  to: number;
  /** ms duration */
  duration?: number;
  /** prefix (e.g. "+", "<") */
  prefix?: string;
  /** suffix (e.g. "%", " ثانية") */
  suffix?: string;
  /** decimals to show */
  decimals?: number;
  /** locale for formatting */
  locale?: string;
  className?: string;
  /** start animation only after entering viewport */
  triggerOnView?: boolean;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts up from 0 to `to` when scrolled into view.
 * Respects prefers-reduced-motion (renders the final value immediately).
 */
export const CountUp = ({
  to,
  duration = 1400,
  prefix = "",
  suffix = "",
  decimals = 0,
  locale = "en-US",
  className = "",
  triggerOnView = true,
}: Props) => {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(to);
      return;
    }

    const start = () => {
      if (started.current) return;
      started.current = true;
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        setValue(to * easeOutCubic(t));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (!triggerOnView) {
      start();
      return;
    }

    const el = ref.current;
    if (!el) {
      start();
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            start();
            obs.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration, triggerOnView]);

  const formatted = value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
