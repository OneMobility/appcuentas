"use client";

import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"; // Mantener Sheet para posible uso futuro, pero no para navegación principal
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Menu, // Mantener el icono de menú para el Sheet si se usa para otras cosas (ej. ajustes)
  Home,
  Banknote,
  UserRound,
  Landmark,
  CreditCard,
  Tag,
} from "lucide-react";
import MobileNavbar from "./MobileNavbar";

const navItems = [
  {
    name: "Resumen", // Cambiado de Dashboard
    path: "/dashboard",
    icon: Home,
  },
  {
    name: "Tu Dinerito", // Cambiado de Efectivo
    path: "/cash",
    icon: Banknote,
  },
  {
    name: "Te Deben", // Cambiado de Deudores
    path: "/debtors",
    icon: UserRound,
  },
  {
    name: "Le Debes", // Cambiado de Acreedores
    path: "/creditors",
    icon: Landmark,
  },
  {
    name: "Tarjetas",
    path: "/cards",
    icon: CreditCard,
  },
  {
    name: "Categorías",
    path: "/categories",
    icon: Tag,
  },
];

const Sidebar = ({ onClose }: { onClose?: () => void }) => {
  const location = useLocation();

  return (
    <nav className="flex flex-col gap-2 p-4">
      <Link to="/dashboard" className="flex items-center gap-2 mb-6 text-sidebar-foreground" onClick={onClose}>
        <img src="/oinkash-logo.png" alt="Oinkash Logo" className="h-8 w-8" />
        <h2 className="text-2xl font-bold">Oinkash</h2>
      </Link>
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
    </nav>
  );
};

const Layout = () => {
  const isMobile = useIsMobile();
  const location = useLocation();

  // Obtener el nombre de la página actual para el encabezado móvil
  const currentPageName = navItems.find(item => item.path === location.pathname)?.name || "Oinkash";

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      {isMobile ? (
        <>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 shadow-sm">
            <img src="/oinkash-logo.png" alt="Oinkash Logo" className="h-8 w-8" />
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