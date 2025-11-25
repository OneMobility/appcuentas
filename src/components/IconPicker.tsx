"use client";

import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

// Create a map of all Lucide icons that are actual React components
const lucideIconMap: { [key: string]: React.ElementType } = {};
for (const key in LucideIcons) {
  // Check if the property is a function (React component) and starts with an uppercase letter
  if (typeof (LucideIcons as any)[key] === 'function' && key[0] === key[0].toUpperCase()) {
    lucideIconMap[key] = (LucideIcons as any)[key];
  }
}

// Curated list of relevant icon names based on user request and fixed categories
const curatedIconNames = [
  "Tag",          // Etiqueta (default)
  "Banknote",     // Billete
  "CreditCard",   // Tarjeta
  "Gift",         // Regalo
  "PiggyBank",    // Cochinito
  "Car",          // Transporte (coche)
  "Plane",        // Transporte (avión)
  "Utensils",     // Comida
  "Coffee",       // Café (para comida/bebidas)
  "ShoppingBag",  // Ropa / Compras
  "Lightbulb",    // Servicio / Utilidades (Luz)
  "Wrench",       // Mantenimiento
  "Home",         // Casa / Alquiler (Renta)
  "Droplet",      // Agua
  "Flame",        // Gas
  "Wifi",         // Internet
  "Broom",        // Limpieza
  "Shirt",        // Ropa
  "ShoppingCart", // Super mercado
  "IceCream",     // Antojitos
  "Smartphone",   // Apps
  "Tv",           // Streaming
  "Hotel",        // Hospedaje
  "Siren",        // Emergencias
  "Film",         // Cine
  "PawPrint",     // Mascota
  "BookOpen",     // Educación
  "Wallet",       // Sueldos
  "Briefcase",    // Freelance
  "Receipt",      // Reembolso
  "TrendingUp",   // Rendimientos
  "DollarSign",   // Ventas
];

// Filter the curated list to only include icons that actually exist in lucideIconMap
const availableIcons = curatedIconNames.filter(iconName => lucideIconMap[iconName]);

interface IconPickerProps {
  selectedIcon: string;
  onSelectIcon: (iconName: string) => void;
}

const IconPicker: React.FC<IconPickerProps> = ({ selectedIcon, onSelectIcon }) => {
  const [search, setSearch] = useState("");

  const CurrentIcon = selectedIcon ? lucideIconMap[selectedIcon] : null;

  const filteredIcons = useMemo(() => {
    return availableIcons.filter(iconName =>
      iconName.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, availableIcons]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          {CurrentIcon ? <CurrentIcon className="mr-2 h-4 w-4" /> : null}
          {selectedIcon || "Seleccionar Icono"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Input
          placeholder="Buscar icono..."
          className="mb-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ScrollArea className="h-[200px]">
          <div className="grid grid-cols-4 gap-2 p-2">
            {filteredIcons.map((iconName) => {
              const IconComponent = lucideIconMap[iconName];
              if (!IconComponent) return null;

              return (
                <Button
                  key={iconName}
                  variant="ghost"
                  size="icon"
                  onClick={() => onSelectIcon(iconName)}
                  className={cn(selectedIcon === iconName && "bg-accent")}
                >
                  <IconComponent className="h-4 w-4" />
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default IconPicker;