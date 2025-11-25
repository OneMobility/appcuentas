"use client";

import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const colors = [
  "#FFADAD", "#FFD6A5", "#FDFFB6", "#CAFFBF", "#9BF6FF", "#A0C4FF", "#BDB2FF", "#FFC6FF", "#FFFFFC", "#E0BBE4",
  "#957DAD", "#D291BC", "#FFC72C", "#A7D9B1", "#FF6B6B", "#8D99AE", "#C7E9B0", "#FFD700", "#B0E0E6", "#ADD8E6",
  "#87CEEB", "#6495ED", "#4682B4", "#5F9EA0", "#F08080", "#FFB6C1", "#FFDAB9", "#E6E6FA", "#DDA0DD", "#BA55D3"
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