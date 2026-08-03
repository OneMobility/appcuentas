"use client";

import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  ShoppingCart,
  User,
  Settings,
} from "lucide-react";
import MobileNavbar from "./MobileNavbar";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import ProfileModal from "./ProfileModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

const Sidebar = ({ onLogout, onOpenProfile }: { onLogout: () => void; onOpenProfile: () => void }) => {
  const location = useLocation();
  const { user, profile } = useSession();

  const displayName = profile?.first_name 
    ? `${profile.first_name} ${profile.last_name || ""}`.trim()
    : user?.email?.split("@")[0] || "Usuario";

  const initials = profile?.first_name 
    ? profile.first_name.charAt(0).toUpperCase() 
    : "U";

  return (
    <nav className="flex flex-col gap-2 p-6 h-full">
      <Link to="/dashboard" className="flex items-center gap-3 mb-8 text-sidebar-foreground">
        <img src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Logo%20App.png" alt="Oinkash Logo" className="h-10 w-10" />
        <h2 className="text-2xl font-bold tracking-tight">Oinkash</h2>
      </Link>
      <div className="flex-1 space-y-1 overflow-y-auto scrollbar-hide">
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

      {/* User Profile Section at the bottom of Sidebar */}
      {user && (
        <div className="mt-auto pt-4 border-t border-sidebar-border flex flex-col gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 p-2 rounded-xl hover:bg-sidebar-accent/30 transition-all text-left w-full">
                <Avatar className="h-10 w-10 border-2 border-sidebar-primary">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-sidebar-foreground truncate">{displayName}</p>
                  <p className="text-xs text-sidebar-foreground/70 truncate">{user.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl">
              <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onOpenProfile} className="rounded-xl cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>Editar Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive rounded-xl cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </nav>
  );
};

const Layout: React.FC = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isLoading } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const currentPageName = navItems.find(item => item.path === location.pathname)?.name || "Oinkash";

  // Automatically open ProfileModal if the user is logged in but has no profile completed
  useEffect(() => {
    if (!isLoading && user && !profile?.first_name) {
      setIsProfileOpen(true);
    }
  }, [user, profile, isLoading]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('lastVisitedRoute');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error("Error signing out:", error);
      navigate('/login', { replace: true });
    }
  };

  const displayName = profile?.first_name 
    ? `${profile.first_name} ${profile.last_name || ""}`.trim()
    : user?.email?.split("@")[0] || "Usuario";

  const initials = profile?.first_name 
    ? profile.first_name.charAt(0).toUpperCase() 
    : "U";

  return (
    <div className="flex min-h-screen w-full bg-background">
      {isMobile ? (
        <div className="flex flex-col w-full">
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-background/80 backdrop-blur-md px-4 border-b">
            <div className="flex items-center gap-2">
              <img src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Logo%20App.png" alt="Logo" className="h-8 w-8" />
              <h1 className="text-lg font-bold">{currentPageName}</h1>
            </div>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="focus:outline-none">
                    <Avatar className="h-9 w-9 border-2 border-primary">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                  <DropdownMenuLabel className="font-bold">{displayName}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsProfileOpen(true)} className="rounded-xl cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Editar Perfil</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive rounded-xl cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </header>
          <main className="flex-1 overflow-y-auto p-4 pb-24">
            <Outlet />
          </main>
          <MobileNavbar />
        </div>
      ) : (
        <PanelGroup direction="horizontal" className="w-full">
          <Panel defaultSize={20} minSize={15} maxSize={25} className="bg-sidebar text-sidebar-foreground border-r">
            <Sidebar onLogout={handleLogout} onOpenProfile={() => setIsProfileOpen(true)} />
          </Panel>
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />
          <Panel defaultSize={80}>
            <main className="h-full overflow-y-auto p-8 lg:p-12 max-w-7xl mx-auto">
              <Outlet />
            </main>
          </Panel>
        </PanelGroup>
      )}

      {/* Profile Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
};

export default Layout;