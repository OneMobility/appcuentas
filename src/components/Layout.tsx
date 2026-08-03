"use client";

import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Banknote,
  ThumbsUp,
  ThumbsDown,
  CreditCard,
  Tag,
  LogOut,
  Wallet,
  BarChart,
  ShoppingCart,
  CalendarDays,
  LayoutDashboard,
} from "lucide-react";
import MobileNavbar from "./MobileNavbar";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import ProfileDialog from "./ProfileDialog";
import AIChatAssistant from "./AIChatAssistant";

const navItems = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Efectivo", path: "/cash", icon: Banknote },
  { name: "Me deben", path: "/debtors", icon: ThumbsUp },
  { name: "Debo", path: "/creditors", icon: ThumbsDown },
  { name: "Tarjetas", path: "/cards", icon: CreditCard },
  { name: "Suscripciones", path: "/recurring", icon: CalendarDays },
  { name: "Súper", path: "/shopping-list", icon: ShoppingCart },
  { name: "Metas", path: "/savings", icon: Wallet },
  { name: "Compartidos", path: "/shared-budgets", icon: BarChart },
  { name: "Categorías", path: "/categories", icon: Tag },
];

const Sidebar = () => {
  const location = useLocation();
  return (
    <nav className="flex flex-col gap-4 p-6 h-full text-white bg-slate-950">
      <Link to="/dashboard" className="flex items-center gap-3 mb-10 group">
        <div className="p-2 bg-primary rounded-2xl shadow-lg shadow-primary/20 group-hover:rotate-12 transition-transform">
          <img src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Logo%20App.png" alt="Oinkash" className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-black tracking-tighter">Oinkash</h2>
      </Link>
      <div className="flex-1 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-xs font-bold transition-all",
                isActive 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "text-slate-400 hover:text-white hover:bg-white/5",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </div>
      <div className="pt-4 border-t border-white/5 opacity-40">
        <p className="text-[9px] font-black text-center uppercase tracking-widest">Oinkash v2.0</p>
      </div>
    </nav>
  );
};

const Layout: React.FC = () => {
  const isMobile = useIsMobile();
  const { user } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq('id', user.id).single();
      setUserProfile(data);
    };
    fetchProfile();
  }, [user]);

  const handleLogout = () => supabase.auth.signOut();
  const initials = `${userProfile?.first_name?.charAt(0) || "U"}${userProfile?.last_name?.charAt(0) || ""}`.toUpperCase();

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      {isMobile ? (
        <div className="flex flex-col w-full">
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-white/80 backdrop-blur-md px-6 border-b border-slate-100 shadow-sm">
            <div className="flex items-center gap-2">
              <img src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Logo%20App.png" className="h-8 w-8" />
              <h1 className="text-lg font-black tracking-tighter">Oinkash</h1>
            </div>
            <Button variant="ghost" onClick={() => setIsProfileOpen(true)} className="rounded-full p-0 h-9 w-9 border border-slate-100 shadow-sm">
              <Avatar className="h-full w-full"><AvatarImage src={userProfile?.avatar_url} /><AvatarFallback>{initials}</AvatarFallback></Avatar>
            </Button>
          </header>
          <main className="flex-1 p-4 pb-24 overflow-x-hidden"><Outlet /></main>
          <MobileNavbar />
        </div>
      ) : (
        <PanelGroup direction="horizontal" className="w-full">
          <Panel defaultSize={15} minSize={12} maxSize={20} className="bg-slate-950 shadow-2xl"><Sidebar /></Panel>
          <PanelResizeHandle className="w-0" />
          <Panel defaultSize={85}>
            <div className="flex flex-col h-full">
              <header className="flex h-16 items-center justify-end px-10 gap-4 bg-white/50 backdrop-blur-sm border-b border-slate-100">
                <Button variant="ghost" onClick={() => setIsProfileOpen(true)} className="rounded-full p-0 h-10 w-10 border border-slate-200 shadow-sm hover:scale-105 transition-transform">
                  <Avatar className="h-full w-full"><AvatarImage src={userProfile?.avatar_url} /><AvatarFallback>{initials}</AvatarFallback></Avatar>
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full h-10 w-10 text-slate-400 hover:text-rose-500 hover:bg-rose-50"><LogOut className="h-5 w-5" /></Button>
              </header>
              <main className="flex-1 overflow-y-auto p-10"><Outlet /></main>
            </div>
          </Panel>
        </PanelGroup>
      )}
      <AIChatAssistant />
      <ProfileDialog isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
};

export default Layout;