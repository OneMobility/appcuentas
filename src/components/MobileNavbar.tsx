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
  LogOut, // Importar el icono de LogOut
} from "lucide-react";
import { useSession } from "@/context/SessionContext"; // Importar useSession
import { supabase } from "@/integrations/supabase/client"; // Importar supabase
import { Button } from "@/components/ui/button"; // Importar Button

const navItems = [
  {
    name: "Resumen",
    path: "/dashboard",
    icon: Home,
  },
  {
    name: "Tu Dinerito",
    path: "/cash",
    icon: Banknote,
  },
  {
    name: "Te Deben",
    path: "/debtors",
    icon: UserRound,
  },
  {
  name: "Le Debes",
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
  const { user } = useSession(); // Usar useSession para el usuario

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

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
                  ? "text-pink-800 bg-pink-200 rounded-md scale-110" // Rosa pastel y más grande
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
        {user && ( // Mostrar el botón de cerrar sesión solo si hay un usuario logueado
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-1 px-2 py-1 text-xs font-medium transition-all duration-200 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/20"
          >
            <LogOut className="h-5 w-5" />
            Cerrar Sesión
          </Button>
        )}
      </div>
    </nav>
  );
};

export default MobileNavbar;