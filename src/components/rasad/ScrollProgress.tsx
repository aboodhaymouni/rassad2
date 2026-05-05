import { useEffect, useState } from "react";

/**
 * Thin progress bar fixed at the top of the viewport that fills as the user
 * scrolls down the document.
 */
export const ScrollProgress = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0;
      setProgress(pct);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] bg-transparent"
    >
      <div
        className="h-full origin-right bg-gradient-to-l from-primary via-primary to-primary/40 shadow-[0_0_12px_rgba(200,57,45,0.6)] transition-[width] duration-150"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
};
