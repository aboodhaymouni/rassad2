import { useEffect, useRef, useState, type ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right" | "fade";

interface Props {
  children: ReactNode;
  direction?: Direction;
  delay?: number; // ms
  duration?: number; // ms
  once?: boolean;
  threshold?: number;
  className?: string;
  /** Pass `as="section"` etc. to render a different tag. Default: div. */
  as?: keyof JSX.IntrinsicElements;
}

const offsetClass = (d: Direction): string => {
  switch (d) {
    case "up":
      return "translate-y-6";
    case "down":
      return "-translate-y-6";
    case "left":
      return "translate-x-6"; // RTL: visually starts from the right
    case "right":
      return "-translate-x-6";
    case "fade":
    default:
      return "";
  }
};

/**
 * Reveals its children with a fade + small translate on first scroll into view.
 * Respects prefers-reduced-motion (renders children immediately when set).
 */
export const Reveal = ({
  children,
  direction = "up",
  delay = 0,
  duration = 700,
  once = true,
  threshold = 0.12,
  className = "",
  as = "div",
}: Props) => {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setShown(false);
          }
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once, threshold, reduced]);

  const Tag = as as any;
  const offset = offsetClass(direction);
  return (
    <Tag
      ref={ref as any}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
        transitionProperty: "opacity, transform",
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: shown ? "auto" : "opacity, transform",
      }}
      className={`${shown ? "translate-x-0 translate-y-0 opacity-100" : `${offset} opacity-0`} ${className}`}
    >
      {children}
    </Tag>
  );
};
