import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const GenerateButton = ({ onGenerate, loading }: { onGenerate: () => Promise<boolean>; loading: boolean }) => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  if (!isAdmin) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={async () => {
        const ok = await onGenerate();
        if (ok) toast.success("تم توليد محتوى جديد");
        else toast.error("تعذّر التوليد");
      }}
      className="gap-2"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      توليد محتوى جديد
    </Button>
  );
};

export const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-dashed border-white/[0.08] bg-card/40 p-10 text-center">
    <p className="text-sm text-muted-foreground">{message}</p>
    <p className="mt-2 text-xs text-muted-foreground">يقوم المدير بتوليد المحتوى دوريًا عبر الذكاء الاصطناعي.</p>
  </div>
);
