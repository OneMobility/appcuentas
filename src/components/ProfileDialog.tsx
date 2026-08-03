"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, User, KeyRound, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  forceOpen?: boolean;
}

// Generar las URLs de los 16 avatares predefinidos usando el ID del bucket 'avatar' (en minúsculas)
const AVATARS = Array.from({ length: 16 }, (_, i) => {
  const id = i + 1;
  return `https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/avatar/${id}.png`;
});

const ProfileDialog: React.FC<ProfileDialogProps> = ({ isOpen, onClose, forceOpen = false }) => {
  const { user } = useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("first_name, last_name, avatar_url")
          .eq("id", user.id)
          .single();

        if (!error && data) {
          setFirstName(data.first_name || "");
          setLastName(data.last_name || "");
          setSelectedAvatar(data.avatar_url || "");
        } else {
          setFirstName(user.user_metadata?.first_name || "");
          setLastName(user.user_metadata?.last_name || "");
          setSelectedAvatar("");
        }
      };
      fetchProfile();
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [isOpen, user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!firstName.trim() || !lastName.trim()) {
      showError("Por favor, ingresa tu nombre y apellido.");
      return;
    }

    if (!selectedAvatar) {
      showError("Por favor, selecciona un avatar para tu perfil.");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      showError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      showError("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Actualizar tabla pública de perfiles
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          avatar_url: selectedAvatar,
          updated_at: new Date().toISOString(),
        });

      if (profileError) throw profileError;

      // 2. Actualizar metadatos de usuario en Auth
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        }
      });

      if (metadataError) throw metadataError;

      // 3. Actualizar contraseña si se ingresó una nueva
      if (newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (passwordError) throw passwordError;
      }

      showSuccess("¡Perfil completado con éxito!");
      onClose();
    } catch (error: any) {
      showError("Error al actualizar el perfil: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "U";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!forceOpen) onClose();
    }}>
      <DialogContent className="w-[95vw] max-w-[450px] rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> 
            {forceOpen ? "¡Completa tu Perfil!" : "Mi Perfil"}
          </DialogTitle>
          <DialogDescription>
            {forceOpen 
              ? "¡Te damos la bienvenida a Oinkash! Por favor, ingresa tus datos y elige un avatar para comenzar."
              : "Actualiza tu información personal, elige tu avatar o cambia tu contraseña."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 py-2">
          
          {/* Vista previa del Avatar seleccionado */}
          <div className="flex flex-col items-center justify-center gap-2 pb-2">
            <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-md">
              <AvatarImage src={selectedAvatar} alt="Avatar" />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">{user?.email}</span>
          </div>

          {/* Selector de 16 Avatares */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Elige tu Avatar</Label>
            <div className="grid grid-cols-4 gap-2 p-2 bg-muted/30 rounded-2xl border">
              {AVATARS.map((url, index) => {
                const isSelected = selectedAvatar === url;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedAvatar(url)}
                    className={cn(
                      "relative rounded-full overflow-hidden aspect-square border-2 transition-all hover:scale-105 active:scale-95",
                      isSelected ? "border-primary ring-2 ring-primary/20 scale-105" : "border-transparent hover:border-muted-foreground/30"
                    )}
                  >
                    <img src={url} alt={`Avatar ${index + 1}`} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="bg-primary text-primary-foreground rounded-full p-0.5">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campos de Nombre y Apellido */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="firstName">Nombre</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="rounded-xl h-10"
                placeholder="Tu nombre"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lastName">Apellido</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="rounded-xl h-10"
                placeholder="Tu apellido"
                required
              />
            </div>
          </div>

          {/* Cambiar contraseña (solo visible si no es obligatorio completar perfil) */}
          {!forceOpen && (
            <div className="border-t pt-3 space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <KeyRound className="h-3.5 w-3.5" /> Cambiar Contraseña (Opcional)
              </h4>
              <div className="grid gap-1.5">
                <Label htmlFor="newPassword">Nueva Contraseña</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="rounded-xl h-10"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="rounded-xl h-10"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            {!forceOpen && (
              <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
                Cancelar
              </Button>
            )}
            <Button type="submit" className="rounded-xl font-bold w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                forceOpen ? "Comenzar a usar Oinkash" : "Guardar Cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;