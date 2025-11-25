"use client";

import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Menu,
  PiggyBank,
  Banknote,
  ThumbsUp,
  ThumbsDown,
  CreditCard,
  Tag,
  LogOut,
  Wallet, // Nuevo icono para ahorros
  Lightbulb, // Icono para retos
} from "lucide-react";
import MobileNavbar from "./MobileNavbar";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  {
    name: "Resumen",
    path: "/dashboard",
    icon: PiggyBank,
  },
  {
    name: "Lo que tienes", // Título actualizado
    path: "/cash",
    icon: Banknote,
  },
  {
    name: "Los que te deben", // Título actualizado
    path: "/debtors",
    icon: ThumbsUp,
  },
  {
    name: "A quien le debes", // Título actualizado
    path: "/creditors",
    icon: ThumbsDown,
  },
  {
    name: "Tus Tarjetas", // Título actualizado
    path: "/cards",
    icon: CreditCard,
  },
  {
    name: "Tus Metas", // Título actualizado
    path: "/savings",
    icon: Wallet, // Icono para ahorros
  },
  {
    name: "Tus Retos", // Nuevo elemento de navegación
    path: "/challenges",
    icon: Lightbulb, // Icono para retos
  },
  {
    name: "Categorías",
    path: "/categories",
    icon: Tag,
  },
];

const Sidebar = ({ onClose }: { onClose?: () => void }) => {
  const location = useLocation();
  const { user } = useSession();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onClose) onClose();
  };

  return (
    <nav className="flex flex-col gap-2 p-4 h-full">
      <Link to="/dashboard" className="flex items-center gap-2 mb-6 text-sidebar-foreground" onClick={onClose}>
        <img src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Oinkash%20Logo.png" alt="Oinkash Logo" className="h-8 w-8" />
        <h2 className="text-2xl font-bold">Oinkash</h2>
      </Link>
      <div className="flex-1">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              location.pathname === item.path && "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
            )}
            onClick={onClose}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        ))}
      </div>
      {user && (
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:bg-destructive hover:text-destructive-foreground mt-auto"
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </Button>
      )}
    </nav>
  );
};

const Layout = () => {
  const isMobile = useIsMobile();
  const location = useLocation();

  const currentPageName = navItems.find(item => item.path === location.pathname)?.name || "Oinkash";

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      {isMobile ? (
        <>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 shadow-sm">
            <img src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Oinkash%20Logo.png" alt="Oinkash Logo" className="h-8 w-8" />
            <h1 className="text-xl font-semibold">{currentPageName}</h1>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 pb-20 lg:gap-6 lg:p-6">
            <Outlet />
          </main>
          <MobileNavbar />
        </>
      ) : (
        <PanelGroup direction="horizontal" className="min-h-screen">
          <Panel defaultSize={15} minSize={10} maxSize={20} className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-md">
            <Sidebar />
          </Panel>
          <PanelResizeHandle className="w-2 bg-sidebar-border hover:bg-sidebar-ring transition-colors" />
          <Panel defaultSize={85}>
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
              <Outlet />
            </main>
          </Panel>
        </PanelGroup>
      )}
    </div>
  );
};

export default Layout;