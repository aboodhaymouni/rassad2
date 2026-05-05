import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

type Notif = {
  id: string;
  matched_keyword: string;
  read: boolean;
  created_at: string;
  article_id: string | null;
};

export const NotificationsBell = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const unread = items.filter((i) => !i.read).length;

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("alert_notifications")
      .select("id, matched_keyword, read, created_at, article_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as Notif[]);
  };

  useEffect(() => { load(); }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("alert_notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    load();
  };

  return (
    <Popover onOpenChange={(o) => o && unread > 0 && markAllRead()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -end-1 h-4 min-w-4 px-1 text-[10px]">{unread}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-semibold">التنبيهات</span>
          <span className="text-[11px] text-muted-foreground">{items.length} حدث</span>
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">لا توجد تنبيهات بعد</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {items.map((n) => (
                <li key={n.id} className="p-3 text-sm">
                  <p className="font-medium">طابق كلمة: <span className="text-primary">{n.matched_keyword}</span></p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ar })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
