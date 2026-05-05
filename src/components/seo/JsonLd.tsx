import { Helmet } from "react-helmet-async";

export const JsonLd = ({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) => (
  <Helmet>
    <script type="application/ld+json">{JSON.stringify(data)}</script>
  </Helmet>
);

const SITE = "https://rassad.io";

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "رصد",
  alternateName: "RASAD",
  url: SITE,
  logo: `${SITE}/favicon.svg`,
  description: "منصة عربية للتحقق من الأخبار والمحتوى الرقمي بدعم الذكاء الاصطناعي.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "hello@rassad.io",
    availableLanguage: ["Arabic", "English"],
  },
};

export const webApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "رصد",
  url: SITE,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  inLanguage: "ar",
};

export const buildBreadcrumbSchema = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    item: `${SITE}${it.path}`,
  })),
});

export const buildFaqSchema = (qa: { q: string; a: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: qa.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
});
