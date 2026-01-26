"use client";

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  PiggyBank,
  Banknote,
  ThumbsUp,
  ThumbsDown,
  CreditCard,
  Tag,
  LogOut,
  Wallet,
  Users,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const navItems = [
  {
    name: "Resumen",
    path: "/dashboard",
    icon: PiggyBank,
  },
  {
    name: "Lo que tienes",
    path: "/cash",
    icon: Banknote,
  },
  {
    name: "Los que te deben",
    path: "/debtors",
    icon: ThumbsUp,
  },
  {
  name: "A quien le debes",
    path: "/creditors",
    icon: ThumbsDown,
  },
  {
    name: "Tus Tarjetas",
    path: "/cards",
    icon: CreditCard,
  },
  {
    name: "Tus Metas",
    path: "/savings",
    icon: Wallet,
  },
  {
    name: "Presupuestos",
    path: "/shared-budgets",
    icon: Users,
  },
  {
    name: "Categorías",
    path: "/categories",
    icon: Tag,
  },
];

const MobileNavbar = () => {
  const location = useLocation();
  const { user } = useSession();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t shadow-lg md:hidden">
      <div className="flex h-16 items-center justify-around overflow-x-auto flex-nowrap px-1 py-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-medium transition-all duration-200 flex-shrink min-w-[60px] max-w-[80px] text-center",
                isActive
                  ? "text-primary-foreground bg-primary rounded-md scale-100"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="leading-none">{item.name}</span>
            </Link>
          );
        })}
        {user && (
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-medium transition-all duration-200 flex-shrink min-w-[60px] max-w-[80px] text-muted-foreground hover:text-destructive hover:bg-destructive/20"
          >
            <LogOut className="h-5 w-5" />
            <span className="leading-none">Salir</span>
          </Button>
        )}
      </div>
    </nav>
  );
};

export default MobileNavbar;