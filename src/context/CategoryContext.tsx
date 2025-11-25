"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import LoadingSpinner from '@/components/LoadingSpinner'; // Importar LoadingSpinner

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string; // Añadido el campo icon
  user_id?: string;
}

interface CategoryContextType {
  incomeCategories: Category[];
  expenseCategories: Category[];
  addCategory: (category: Omit<Category, "id" | "user_id">, type: "income" | "expense") => Promise<void>;
  updateCategory: (category: Category, type: "income" | "expense") => Promise<void>;
  deleteCategory: (id: string, type: "income" | "expense") => Promise<void>; // Añadido
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
    if (!user) {
      setIncomeCategories([]);
      setExpenseCategories([]);
      setIsLoadingCategories(false);
      return;
    }

    setIsLoadingCategories(true);
    const { data: incomeData, error: incomeError } = await supabase
      .from('income_categories')
      .select('*')
      .eq('user_id', user.id);

    const { data: expenseData, error: expenseError } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('user_id', user.id);

    if (incomeError) {
      showError('Error al cargar categorías de ingresos: ' + incomeError.message);
    } else {
      setIncomeCategories(incomeData || []);
    }

    if (expenseError) {
      showError('Error al cargar categorías de egresos: ' + expenseError.message);
    } else {
      setExpenseCategories(expenseData || []);
    }
    setIsLoadingCategories(false);
  };

  useEffect(() => {
    fetchCategories();
  }, [user]);

  const addCategory = async (category: Omit<Category, "id" | "user_id">, type: "income" | "expense") => {
    if (!user) {
      showError("Debes iniciar sesión para añadir categorías.");
      return;
    }

    const tableName = type === "income" ? "income_categories" : "expense_categories";
    const { data, error } = await supabase
      .from(tableName)
      .insert({ ...category, user_id: user.id })
      .select();

    if (error) {
      showError('Error al añadir categoría: ' + error.message);
    } else {
      if (type === "income") {
        setIncomeCategories((prev) => [...prev, data[0]]);
      } else {
        setExpenseCategories((prev) => [...prev, data[0]]);
      }
      showSuccess("Categoría añadida exitosamente.");
    }
  };

  const updateCategory = async (updatedCategory: Category, type: "income" | "expense") => {
    if (!user) {
      showError("Debes iniciar sesión para actualizar categorías.");
      return;
    }

    const tableName = type === "income" ? "income_categories" : "expense_categories";
    const { data, error } = await supabase
      .from(tableName)
      .update({ name: updatedCategory.name, color: updatedCategory.color, icon: updatedCategory.icon }) // Actualizado para incluir icon
      .eq('id', updatedCategory.id)
      .eq('user_id', user.id)
      .select();

    if (error) {
      showError('Error al actualizar categoría: ' + error.message);
    } else {
      if (type === "income") {
        setIncomeCategories((prev) =>
          prev.map((cat) => (cat.id === updatedCategory.id ? data[0] : cat))
        );
      } else {
        setExpenseCategories((prev) =>
          prev.map((cat) => (cat.id === updatedCategory.id ? data[0] : cat))
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
        setIncomeCategories((prev) => prev.filter((cat) => cat.id !== id));
      } else {
        setExpenseCategories((prev) => prev.filter((cat) => cat.id !== id));
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
        deleteCategory, // Añadido
        getCategoryById,
        isLoadingCategories,
      }}
    >
      {isLoadingCategories && <LoadingSpinner />} {/* Mostrar spinner si está cargando */}
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