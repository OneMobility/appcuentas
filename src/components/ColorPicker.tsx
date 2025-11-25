"use client";

import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const colors = [
  "#EF4444", // red-500
  "#F97316", // orange-500
  "#F59E0B", // amber-500
  "#EAB308", // yellow-500
  "#84CC16", // lime-500
  "#22C55E", // green-500
  "#10B981", // emerald-500
  "#06B6D4", // cyan-500
  "#0EA5E9", // sky-500
  "#3B82F6", // blue-500
  "#6366F1", // indigo-500
  "#A855F7", // purple-500
  "#D946EF", // fuchsia-500
  "#EC4899", // pink-500
  "#78716C", // stone-500
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
      <PopoverContent className="w-[200px] p-2">
        <div className="grid grid-cols-5 gap-2">
          {colors.map((color) => (
            <div
              key={color}
              className={cn(
                "h-6 w-6 rounded-full cursor-pointer border-2 border-transparent",
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