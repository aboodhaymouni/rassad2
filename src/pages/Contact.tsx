import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/rasad/Layout";
import { SectionHeader } from "@/components/rasad/SectionHeader";
import { Breadcrumbs } from "@/components/rasad/Breadcrumbs";
import { Seo } from "@/components/seo/Seo";
import { JsonLd, buildBreadcrumbSchema } from "@/components/seo/JsonLd";
import { Mail, MessageCircle, Clock, Send } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(2, "الاسم قصير جداً").max(100),
  email: z.string().trim().email("بريد إلكتروني غير صالح").max(255),
  subject: z.string().trim().min(2, "الموضوع قصير جداً").max(150),
  message: z.string().trim().min(10, "الرسالة قصيرة جداً").max(2000),
});

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { error } = await supabase.from("contact_messages").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject.trim(),
      message: form.message.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error("تعذّر إرسال الرسالة. حاول مجددًا.");
      return;
    }
    toast.success("شكراً لتواصلك! سنرد عليك خلال 24 ساعة.");
    setForm({ name: "", email: "", subject: "", message: "" });
  };

  const field = (key: keyof typeof form, label: string, type = "text", textarea = false) => (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-foreground">{label}</span>
      {textarea ? (
        <textarea
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          rows={5}
          className="w-full rounded-md border border-white/[0.08] bg-background/40 px-3 py-2.5 text-sm outline-none ring-primary/40 placeholder:text-muted-foreground/60 focus:ring-2"
        />
      ) : (
        <input
          type={type}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full rounded-md border border-white/[0.08] bg-background/40 px-3 py-2.5 text-sm outline-none ring-primary/40 placeholder:text-muted-foreground/60 focus:ring-2"
        />
      )}
      {errors[key] && <span className="mt-1 block text-xs text-primary">{errors[key]}</span>}
    </label>
  );

  return (
    <Layout>
      <Seo
        title="تواصل معنا | رصد"
        description="نموذج تواصل، واتساب الدعم، البريد الإلكتروني وساعات العمل لفريق رصد."
        path="/contact"
      />
      <JsonLd data={buildBreadcrumbSchema([{ name: "الرئيسية", path: "/" }, { name: "تواصل", path: "/contact" }])} />
      <Breadcrumbs items={[{ name: "تواصل معنا" }]} />

      <section className="container py-12 md:py-16">
        <SectionHeader
          eyebrow="نسعد بسماعك"
          title="تواصل مع فريق رصد"
          subtitle="فريقنا متاح لأي استفسار، شراكة، أو دعم تقني."
          align="right"
        />

        <div className="grid gap-8 md:grid-cols-3">
          <form onSubmit={submit} className="glass-panel space-y-5 p-7 md:col-span-2" noValidate>
            <div className="grid gap-5 md:grid-cols-2">
              {field("name", "الاسم الكامل")}
              {field("email", "البريد الإلكتروني", "email")}
            </div>
            {field("subject", "موضوع الرسالة")}
            {field("message", "الرسالة", "text", true)}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-primary to-primary/80 px-6 py-3 text-sm font-bold text-primary-foreground signal-glow ring-1 ring-white/10 transition hover:brightness-110 disabled:opacity-60"
              style={{ minHeight: 48 }}
            >
              <Send className="h-4 w-4" />
              {submitting ? "جارٍ الإرسال..." : "إرسال الرسالة"}
            </button>
          </form>

          <aside className="space-y-4">
            <a
              href="https://wa.me/962790000000"
              target="_blank"
              rel="noopener noreferrer"
              className="glass-panel flex items-start gap-4 p-5 transition hover:border-verified/40"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-verified/15 text-verified">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold">واتساب الدعم</div>
                <div className="mt-1 text-xs text-muted-foreground">تحدث معنا فوراً</div>
              </div>
            </a>

            <a href="mailto:hello@rassad.io" className="glass-panel flex items-start gap-4 p-5 transition hover:border-primary/40">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold">البريد الإلكتروني</div>
                <div className="mono mt-1 text-xs text-muted-foreground">hello@rassad.io</div>
              </div>
            </a>

            <div className="glass-panel flex items-start gap-4 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-info/15 text-info">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold">ساعات الدعم</div>
                <div className="mt-1 text-xs leading-6 text-muted-foreground">
                  الأحد – الخميس<br />9 صباحاً – 6 مساءً<br /><span className="mono">(GMT+3 عمّان)</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </Layout>
  );
};

export default Contact;
