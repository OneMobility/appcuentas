"use client";

import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Image as ImageIcon } from "lucide-react";

// URLs de imágenes de ejemplo de tu bucket de Supabase
const defaultImageUrls = [
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_food.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_transport.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_home.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_shopping.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_salary.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_education.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_health.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_entertainment.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_utilities.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_pets.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_travel.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_gifts.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_car.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_coffee.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_tag.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_banknote.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_creditcard.png",
  "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/icon_piggybank.png",
  // Puedes añadir más URLs de imágenes aquí
];

interface ImagePickerProps {
  selectedImage: string | null;
  onSelectImage: (imageUrl: string) => void;
  availableImages?: string[]; // Opcional: permite pasar una lista personalizada de imágenes
}

const ImagePicker: React.FC<ImagePickerProps> = ({ selectedImage, onSelectImage, availableImages = defaultImageUrls }) => {
  const [search, setSearch] = useState("");

  const filteredImages = useMemo(() => {
    return availableImages.filter(url =>
      url.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, availableImages]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          {selectedImage ? (
            <img src={selectedImage} alt="Selected" className="mr-2 h-6 w-6 object-contain" />
          ) : (
            <ImageIcon className="mr-2 h-4 w-4" />
          )}
          {selectedImage ? (selectedImage.includes('/') ? selectedImage.split('/').pop() : selectedImage) : "Seleccionar Imagen"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Input
          placeholder="Buscar URL de imagen..."
          className="mb-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ScrollArea className="h-[200px]">
          <div className="grid grid-cols-3 gap-2 p-2">
            {filteredImages.map((imageUrl) => (
              <Button
                key={imageUrl}
                variant="ghost"
                size="icon"
                onClick={() => onSelectImage(imageUrl)}
                className={cn(
                  "h-16 w-16 p-1 border-2",
                  selectedImage === imageUrl ? "border-primary" : "border-transparent"
                )}
              >
                <img src={imageUrl} alt="Thumbnail" className="h-full w-full object-contain" />
              </Button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default ImagePicker;