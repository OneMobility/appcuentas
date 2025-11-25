"use client";

import React, { useState, useMemo, ComponentType } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Explicitly import all curated icons
import {
  Tag, Banknote, CreditCard, Gift, PiggyBank, Car, Plane, Utensils, Coffee,
  ShoppingBag, Lightbulb, Wrench, Home, Droplet, Flame, Wifi, Broom, Shirt,
  ShoppingCart, IceCream, Smartphone, Tv, Hotel, Siren, Film, PawPrint,
  BookOpen, Wallet, Briefcase, Receipt, TrendingUp, DollarSign,
} from "lucide-react";

// Create a direct map of these imported icons
const lucideIconMap: { [key: string]: ComponentType<any> } = {
  Tag, Banknote, CreditCard, Gift, PiggyBank, Car, Plane, Utensils, Coffee,
  ShoppingBag, Lightbulb, Wrench, Home, Droplet, Flame, Wifi, Broom, Shirt,
  ShoppingCart, IceCream, Smartphone, Tv, Hotel, Siren, Film, PawPrint,
  BookOpen, Wallet, Briefcase, Receipt, TrendingUp, DollarSign,
};

// The list of icon names to display (now directly from the map keys)
const availableIconNames = Object.keys(lucideIconMap);

interface IconPickerProps {
  selectedIcon: string;
  onSelectIcon: (iconName: string) => void;
}

const IconPicker: React.FC<IconPickerProps> = ({ selectedIcon, onSelectIcon }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // Ensure CurrentIcon is always a valid React component
  const CurrentIcon = selectedIcon && lucideIconMap[selectedIcon]
    ? lucideIconMap[selectedIcon]
    : Tag; // Use Tag as fallback, which is now directly imported

  const filteredIcons = useMemo(() => {
    return availableIconNames.filter(iconName =>
      iconName.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, availableIconNames]);

  const handleSelect = (iconName: string) => {
    onSelectIcon(iconName);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <CurrentIcon className="mr-2 h-4 w-4" />
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
              // At this point, IconComponent should always be defined due to direct mapping
              // and availableIconNames being derived from lucideIconMap.
              // However, a defensive check doesn't hurt.
              if (!IconComponent) {
                console.error(`IconComponent for ${iconName} is unexpectedly undefined.`);
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