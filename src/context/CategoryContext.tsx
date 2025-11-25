"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import LoadingSpinner from '@/components/LoadingSpinner';

export interface Category {
  id: string;
  name: string;
  color: string;
  user_id?: string | null; // Ahora puede ser nulo para categorías fijas
  is_fixed?: boolean; // Nuevo campo para identificar categorías fijas
  icon?: string; // Nuevo campo para el icono
}

interface CategoryContextType {
  incomeCategories: Category[];
  expenseCategories: Category[];
  addCategory: (category: Omit<Category, "id" | "user_id" | "is_fixed">, type: "income" | "expense") => Promise<void>;
  updateCategory: (category: Category, type: "income" | "expense") => Promise<void>;
  deleteCategory: (id: string, type: "income" | "expense") => Promise<void>;
  getCategoryById: (id: string, type: "income" | "expense") => Category | undefined;
  isLoadingCategories: boolean;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

// Predefined fixed categories
const predefinedFixedExpenseCategories: Omit<Category, "id" | "user_id">[] = [
  { name: "Renta", color: "#FFADAD", is_fixed: true, icon: "Home" },
  { name: "Agua", color: "#FFD6A5", is_fixed: true, icon: "Droplet" },
  { name: "Luz", color: "#FDFFB6", is_fixed: true, icon: "Lightbulb" },
  { name: "Gas", color: "#CAFFBF", is_fixed: true, icon: "Flame" },
  { name: "Mantenimiento", color: "#9BF6FF", is_fixed: true, icon: "Wrench" },
  { name: "Internet", color: "#A0C4FF", is_fixed: true, icon: "Wifi" },
  { name: "Limpieza", color: "#BDB2FF", is_fixed: true, icon: "Broom" },
  { name: "Ropa", color: "#FFC6FF", is_fixed: true, icon: "Shirt" },
  { name: "Super mercado", color: "#FFFFFC", is_fixed: true, icon: "ShoppingCart" },
  { name: "Antojitos", color: "#E0BBE4", is_fixed: true, icon: "IceCream" },
  { name: "Apps", color: "#957DAD", is_fixed: true, icon: "Smartphone" },
  { name: "Streaming", color: "#D291BC", is_fixed: true, icon: "Tv" },
  { name: "Transporte", color: "#FFC72C", is_fixed: true, icon: "Car" },
  { name: "Hospedaje", color: "#A7D9B1", is_fixed: true, icon: "Hotel" },
  { name: "Emergencias", color: "#FF6B6B", is_fixed: true, icon: "Siren" },
  { name: "Cine", color: "#8D99AE", is_fixed: true, icon: "Film" },
  { name: "Mascota", color: "#C7E9B0", is_fixed: true, icon: "PawPrint" },
  { name: "Educacion", color: "#FFD700", is_fixed: true, icon: "BookOpen" },
];

const predefinedFixedIncomeCategories: Omit<Category, "id" | "user_id">[] = [
  { name: "Sueldos", color: "#B0E0E6", is_fixed: true, icon: "Wallet" },
  { name: "Bonos", color: "#ADD8E6", is_fixed: true, icon: "Gift" },
  { name: "Freelance", color: "#87CEEB", is_fixed: true, icon: "Briefcase" },
  { name: "Ventas", color: "#6495ED", is_fixed: true, icon: "DollarSign" },
  { name: "Reembolso", color: "#4682B4", is_fixed: true, icon: "Receipt" },
  { name: "Rendimientos", color: "#5F9EA0", is_fixed: true, icon: "TrendingUp" },
];


export const CategoryProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useSession();
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    
    // Fetch existing fixed categories (user_id is NULL)
    const { data: existingFixedIncomeData, error: fixedIncomeError } = await supabase
      .from('income_categories')
      .select('*')
      .is('user_id', null);

    const { data: existingFixedExpenseData, error: fixedExpenseError } = await supabase
      .from('expense_categories')
      .select('*')
      .is('user_id', null);

    if (fixedIncomeError || fixedExpenseError) {
      showError('Error al cargar categorías fijas existentes: ' + (fixedIncomeError?.message || fixedExpenseError?.message));
    }

    const existingFixedIncomeMap = new Map(existingFixedIncomeData?.map(cat => [cat.name, cat.id]));
    const existingFixedExpenseMap = new Map(existingFixedExpenseData?.map(cat => [cat.name, cat.id]));

    // Insert missing predefined fixed income categories
    for (const predefined of predefinedFixedIncomeCategories) {
      if (!existingFixedIncomeMap.has(predefined.name)) {
        const { error: insertError } = await supabase
          .from('income_categories')
          .insert({ ...predefined, user_id: null });
        if (insertError) {
          console.error("Error inserting fixed income category:", predefined.name, insertError);
        }
      }
    }

    // Insert missing predefined fixed expense categories
    for (const predefined of predefinedFixedExpenseCategories) {
      if (!existingFixedExpenseMap.has(predefined.name)) {
        const { error: insertError } = await supabase
          .from('expense_categories')
          .insert({ ...predefined, user_id: null });
        if (insertError) {
          console.error("Error inserting fixed expense category:", predefined.name, insertError);
        }
      }
    }

    // Re-fetch all fixed categories after potential insertions
    const { data: updatedFixedIncomeData, error: updatedFixedIncomeError } = await supabase
      .from('income_categories')
      .select('*')
      .is('user_id', null);

    const { data: updatedFixedExpenseData, error: updatedFixedExpenseError } = await supabase
      .from('expense_categories')
      .select('*')
      .is('user_id', null);

    if (updatedFixedIncomeError || updatedFixedExpenseError) {
      showError('Error al recargar categorías fijas: ' + (updatedFixedIncomeError?.message || updatedFixedExpenseError?.message));
    }

    let allIncomeCategories: Category[] = updatedFixedIncomeData || [];
    let allExpenseCategories: Category[] = updatedFixedExpenseData || [];

    if (user) {
      // Fetch user-specific categories
      const { data: userDataIncome, error: userIncomeError } = await supabase
        .from('income_categories')
        .select('*')
        .eq('user_id', user.id);

      const { data: userDataExpense, error: userExpenseError } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('user_id', user.id);

      if (userIncomeError) {
        showError('Error al cargar categorías de ingresos del usuario: ' + userIncomeError.message);
      } else {
        allIncomeCategories = [...allIncomeCategories, ...(userDataIncome || [])];
      }

      if (userExpenseError) {
        showError('Error al cargar categorías de egresos del usuario: ' + userExpenseError.message);
      } else {
        allExpenseCategories = [...allExpenseCategories, ...(userDataExpense || [])];
      }
    }

    // Sort categories by name
    allIncomeCategories.sort((a, b) => a.name.localeCompare(b.name));
    allExpenseCategories.sort((a, b) => a.name.localeCompare(b.name));

    setIncomeCategories(allIncomeCategories);
    setExpenseCategories(allExpenseCategories);
    setIsLoadingCategories(false);
  };

  useEffect(() => {
    fetchCategories();
  }, [user]);

  const addCategory = async (category: Omit<Category, "id" | "user_id" | "is_fixed">, type: "income" | "expense") => {
    if (!user) {
      showError("Debes iniciar sesión para añadir categorías.");
      return;
    }

    const tableName = type === "income" ? "income_categories" : "expense_categories";
    const { data, error } = await supabase
      .from(tableName)
      .insert({ ...category, user_id: user.id, is_fixed: false }) // Las categorías añadidas por el usuario no son fijas
      .select();

    if (error) {
      showError('Error al añadir categoría: ' + error.message);
    } else {
      if (type === "income") {
        setIncomeCategories((prev) => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        setExpenseCategories((prev) => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
      }
      showSuccess("Categoría añadida exitosamente.");
    }
  };

  const updateCategory = async (updatedCategory: Category, type: "income" | "expense") => {
    if (!user) {
      showError("Debes iniciar sesión para actualizar categorías.");
      return;
    }
    if (updatedCategory.is_fixed) {
      showError("No puedes editar categorías fijas.");
      return;
    }

    const tableName = type === "income" ? "income_categories" : "expense_categories";
    const { data, error } = await supabase
      .from(tableName)
      .update({ name: updatedCategory.name, color: updatedCategory.color, icon: updatedCategory.icon })
      .eq('id', updatedCategory.id)
      .eq('user_id', user.id)
      .select();

    if (error) {
      showError('Error al actualizar categoría: ' + error.message);
    } else {
      if (type === "income") {
        setIncomeCategories((prev) =>
          prev.map((cat) => (cat.id === updatedCategory.id ? data[0] : cat)).sort((a, b) => a.name.localeCompare(b.name))
        );
      } else {
        setExpenseCategories((prev) =>
          prev.map((cat) => (cat.id === updatedCategory.id ? data[0] : cat)).sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      showSuccess("Categoría actualizada exitosamente.");
    }
  };

  const deleteCategory = async (id: string, type: "income" | "expense") => {
    if (!user) {
      showError("Debes iniciar sesión para eliminar categorías.");
      return;
    }

    const categoryToDelete = (type === "income" ? incomeCategories : expenseCategories).find(cat => cat.id === id);
    if (categoryToDelete?.is_fixed) {
      showError("No puedes eliminar categorías fijas.");
      return;
    }

    const tableName = type === "income" ? "income_categories" : "expense_categories";
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      showError('Error al eliminar categoría: ' + error.message);
    } else {
      if (type === "income") {
        setIncomeCategories((prev) => prev.filter((cat) => cat.id !== id).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        setExpenseCategories((prev) => prev.filter((cat) => cat.id !== id).sort((a, b) => a.name.localeCompare(b.name)));
      }
      showSuccess("Categoría eliminada exitosamente.");
    }
  };

  const getCategoryById = (id: string, type: "income" | "expense") => {
    if (type === "income") {
      return incomeCategories.find(cat => cat.id === id);
    } else {
      return expenseCategories.find(cat => cat.id === id);
    }
  };

  return (
    <CategoryContext.Provider
      value={{
        incomeCategories,
        expenseCategories,
        addCategory,
        updateCategory,
        deleteCategory,
        getCategoryById,
        isLoadingCategories,
      }}
    >
      {isLoadingCategories && <LoadingSpinner />}
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategoryContext = () => {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error("useCategoryContext must be used within a CategoryProvider");
  }
  return context;
};