import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CookieBanner } from "./CookieBanner";
import { StickyMobileCTA } from "./StickyMobileCTA";

export const Layout = ({ children, hideMobileCTA = false }: { children: ReactNode; hideMobileCTA?: boolean }) => (
  <div className="min-h-screen">
    <Navbar />
    <main>{children}</main>
    <Footer />
    {!hideMobileCTA && <StickyMobileCTA />}
    <CookieBanner />
  </div>
);
