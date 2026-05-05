import { useEffect, useState } from "react";
import { Plus, FolderHeart, Trash2, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VerdictBadge } from "@/components/rasad/Badge";
import type { Collection, Verification } from "@/components/dashboard/types";

type Item = { id: string; verification: Verification };

export default function Collections() {
  const { user } = useAuth();
  const [cols, setCols] = useState<Collection[]>([]);
  const [items, setItems] = useState<Record<string, Item[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: cs } = await supabase.from("collections").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setCols((cs ?? []) as Collection[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const loadItems = async (colId: string) => {
    const { data } = await supabase
      .from("collection_items")
      .select("id, verification:verifications(*)")
      .eq("collection_id", colId)
      .order("added_at", { ascending: false });
    setItems((p) => ({ ...p, [colId]: (data ?? []) as unknown as Item[] }));
  };

  const create = async () => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("collections").insert({ user_id: user.id, name: name.trim(), description: desc.trim() || null });
    if (error) { toast.error("فشل الإنشاء"); return; }
    toast.success("تم الإنشاء"); setOpen(false); setName(""); setDesc(""); load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف المجموعة وكل ما فيها؟")) return;
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) toast.error("فشل الحذف"); else { toast.success("حُذفت"); load(); }
  };

  const removeItem = async (itemId: string, colId: string) => {
    await supabase.from("collection_items").delete().eq("id", itemId);
    loadItems(colId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المجموعات</h1>
          <p className="mt-1 text-sm text-muted-foreground">نظّم عمليات تحققك في مجموعات</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> جديدة</Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : cols.length === 0 ? (
        <Card className="border-dashed border-border/50 bg-transparent p-12 text-center">
          <FolderHeart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">لا مجموعات بعد. أنشئ أول مجموعة لتنظيم تحقّقاتك.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {cols.map((c) => (
            <Collapsible key={c.id} onOpenChange={(o) => o && !items[c.id] && loadItems(c.id)}>
              <Card className="border-border/50">
                <div className="flex items-center justify-between p-4">
                  <CollapsibleTrigger className="flex flex-1 items-center gap-3 text-start">
                    <ChevronDown className="h-4 w-4 transition-transform [&[data-state=open]]:rotate-180" />
                    <FolderHeart className="h-5 w-5 text-primary" />
                    <div className="min-w-0">
                      <div className="font-semibold">{c.name}</div>
                      {c.description && <div className="text-xs text-muted-foreground line-clamp-1">{c.description}</div>}
                    </div>
                  </CollapsibleTrigger>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <CollapsibleContent>
                  <div className="border-t border-border/50 p-4 space-y-2">
                    {!items[c.id] ? (
                      <Skeleton className="h-12" />
                    ) : items[c.id].length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">لا عناصر بعد. احفظ تحقّقًا من صفحة "تحقّق جديد".</p>
                    ) : (
                      items[c.id].map((it) => (
                        <div key={it.id} className="flex items-start gap-3 rounded-md border border-border/50 bg-background/40 p-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <VerdictBadge verdict={it.verification.verdict === "uncertain" ? "suspicious" : it.verification.verdict} />
                              <span className="mono text-[10px] text-muted-foreground">CONF {it.verification.confidence}%</span>
                            </div>
                            <p className="line-clamp-2 text-xs">{it.verification.input_text}</p>
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(it.id, c.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>مجموعة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="اسم المجموعة" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <Textarea placeholder="وصف اختياري..." value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={300} />
          </div>
          <DialogFooter><Button onClick={create} disabled={!name.trim()}>إنشاء</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
