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
import { Input } from "@/components/ui/input"; // Importar Input
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Importar Popover
import { CalendarIcon } from "lucide-react"; // Importar CalendarIcon
import { Calendar } from "@/components/ui/calendar"; // Importar Calendar
import ColorPicker from "@/components/ColorPicker"; // Importar ColorPicker

interface ChallengeTemplate {
  id: string;
  name: string;
  description: string;
  type: "no_spend_category" | "saving_goal";
  icon: keyof typeof LucideIcons;
  default_categories?: string[]; // Para retos de no gasto
}

const challengeTemplates: ChallengeTemplate[] = [
  {
    id: "no-spend-food",
    name: "Reto: Cero Gastos en Antojitos",
    description: "Evita gastar en comida fuera, snacks y bebidas por 7 días.",
    type: "no_spend_category",
    icon: "IceCream",
    default_categories: ["Antojitos"], // Usar nombres para buscar IDs
  },
  {
    id: "no-spend-apps",
    name: "Reto: Cero Gastos en Apps/Suscripciones",
    description: "No realices compras en aplicaciones o nuevas suscripciones por 7 días.",
    type: "no_spend_category",
    icon: "Smartphone",
    default_categories: ["Apps", "Streaming"],
  },
  {
    id: "no-spend-entertainment",
    name: "Reto: Cero Gastos en Entretenimiento",
    description: "Evita gastos en cine, conciertos, bares o eventos por 7 días.",
    type: "no_spend_category",
    icon: "Film",
    default_categories: ["Cine"],
  },
  {
    id: "no-spend-clothing",
    name: "Reto: Cero Gastos en Ropa",
    description: "No compres ropa, accesorios o calzado por 7 días.",
    type: "no_spend_category",
    icon: "Shirt",
    default_categories: ["Ropa"],
  },
  {
    id: "saving-goal-100",
    name: "Reto: Ahorra $100 en 7 días",
    description: "Intenta ahorrar $100 en una nueva meta durante la semana.",
    type: "saving_goal",
    icon: "PiggyBank",
  },
  {
    id: "saving-goal-200",
    name: "Reto: Ahorra $200 en 7 días",
    description: "Intenta ahorrar $200 en una nueva meta durante la semana.",
    type: "saving_goal",
    icon: "PiggyBank",
  },
];

interface ChallengeCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onChallengeStarted: () => void;
}

const ChallengeCreationDialog: React.FC<ChallengeCreationDialogProps> = ({ isOpen, onClose, onChallengeStarted }) => {
  const { user } = useSession();
  const { expenseCategories, incomeCategories, isLoadingCategories } = useCategoryContext();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [savingGoalDetails, setSavingGoalDetails] = useState({
    name: "",
    target_amount: "",
    color: "#22C55E",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedTemplateId(null);
      setSelectedCategories([]);
      setSavingGoalDetails({ name: "", target_amount: "", color: "#22C55E" });
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const selectedTemplate = selectedTemplateId
    ? challengeTemplates.find((t) => t.id === selectedTemplateId)
    : null;

  // Filter fixed expense categories for "no_spend_category" challenges
  const fixedExpenseCategories = expenseCategories.filter(cat => cat.is_fixed);

  useEffect(() => {
    if (selectedTemplate && selectedTemplate.type === "no_spend_category" && selectedTemplate.default_categories) {
      const defaultCategoryIds = fixedExpenseCategories
        .filter(cat => selectedTemplate.default_categories?.includes(cat.name))
        .map(cat => cat.id);
      setSelectedCategories(defaultCategoryIds);
    } else if (selectedTemplate && selectedTemplate.type === "saving_goal") {
      // Set default saving goal details based on template
      if (selectedTemplate.id === "saving-goal-100") {
        setSavingGoalDetails(prev => ({ ...prev, name: "Reto de Ahorro $100", target_amount: "100" }));
      } else if (selectedTemplate.id === "saving-goal-200") {
        setSavingGoalDetails(prev => ({ ...prev, name: "Reto de Ahorro $200", target_amount: "200" }));
      }
    }
  }, [selectedTemplate, fixedExpenseCategories]);

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const handleSavingGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSavingGoalDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handleSavingGoalColorSelect = (color: string) => {
    setSavingGoalDetails((prev) => ({ ...prev, color }));
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

      let challengeData: any = {
        user_id: user.id,
        challenge_template_id: selectedTemplate.id,
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        status: "active",
      };

      if (selectedTemplate.type === "no_spend_category") {
        if (selectedCategories.length === 0) {
          showError("Por favor, selecciona al menos una categoría para el reto de cero gastos.");
          setIsSubmitting(false);
          return;
        }
        challengeData.forbidden_category_ids = selectedCategories;
      } else if (selectedTemplate.type === "saving_goal") {
        const targetAmount = parseFloat(savingGoalDetails.target_amount);
        if (isNaN(targetAmount) || targetAmount <= 0) {
          showError("El monto objetivo para el reto de ahorro debe ser un número positivo.");
          setIsSubmitting(false);
          return;
        }
        if (!savingGoalDetails.name.trim()) {
          showError("El nombre de la meta de ahorro no puede estar vacío.");
          setIsSubmitting(false);
          return;
        }

        // First, insert the challenge
        const { data: newChallenge, error: challengeInsertError } = await supabase
          .from('challenges')
          .insert(challengeData)
          .select()
          .single();

        if (challengeInsertError) throw challengeInsertError;

        // Then, create the linked saving goal
        const { error: savingInsertError } = await supabase
          .from('savings')
          .insert({
            user_id: user.id,
            name: savingGoalDetails.name.trim(),
            current_balance: 0, // Starts at 0 for the challenge
            target_amount: targetAmount,
            target_date: format(endDate, "yyyy-MM-dd"), // Target date is end of challenge
            color: savingGoalDetails.color,
            challenge_id: newChallenge.id, // Link to the new challenge
          })
          .select();

        if (savingInsertError) throw savingInsertError;

        showSuccess("¡Reto de ahorro iniciado exitosamente! ¡Mucha suerte!");
        onChallengeStarted();
        onClose();
        return; // Exit early as saving challenge handled
      }

      // For no_spend_category challenges, insert directly
      const { error } = await supabase.from('challenges').insert(challengeData);

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
              <Label>Categorías a Evitar (Egresos Fijos)</Label>
              {isLoadingCategories ? (
                <p className="text-sm text-muted-foreground">Cargando categorías...</p>
              ) : fixedExpenseCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay categorías de egresos fijas disponibles.</p>
              ) : (
                <ScrollArea className="h-[150px] rounded-md border p-4">
                  {fixedExpenseCategories.map((category) => (
                    <div key={category.id} className="flex items-center space-x-2 mb-2">
                      <Checkbox
                        id={`category-${category.id}`}
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={() => handleCategoryToggle(category.id)}
                        disabled={selectedTemplate.default_categories?.includes(category.name)} // Deshabilitar si es categoría por defecto
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

          {selectedTemplate && selectedTemplate.type === "saving_goal" && (
            <div className="grid gap-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="savingName" className="text-right">
                  Nombre de Meta
                </Label>
                <Input
                  id="savingName"
                  name="name"
                  value={savingGoalDetails.name}
                  onChange={handleSavingGoalChange}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="targetAmount" className="text-right">
                  Monto Objetivo
                </Label>
                <Input
                  id="targetAmount"
                  name="target_amount"
                  type="number"
                  step="0.01"
                  value={savingGoalDetails.target_amount}
                  onChange={handleSavingGoalChange}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="savingColor" className="text-right">
                  Color de Meta
                </Label>
                <div className="col-span-3">
                  <ColorPicker selectedColor={savingGoalDetails.color} onSelectColor={handleSavingGoalColorSelect} />
                </div>
              </div>
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