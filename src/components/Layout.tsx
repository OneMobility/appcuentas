"use client";

import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  PiggyBank,
  Banknote,
  ThumbsUp,
  ThumbsDown,
  CreditCard,
  Tag,
  LogOut,
  Wallet,
  BarChart,
} from "lucide-react";
import MobileNavbar from "./MobileNavbar";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { name: "Resumen", path: "/dashboard", icon: PiggyBank },
  { name: "Lo que tienes", path: "/cash", icon: Banknote },
  { name: "Los que te deben", path: "/debtors", icon: ThumbsUp },
  { name: "A quien le debes", path: "/creditors", icon: ThumbsDown },
  { name: "Tus Tarjetas", path: "/cards", icon: CreditCard },
  { name: "Tus Metas", path: "/savings", icon: Wallet },
  { name: "Presupuestos", path: "/shared-budgets", icon: BarChart },
  { name: "Categorías", path: "/categories", icon: Tag },
];

const Sidebar = () => {
  const location = useLocation();
  const { user } = useSession();

  return (
    <nav className="flex flex-col gap-2 p-6 h-full">
      <Link to="/dashboard" className="flex items-center gap-3 mb-8 text-sidebar-foreground">
        <img src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Logo%20App.png" alt="Oinkash Logo" className="h-10 w-10" />
        <h2 className="text-2xl font-bold tracking-tight">Oinkash</h2>
      </Link>
      <div className="flex-1 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sidebar-foreground transition-all hover:bg-sidebar-accent/50",
              location.pathname === item.path && "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm",
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        ))}
      </div>
      {user && (
        <Button
          variant="ghost"
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive-foreground mt-auto"
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </Button>
      )}
    </nav>
  );
};

const Layout: React.FC = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const currentPageName = navItems.find(item => item.path === location.pathname)?.name || "Oinkash";

  return (
    <div className="flex min-h-screen w-full bg-background">
      {isMobile ? (
        <div className="flex flex-col w-full">
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-background/80 backdrop-blur-md px-4 border-b">
            <div className="flex items-center gap-2">
              <img src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Logo%20App.png" alt="Logo" className="h-8 w-8" />
              <h1 className="text-lg font-bold">{currentPageName}</h1>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 pb-24">
            <Outlet />
          </main>
          <MobileNavbar />
        </div>
      ) : (
        <PanelGroup direction="horizontal" className="w-full">
          <Panel defaultSize={20} minSize={15} maxSize={25} className="bg-sidebar text-sidebar-foreground border-r">
            <Sidebar />
          </Panel>
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />
          <Panel defaultSize={80}>
            <main className="h-full overflow-y-auto p-8 lg:p-12 max-w-7xl mx-auto">
              <Outlet />
            </main>
          </Panel>
        </PanelGroup>
      )}
    </div>
  );
};

export default Layout;