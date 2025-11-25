"use client";

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home,
  Banknote,
  UserRound,
  Landmark,
  CreditCard,
  Tag,
} from "lucide-react";

const navItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: Home,
  },
  {
    name: "Efectivo",
    path: "/cash",
    icon: Banknote,
  },
  {
    name: "Deudores",
    path: "/debtors",
    icon: UserRound,
  },
  {
    name: "Acreedores",
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

const MobileNavbar = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t shadow-lg md:hidden">
      <div className="flex h-16 items-center justify-start overflow-x-auto flex-nowrap px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-2 py-1 text-xs font-medium transition-all duration-200 shrink-0",
                isActive
                  ? "text-primary bg-primary/20 rounded-md scale-105" // Resaltado pastel y zoom
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavbar;