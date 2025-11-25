"use client";

import React, { useState, useMemo, ComponentType } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as LucideIcons from "lucide-react"; // Importar todos los iconos como namespace
import { cn } from "@/lib/utils";

// La lista curada de nombres de iconos a mostrar
const curatedIconNames = [
  "Tag", "Banknote", "CreditCard", "Gift", "PiggyBank", "Car", "Plane", "Utensils", "Coffee",
  "ShoppingBag", "Lightbulb", "Wrench", "Home", "Droplet", "Flame", "Wifi", "Broom", "Shirt",
  "ShoppingCart", "IceCream", "Smartphone", "Tv", "Hotel", "Siren", "Film", "PawPrint",
  "BookOpen", "Wallet", "Briefcase", "Receipt", "TrendingUp", "DollarSign",
];

// Crear un mapa de estos iconos desde el namespace LucideIcons
const lucideIconMap: { [key: string]: ComponentType<any> } = {};
for (const iconName of curatedIconNames) {
  const IconComponent = (LucideIcons as any)[iconName];
  if (IconComponent && typeof IconComponent === 'function') {
    lucideIconMap[iconName] = IconComponent;
  } else {
    // Esto ayudará a depurar si algún icono de la lista curada no existe realmente
    console.warn(`Icono "${iconName}" no encontrado o no es un componente React válido en lucide-react.`);
  }
}

// Filtrar la lista curada para incluir solo los iconos que realmente existen en lucideIconMap
const availableIcons = curatedIconNames.filter(iconName => lucideIconMap[iconName]);

interface IconPickerProps {
  selectedIcon: string;
  onSelectIcon: (iconName: string) => void;
}

const IconPicker: React.FC<IconPickerProps> = ({ selectedIcon, onSelectIcon }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // Asegurar que CurrentIcon siempre sea un componente React válido, usando 'Tag' como fallback
  const CurrentIcon = selectedIcon && lucideIconMap[selectedIcon]
    ? lucideIconMap[selectedIcon]
    : lucideIconMap["Tag"] || LucideIcons.Tag; // Fallback a LucideIcons.Tag si la entrada del mapa falta

  const filteredIcons = useMemo(() => {
    return availableIcons.filter(iconName =>
      iconName.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, availableIcons]);

  const handleSelect = (iconName: string) => {
    onSelectIcon(iconName);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <CurrentIcon className="mr-2 h-4 w-4 text-black" /> {/* Añadido text-black */}
          {selectedIcon || "Seleccionar Icono"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 z-50">
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
              if (!IconComponent) {
                console.warn(`IconComponent para ${iconName} es inesperadamente indefinido en el renderizado.`);
                return null;
              }

              return (
                <Button
                  key={iconName}
                  variant="ghost"
                  size="icon"
                  onClick={() => handleSelect(iconName)}
                  className={cn(
                    selectedIcon === iconName && "bg-accent",
                    "hover:bg-muted"
                  )}
                >
                  <IconComponent className="h-4 w-4 text-black" /> {/* Añadido text-black */}
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