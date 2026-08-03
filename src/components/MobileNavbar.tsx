"use client";

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Banknote,
  ThumbsUp,
  ThumbsDown,
  CreditCard,
  Tag,
  Wallet,
  BarChart,
  ShoppingCart,
  CalendarDays,
  LayoutDashboard,
} from "lucide-react";

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

const MobileNavbar = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex h-16 items-center overflow-x-auto scrollbar-hide px-4 gap-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center flex-none min-w-[75px] gap-1 transition-all duration-200",
                isActive
                  ? "text-primary scale-105"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-colors",
                isActive ? "bg-primary/10" : ""
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[9px] font-bold leading-none whitespace-nowrap uppercase tracking-tighter">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavbar;