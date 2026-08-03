"use client";

import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  ShoppingCart,
} from "lucide-react";
import MobileNavbar from "./MobileNavbar";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import ProfileDialog from "./ProfileDialog";
import AIChatAssistant from "./AIChatAssistant"; // Nuevo

const navItems = [
  { name: "Resumen", path: "/dashboard", icon: PiggyBank },
  { name: "Lo que tienes", path: "/cash", icon: Banknote },
  { name: "Te deben", path: "/debtors", icon: ThumbsUp },
  { name: "Debes", path: "/creditors", icon: ThumbsDown },
  { name: "Tus Tarjetas", path: "/cards", icon: CreditCard },
  { name: "Lista de Compras", path: "/shopping-list", icon: ShoppingCart },
  { name: "Tus Metas", path: "/savings", icon: Wallet },
  { name: "Presupuestos", path: "/shared-budgets", icon: BarChart },
  { name: "Categorías", path: "/categories", icon: Tag },
];

const Sidebar = () => {
  const location = useLocation();

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
    </nav>
  );
};

const Layout: React.FC = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { user } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [forceProfileOpen, setForceProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ first_name?: string; last_name?: string; avatar_url?: string } | null>(null);

  const currentPageName = navItems.find(item => item.path === location.pathname)?.name || "Oinkash";

  const fetchProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("first_name, last_name, avatar_url")
      .eq("id", user.id)
      .single();

    if (!error && data) {
      setUserProfile(data);
      if (!data.first_name || !data.last_name || !data.avatar_url) {
        setForceProfileOpen(true);
        setIsProfileOpen(true);
      } else {
        setForceProfileOpen(false);
      }
    } else {
      setForceProfileOpen(true);
      setIsProfileOpen(true);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user, isProfileOpen]);

  const handleLogout = () => {
    supabase.auth.signOut();
  };

  const userInitials = `${userProfile?.first_name?.charAt(0) || user?.user_metadata?.first_name?.charAt(0) || ""}${userProfile?.last_name?.charAt(0) || user?.user_metadata?.last_name?.charAt(0) || ""}`.toUpperCase() || "U";

  const renderHeaderActions = () => (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsProfileOpen(true)}
        className="rounded-full h-9 w-9 p-0 hover:bg-muted"
        title="Mi Perfil"
      >
        <Avatar className="h-8 w-8 border border-primary/20">
          <AvatarImage src={userProfile?.avatar_url} alt="Avatar" />
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
            {userInitials}
          </AvatarFallback>
        </Avatar>
      </Button>

      {!forceProfileOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="rounded-full h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="Cerrar Sesión"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {isMobile ? (
        <div className="flex flex-col w-full">
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-background/80 backdrop-blur-md px-4 border-b">
            <div className="flex items-center gap-2">
              <img src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Logo%20App.png" alt="Logo" className="h-8 w-8" />
              <h1 className="text-lg font-bold">{currentPageName}</h1>
            </div>
            {renderHeaderActions()}
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
            <div className="flex flex-col h-full">
              <header className="flex h-16 items-center justify-between px-8 lg:px-12 border-b bg-background/80 backdrop-blur-md shrink-0">
                <div className="text-sm font-semibold text-muted-foreground">
                  {currentPageName}
                </div>
                {renderHeaderActions()}
              </header>
              <main className="flex-1 overflow-y-auto p-8 lg:p-12 max-w-7xl mx-auto w-full">
                <Outlet />
              </main>
            </div>
          </Panel>
        </PanelGroup>
      )}

      <AIChatAssistant /> {/* Añadido aquí */}

      <ProfileDialog 
        isOpen={isProfileOpen} 
        onClose={() => {
          setIsProfileOpen(false);
          fetchProfile();
        }} 
        forceOpen={forceProfileOpen}
      />
    </div>
  );
};

export default Layout;