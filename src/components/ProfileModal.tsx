"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Generate the 16 avatar URLs from the 'Avatar' bucket
const AVATARS = Array.from({ length: 16 }, (_, i) => {
  const id = i + 1;
  return {
    id,
    url: `https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Avatar/${id}.png`,
  };
});

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, refreshProfile } = useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setSelectedAvatar(profile.avatar_url || null);
    }
  }, [isOpen, profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!firstName.trim()) {
      showError("El nombre es obligatorio.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          avatar_url: selectedAvatar,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Also update user metadata so it stays in sync
      await supabase.auth.updateUser({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
        }
      });

      await refreshProfile();
      showSuccess("Perfil actualizado exitosamente.");
      onClose();
    } catch (error: any) {
      showError("Error al actualizar el perfil: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-[450px] rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">Completa tu Perfil</DialogTitle>
          <DialogDescription className="text-center">
            Personaliza tu nombre y elige uno de los 16 avatares disponibles.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-6 py-4">
          {/* Avatar Selector */}
          <div className="space-y-3">
            <Label className="text-sm font-bold text-center block">Elige tu Avatar</Label>
            <div className="grid grid-cols-4 gap-3 max-h-[200px] overflow-y-auto p-2 border rounded-2xl bg-muted/30">
              {AVATARS.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setSelectedAvatar(avatar.url)}
                  className={cn(
                    "relative rounded-full overflow-hidden aspect-square border-4 transition-all hover:scale-105",
                    selectedAvatar === avatar.url
                      ? "border-primary scale-105 shadow-md"
                      : "border-transparent opacity-70 hover:opacity-100"
                  )}
                >
                  <img
                    src={avatar.url}
                    alt={`Avatar ${avatar.id}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Name Fields */}
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="firstName">Nombre</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Tu nombre"
                required
                className="rounded-xl h-10"
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lastName">Apellido (Opcional)</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Tu apellido"
                className="rounded-xl h-10"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full rounded-xl h-11 font-bold" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileModal;