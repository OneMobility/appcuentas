"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Tag } from "lucide-react";
import { showError } from "@/utils/toast";
import ColorPicker from "@/components/ColorPicker";
import { useCategoryContext, Category } from "@/context/CategoryContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import IconPicker from "@/components/IconPicker";
import * as LucideIcons from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getContrastColor } from "@/utils/color-helpers";

const Categories = () => {
  const { incomeCategories, expenseCategories, addCategory, updateCategory, deleteCategory } = useCategoryContext();
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: "",
    type: "income" as "income" | "expense",
    color: "#3B82F6",
    icon: "Tag",
  });
  const [activeTab, setActiveTab] = useState<"income" | "expense">("income");

  useEffect(() => {
    if (editingCategory) {
      setNewCategory({
        name: editingCategory.name,
        type: incomeCategories.some(c => c.id === editingCategory.id) ? "income" : "expense",
        color: editingCategory.color,
        icon: editingCategory.icon || "Tag",
      });
    } else {
      resetForm();
    }
  }, [editingCategory, incomeCategories, expenseCategories]);

  useEffect(() => {
    setNewCategory((prev) => ({ ...prev, type: activeTab }));
  }, [activeTab]);

  const resetForm = () => {
    setNewCategory({ name: "", type: activeTab, color: "#3B82F6", icon: "Tag" });
    setEditingCategory(null);
  };

  const handleOpenAddCategoryDialog = () => {
    resetForm();
    setIsCategoryDialogOpen(true);
  };

  const handleOpenEditCategoryDialog = (category: Category, type: "income" | "expense") => {
    if (category.is_fixed) {
      showError("No puedes editar categorías fijas.");
      return;
    }
    setEditingCategory(category);
    setNewCategory({
      name: category.name,
      type: type,
      color: category.color,
      icon: category.icon || "Tag",
    });
    setIsCategoryDialogOpen(true);
  };

  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name.trim()) {
      showError("El nombre de la categoría no puede estar vacío.");
      return;
    }

    if (editingCategory) {
      const updatedCategory: Category = {
        ...editingCategory,
        name: newCategory.name.trim(),
        color: newCategory.color,
        icon: newCategory.icon,
      };
      await updateCategory(updatedCategory, newCategory.type);
    } else {
      await addCategory(
        {
          name: newCategory.name.trim(),
          color: newCategory.color,
          icon: newCategory.icon,
        },
        newCategory.type
      );
    }

    setIsCategoryDialogOpen(false);
    resetForm();
  };

  const handleDeleteCategory = async (id: string, type: "income" | "expense", isFixed?: boolean) => {
    if (isFixed) {
      showError("No puedes eliminar categorías fijas.");
      return;
    }
    await deleteCategory(id, type);
  };

  const getIconComponent = (iconName: string | undefined) => {
    const IconComponent = iconName ? (LucideIcons as any)[iconName] : LucideIcons.Tag;
    return IconComponent || LucideIcons.Tag;
  };

  const CategoryGrid = ({ list, type }: { list: Category[]; type: "income" | "expense" }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {list.map((cat) => {
        const IconComponent = getIconComponent(cat.icon);
        return (
          <div 
            key={cat.id} 
            className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div 
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner" 
                style={{ 
                  backgroundColor: cat.color || '#cbd5e1', 
                  color: getContrastColor(cat.color || '#cbd5e1') 
                }}
              >
                <IconComponent className="h-5 w-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-800 text-sm truncate">{cat.name}</span>
                {cat.is_fixed && (
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Sistema (Fija)</span>
                )}
              </div>
            </div>

            {/* Acciones Editar / Eliminar */}
            {!cat.is_fixed && (
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenEditCategoryDialog(cat, type)}
                  className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                  title="Editar Categoría"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      title="Eliminar Categoría"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl w-[90vw] max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción eliminará la categoría <b>{cat.name}</b>.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel className="rounded-xl mt-0">Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDeleteCategory(cat.id, type, cat.is_fixed)}
                        className="rounded-xl bg-rose-600"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-2 sm:p-4 md:p-6 pb-24 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Gestión de Categorías</h1>
          <p className="text-xs text-slate-500 font-medium">Personaliza cómo organizas tus ingresos y egresos.</p>
        </div>
        
        <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
          <DialogTrigger asChild>
            <Button size="default" className="rounded-2xl h-11 px-5 font-bold gap-2 w-full sm:w-auto" onClick={handleOpenAddCategoryDialog}>
              <PlusCircle className="h-4 w-4" /> Añadir Categoría
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl p-6 sm:p-8 w-[95vw] max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">{editingCategory ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitCategory} className="grid gap-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="categoryName" className="text-xs font-bold text-slate-600">Nombre de la Categoría</Label>
                <Input
                  id="categoryName"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory((prev) => ({ ...prev, name: e.target.value }))}
                  className="rounded-xl h-11 bg-slate-50 border-slate-200"
                  placeholder="Ej. Mascotas, Colegios..."
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Tipo</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={newCategory.type === "income" ? "default" : "outline"}
                    onClick={() => setNewCategory((prev) => ({ ...prev, type: "income" }))}
                    disabled={!!editingCategory}
                    className="rounded-xl h-10 font-bold text-xs"
                  >
                    Ingreso
                  </Button>
                  <Button
                    type="button"
                    variant={newCategory.type === "expense" ? "default" : "outline"}
                    onClick={() => setNewCategory((prev) => ({ ...prev, type: "expense" }))}
                    disabled={!!editingCategory}
                    className="rounded-xl h-10 font-bold text-xs"
                  >
                    Egreso
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Color</Label>
                <ColorPicker selectedColor={newCategory.color} onSelectColor={(c) => setNewCategory(p => ({ ...p, color: c }))} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Icono</Label>
                <IconPicker selectedIcon={newCategory.icon} onSelectIcon={(i) => setNewCategory(p => ({ ...p, icon: i }))} />
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full rounded-xl h-12 font-bold bg-primary hover:bg-primary/90">
                  {editingCategory ? "Guardar Cambios" : "Crear Categoría"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-3xl border-slate-100 shadow-sm p-4 sm:p-6 bg-white">
        <Tabs defaultValue="income" className="w-full" onValueChange={(value) => setActiveTab(value as "income" | "expense")}>
          <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-2xl h-12 mb-6">
            <TabsTrigger value="income" className="rounded-xl font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Ingresos ({incomeCategories.length})
            </TabsTrigger>
            <TabsTrigger value="expense" className="rounded-xl font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Egresos ({expenseCategories.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="income" className="space-y-4 outline-none">
            <CategoryGrid list={incomeCategories} type="income" />
          </TabsContent>
          
          <TabsContent value="expense" className="space-y-4 outline-none">
            <CategoryGrid list={expenseCategories} type="expense" />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Categories;