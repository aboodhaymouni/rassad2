import { Outlet } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import { NotificationsBell } from "./NotificationsBell";
import { useAuth } from "@/hooks/useAuth";

export const DashboardLayout = () => {
  const { user } = useAuth();
  return (
    <SidebarProvider>
      <Helmet><title>لوحة التحكم | رصد</title></Helmet>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 border-b border-border/50 bg-background/80 backdrop-blur-xl">
            <div className="flex h-full items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user?.email}
                </span>
              </div>
              <NotificationsBell />
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden">
            <div className="container max-w-6xl py-6 sm:py-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
