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
  BarChart,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { name: "Resumen", path: "/dashboard", icon: PiggyBank },
  { name: "Dinero", path: "/cash", icon: Banknote },
  { name: "Deudas", path: "/debtors", icon: ThumbsUp },
  { name: "Pagos", path: "/creditors", icon: ThumbsDown },
  { name: "Tarjetas", path: "/cards", icon: CreditCard },
];

const MobileNavbar = () => {
  const location = useLocation();
  const { user } = useSession();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 gap-1 transition-all duration-200",
                isActive
                  ? "text-primary scale-110"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-colors",
                isActive ? "bg-primary/10" : ""
              )}>
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-medium leading-none">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavbar;