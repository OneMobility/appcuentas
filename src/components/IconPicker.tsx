"use client";

import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import DynamicLucideIcon from "./DynamicLucideIcon"; // Importar el nuevo componente

// La lista curada de nombres de iconos a mostrar
const curatedIconNames = [
  "Tag", "Banknote", "CreditCard", "Gift", "PiggyBank", "Car", "Plane", "Utensils", "Coffee",
  "ShoppingBag", "Lightbulb", "Wrench", "Home", "Droplet", "Flame", "Wifi", "Broom", "Shirt",
  "ShoppingCart", "IceCream", "Smartphone", "Tv", "Hotel", "Siren", "Film", "PawPrint",
  "BookOpen", "Wallet", "Briefcase", "Receipt", "TrendingUp", "DollarSign",
];

interface IconPickerProps {
  selectedIcon: string;
  onSelectIcon: (iconName: string) => void;
}

const IconPicker: React.FC<IconPickerProps> = ({ selectedIcon, onSelectIcon }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filteredIcons = useMemo(() => {
    return curatedIconNames.filter(iconName =>
      iconName.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const handleSelect = (iconName: string) => {
    onSelectIcon(iconName);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <DynamicLucideIcon iconName={selectedIcon || "Tag"} className="mr-2 h-4 w-4 text-black" />
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
            {filteredIcons.map((iconName) => (
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
                <DynamicLucideIcon iconName={iconName} className="h-4 w-4 text-black" />
              </Button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default IconPicker;