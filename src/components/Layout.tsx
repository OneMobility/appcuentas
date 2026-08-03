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
  CalendarDays,
  Sparkles,
  Heart,
} from "lucide-react";
import MobileNavbar from "./MobileNavbar";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import ProfileDialog from "./ProfileDialog";
import AIChatAssistant from "./AIChatAssistant";

const navItems = [
  { name: "Inicio 🏠", path: "/dashboard", icon: Sparkles },
  { name: "Mi Cash 👛", path: "/cash", icon: Banknote },
  { name: "Mis Deudores 🍭", path: "/debtors", icon: ThumbsUp },
  { name: "Mis Deudas 🍬", path: "/creditors", icon: ThumbsDown },
  { name: "Tarjetitas 💳", path: "/cards", icon: CreditCard },
  { name: "Suscripciones 📅", path: "/recurring", icon: CalendarDays },
  { name: "Súper 🛒", path: "/shopping-list", icon: ShoppingCart },
  { name: "Metitas 🎯", path: "/savings", icon: Heart },
  { name: "Grupal 🤝", path: "/shared-budgets", icon: BarChart },
  { name: "Categorías 🏷️", path: "/categories", icon: Tag },
];

const Sidebar = () => {
  const location = useLocation();
  return (
    <nav className="flex flex-col gap-4 p-6 h-full">
      <Link to="/dashboard" className="flex items-center gap-3 mb-10 text-sidebar-foreground group">
        <div className="p-2 bg-white rounded-[1.5rem] shadow-sm group-hover:rotate-12 transition-transform">
          <img src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Logo%20App.png" alt="Oinkash" className="h-10 w-10" />
        </div>
        <h2 className="text-3xl font-black tracking-tighter text-primary-foreground">Oinkash</h2>
      </Link>
      <div className="flex-1 space-y-2 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-5 py-3 text-sm font-bold transition-all hover:bg-white/40",
              location.pathname === item.path 
                ? "bg-white text-primary-foreground shadow-md scale-[1.02]" 
                : "text-sidebar-foreground opacity-80",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        ))}
      </div>
      <div className="pt-4 border-t border-white/20">
        <p className="text-[10px] font-black text-center opacity-40 uppercase tracking-[0.3em]">Hecho con amor 🐷</p>
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
  const [userProfile, setUserProfile] = useState<any>(null);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq('id', user.id).single();
    if (!data?.first_name || !data?.avatar_url) { setForceProfileOpen(true); setIsProfileOpen(true); }
    setUserProfile(data);
  };

  useEffect(() => { fetchProfile(); }, [user, isProfileOpen]);

  const handleLogout = () => supabase.auth.signOut();
  const initials = `${userProfile?.first_name?.charAt(0) || "U"}${userProfile?.last_name?.charAt(0) || ""}`.toUpperCase();

  return (
    <div className="flex min-h-screen w-full bg-background font-quicksand">
      {isMobile ? (
        <div className="flex flex-col w-full">
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-white/80 backdrop-blur-md px-6 border-none shadow-sm">
            <div className="flex items-center gap-2">
              <img src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Logo%20App.png" className="h-8 w-8" />
              <h1 className="text-xl font-black text-primary-foreground tracking-tighter">Oinkash</h1>
            </div>
            <Button variant="ghost" onClick={() => setIsProfileOpen(true)} className="rounded-full p-0 h-10 w-10 border-2 border-primary/20">
              <Avatar className="h-full w-full"><AvatarImage src={userProfile?.avatar_url} /><AvatarFallback className="bg-primary/20">{initials}</AvatarFallback></Avatar>
            </Button>
          </header>
          <main className="flex-1 p-4 pb-24 overflow-x-hidden"><Outlet /></main>
          <MobileNavbar />
        </div>
      ) : (
        <PanelGroup direction="horizontal" className="w-full">
          <Panel defaultSize={18} minSize={15} maxSize={25} className="bg-sidebar border-none shadow-2xl"><Sidebar /></Panel>
          <PanelResizeHandle className="w-0" />
          <Panel defaultSize={82}>
            <div className="flex flex-col h-full bg-background">
              <header className="flex h-16 items-center justify-end px-10 gap-4">
                <Button variant="ghost" onClick={() => setIsProfileOpen(true)} className="rounded-full p-0 h-10 w-10 border-2 border-primary/20 shadow-sm hover:scale-105 transition-transform">
                  <Avatar className="h-full w-full"><AvatarImage src={userProfile?.avatar_url} /><AvatarFallback>{initials}</AvatarFallback></Avatar>
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full bg-white shadow-sm h-10 w-10 text-rose-400 hover:text-rose-600"><LogOut className="h-5 w-5" /></Button>
              </header>
              <main className="flex-1 overflow-y-auto p-10 max-w-7xl mx-auto w-full"><Outlet /></main>
            </div>
          </Panel>
        </PanelGroup>
      )}
      <AIChatAssistant />
      <ProfileDialog isOpen={isProfileOpen} onClose={() => { setIsProfileOpen(false); fetchProfile(); }} forceOpen={forceProfileOpen} />
    </div>
  );
};

export default Layout;