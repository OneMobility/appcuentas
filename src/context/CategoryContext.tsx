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

export const CategoryProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useSession();
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    
    // Fetch fixed categories (user_id is NULL)
    const { data: fixedIncomeData, error: fixedIncomeError } = await supabase
      .from('income_categories')
      .select('*')
      .is('user_id', null);

    const { data: fixedExpenseData, error: fixedExpenseError } = await supabase
      .from('expense_categories')
      .select('*')
      .is('user_id', null);

    if (fixedIncomeError || fixedExpenseError) {
      showError('Error al cargar categorías fijas: ' + (fixedIncomeError?.message || fixedExpenseError?.message));
    }

    let allIncomeCategories: Category[] = fixedIncomeData || [];
    let allExpenseCategories: Category[] = fixedExpenseData || [];

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