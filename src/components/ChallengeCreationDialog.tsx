"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCategoryContext, Category } from "@/context/CategoryContext";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { addDays, format } from "date-fns";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

interface ChallengeTemplate {
  id: string;
  name: string;
  description: string;
  type: "no_spend_category"; // For now, only this type
  icon: keyof typeof LucideIcons; // Use keyof typeof LucideIcons for icon names
}

const challengeTemplates: ChallengeTemplate[] = [
  {
    id: "no-spend-food",
    name: "Reto: Cero Gastos en Comida Fuera",
    description: "Evita gastar en restaurantes, comida rápida y bebidas por 7 días.",
    type: "no_spend_category",
    icon: "Utensils",
  },
  {
    id: "no-impulse-buy",
    name: "Reto: Sin Compras Impulsivas",
    description: "No realices compras en categorías de ocio, ropa o gadgets por 7 días.",
    type: "no_spend_category",
    icon: "ShoppingBag",
  },
  {
    id: "no-entertainment",
    name: "Reto: Cero Entretenimiento Pagado",
    description: "Evita gastos en cine, conciertos, bares o suscripciones de entretenimiento por 7 días.",
    type: "no_spend_category",
    icon: "Tv",
  },
];

interface ChallengeCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onChallengeStarted: () => void;
}

const ChallengeCreationDialog: React.FC<ChallengeCreationDialogProps> = ({ isOpen, onClose, onChallengeStarted }) => {
  const { user } = useSession();
  const { expenseCategories, isLoadingCategories } = useCategoryContext();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedTemplateId(null);
      setSelectedCategories([]);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const selectedTemplate = selectedTemplateId
    ? challengeTemplates.find((t) => t.id === selectedTemplateId)
    : null;

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const handleStartChallenge = async () => {
    if (!user) {
      showError("Debes iniciar sesión para empezar un reto.");
      return;
    }
    if (!selectedTemplate) {
      showError("Por favor, selecciona un tipo de reto.");
      return;
    }
    if (selectedTemplate.type === "no_spend_category" && selectedCategories.length === 0) {
      showError("Por favor, selecciona al menos una categoría para el reto.");
      return;
    }

    setIsSubmitting(true);

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = addDays(startDate, 7); // Reto dura 7 días

    try {
      // Check if user already has an active challenge
      const { data: activeChallenges, error: activeChallengeError } = await supabase
        .from('challenges')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (activeChallengeError) throw activeChallengeError;

      if (activeChallenges && activeChallenges.length > 0) {
        showError("Ya tienes un reto activo. Completa o falla el actual antes de empezar uno nuevo.");
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.from('challenges').insert({
        user_id: user.id,
        challenge_template_id: selectedTemplate.id,
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        status: "active",
        forbidden_category_ids: selectedCategories,
      });

      if (error) {
        throw error;
      }

      showSuccess("¡Reto iniciado exitosamente! ¡Mucha suerte!");
      onChallengeStarted();
      onClose();
    } catch (error: any) {
      showError("Error al iniciar el reto: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryName = (id: string) => {
    return expenseCategories.find(cat => cat.id === id)?.name || "Categoría desconocida";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Empezar un Nuevo Reto</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="challenge-template">Selecciona un Reto</Label>
            <Select value={selectedTemplateId || ""} onValueChange={setSelectedTemplateId}>
              <SelectTrigger id="challenge-template">
                <SelectValue placeholder="Elige un desafío" />
              </SelectTrigger>
              <SelectContent>
                {challengeTemplates.map((template) => {
                  const IconComponent = LucideIcons[template.icon];
                  return (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        {IconComponent && <IconComponent className="h-4 w-4" />}
                        {template.name}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <p className="text-sm text-muted-foreground mt-1">{selectedTemplate.description}</p>
            )}
          </div>

          {selectedTemplate && selectedTemplate.type === "no_spend_category" && (
            <div className="grid gap-2">
              <Label>Categorías a Evitar (Egresos)</Label>
              {isLoadingCategories ? (
                <p className="text-sm text-muted-foreground">Cargando categorías...</p>
              ) : expenseCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tienes categorías de egresos. Crea algunas primero.</p>
              ) : (
                <ScrollArea className="h-[150px] rounded-md border p-4">
                  {expenseCategories.map((category) => (
                    <div key={category.id} className="flex items-center space-x-2 mb-2">
                      <Checkbox
                        id={`category-${category.id}`}
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={() => handleCategoryToggle(category.id)}
                      />
                      <label
                        htmlFor={`category-${category.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                          {category.name}
                        </div>
                      </label>
                    </div>
                  ))}
                </ScrollArea>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Cancelar
          </Button>
          <Button onClick={handleStartChallenge} disabled={!selectedTemplate || isSubmitting}>
            {isSubmitting ? "Iniciando..." : "Empezar Reto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChallengeCreationDialog;