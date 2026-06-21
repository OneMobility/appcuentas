"use client";

import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const colors = [
  // Pasteles
  "#FFADAD", "#FFD6A5", "#FDFFB6", "#CAFFBF", "#9BF6FF", "#A0C4FF", "#BDB2FF", "#FFC6FF", "#FFFFFC", "#E0BBE4",
  "#957DAD", "#D291BC", "#FFC72C", "#A7D9B1", "#FF6B6B", "#8D99AE", "#C7E9B0", "#FFD700", "#B0E0E6", "#ADD8E6",
  "#87CEEB", "#6495ED", "#4682B4", "#5F9EA0", "#F08080", "#FFB6C1", "#FFDAB9", "#E6E6FA", "#DDA0DD", "#BA55D3",
  // Vibrantes y Oscuros Elegantes
  "#1E3A8A", "#0D9488", "#059669", "#B45309", "#B91C1C", "#6D28D9", "#4338CA", "#0F172A", "#374151", "#1E293B",
  "#BE185D", "#86198F", "#15803D", "#0369A1", "#0E7490", "#7C2D12", "#451A03", "#311042", "#111827", "#020617"
];

interface ColorPickerProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onSelectColor }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <div
            className="mr-2 h-4 w-4 rounded-full border"
            style={{ backgroundColor: selectedColor || "transparent" }}
          />
          {selectedColor || "Seleccionar Color"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-2">
        <div className="grid grid-cols-6 gap-2">
          {colors.map((color) => (
            <div
              key={color}
              className={cn(
                "h-6 w-6 rounded-full cursor-pointer border-2 border-transparent hover:scale-110 transition-transform",
                selectedColor === color && "border-primary"
              )}
              style={{ backgroundColor: color }}
              onClick={() => onSelectColor(color)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColorPicker;