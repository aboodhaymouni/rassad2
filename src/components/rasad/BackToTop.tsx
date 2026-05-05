import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Floating "back to top" button. Appears after the user scrolls past the
 * first viewport. Click invokes window.scrollTo — Lenis intercepts for the
 * smooth feel.
 */
export const BackToTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.6);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="العودة إلى الأعلى"
      className={`fixed bottom-6 start-6 z-40 grid h-11 w-11 place-items-center rounded-full border border-white/[0.08] bg-background/80 text-foreground backdrop-blur-xl shadow-elev transition-all duration-300 hover:border-primary/40 hover:bg-primary/10 hover:text-primary md:bottom-8 md:start-8 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
};
