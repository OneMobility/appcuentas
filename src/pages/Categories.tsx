"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import ColorPicker from "@/components/ColorPicker";
import { useCategoryContext, Category } from "@/context/CategoryContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import IconPicker from "@/components/IconPicker"; // Importar IconPicker
import * as LucideIcons from "lucide-react"; // Importar todos los iconos de Lucide
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Importar componentes de Tabs

const Categories = () => {
  const { incomeCategories, expenseCategories, addCategory, updateCategory, deleteCategory, isLoadingCategories } = useCategoryContext();
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: "",
    type: "income" as "income" | "expense",
    color: "#3B82F6", // Default color
    icon: "Tag", // Default icon
  });
  const [activeTab, setActiveTab] = useState<"income" | "expense">("income"); // Estado para la pestaña activa

  useEffect(() => {
    if (editingCategory) {
      setNewCategory({
        name: editingCategory.name,
        type: incomeCategories.some(c => c.id === editingCategory.id) ? "income" : "expense", // Determine type based on which list it's in
        color: editingCategory.color,
        icon: editingCategory.icon || "Tag",
      });
    } else {
      resetForm();
    }
  }, [editingCategory, incomeCategories, expenseCategories]); // Add expenseCategories to dependencies

  // Sincronizar el tipo de nueva categoría con la pestaña activa
  useEffect(() => {
    setNewCategory((prev) => ({ ...prev, type: activeTab }));
  }, [activeTab]);

  const resetForm = () => {
    setNewCategory({ name: "", type: activeTab, color: "#3B82F6", icon: "Tag" });
    setEditingCategory(null);
  };

  const handleNewCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCategory((prev) => ({ ...prev, name: e.target.value }));
  };

  const handleColorSelect = (color: string) => {
    setNewCategory((prev) => ({ ...prev, color }));
  };

  const handleIconSelect = (iconName: string) => {
    setNewCategory((prev) => ({ ...prev, icon: iconName }));
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
    if (!newCategory.color) {
      showError("Por favor, selecciona un color para la categoría.");
      return;
    }
    if (!newCategory.icon) {
      showError("Por favor, selecciona un icono para la categoría.");
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

  const handleDeleteCategory = async (id: string, name: string, type: "income" | "expense", isFixed: boolean | undefined) => {
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

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Gestión de Categorías</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Categorías</CardTitle>
          <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1" onClick={handleOpenAddCategoryDialog}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Añadir Categoría
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingCategory ? "Editar Categoría" : "Añadir Nueva Categoría"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitCategory} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="categoryName" className="text-right">
                    Nombre
                  </Label>
                  <Input
                    id="categoryName"
                    name="categoryName"
                    value={newCategory.name}
                    onChange={handleNewCategoryChange}
                    className="col-span-3"
                    required
                    disabled={editingCategory?.is_fixed}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Tipo</Label>
                  <div className="col-span-3 flex gap-2">
                    <Button
                      type="button"
                      variant={newCategory.type === "income" ? "default" : "outline"}
                      onClick={() => setNewCategory((prev) => ({ ...prev, type: "income" }))}
                      disabled={!!editingCategory} // Deshabilitar cambio de tipo al editar
                    >
                      Ingreso
                    </Button>
                    <Button
                      type="button"
                      variant={newCategory.type === "expense" ? "default" : "outline"}
                      onClick={() => setNewCategory((prev) => ({ ...prev, type: "expense" }))}
                      disabled={!!editingCategory} // Deshabilitar cambio de tipo al editar
                    >
                      Egreso
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="categoryColor" className="text-right">
                    Color
                  </Label>
                  <div className="col-span-3">
                    <ColorPicker selectedColor={newCategory.color} onSelectColor={handleColorSelect} />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="categoryIcon" className="text-right">
                    Icono
                  </Label>
                  <div className="col-span-3">
                    <IconPicker selectedIcon={newCategory.icon} onSelectIcon={handleIconSelect} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={editingCategory?.is_fixed}>
                    {editingCategory ? "Actualizar Categoría" : "Guardar Categoría"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="income" className="w-full" onValueChange={(value) => setActiveTab(value as "income" | "expense")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="income">Ingresos</TabsTrigger>
              <TabsTrigger value="expense">Egresos</TabsTrigger>
            </TabsList>
            <TabsContent value="income">
              <h3 className="text-lg font-semibold mb-2">Categorías de Ingresos</h3>
              {incomeCategories.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Icono</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomeCategories.map((cat) => {
                        const IconComponent = getIconComponent(cat.icon);
                        return (
                          <TableRow key={cat.id}>
                            <TableCell><IconComponent className="h-4 w-4" /></TableCell>
                            <TableCell>{cat.name}</TableCell>
                            <TableCell>
                              <div
                                className="h-4 w-4 rounded-full border"
                                style={{ backgroundColor: cat.color }}
                              />
                            </TableCell>
                            <TableCell className="text-right flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditCategoryDialog(cat, "income")}
                                className="h-8 w-8 p-0"
                                disabled={cat.is_fixed}
                              >
                                <Edit className="h-3.5 w-3.5" />
                                <span className="sr-only">Editar</span>
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    disabled={cat.is_fixed}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span className="sr-only">Eliminar</span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Esto eliminará permanentemente la categoría 
                                      **{cat.name}** de ingresos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteCategory(cat.id, cat.name, "income", cat.is_fixed)}>
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground">No hay categorías de ingresos.</p>
              )}
            </TabsContent>
            <TabsContent value="expense">
              <h3 className="text-lg font-semibold mb-2">Categorías de Egresos</h3>
              {expenseCategories.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Icono</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenseCategories.map((cat) => {
                        const IconComponent = getIconComponent(cat.icon);
                        return (
                          <TableRow key={cat.id}>
                            <TableCell><IconComponent className="h-4 w-4" /></TableCell>
                            <TableCell>{cat.name}</TableCell>
                            <TableCell>
                              <div
                                className="h-4 w-4 rounded-full border"
                                style={{ backgroundColor: cat.color }}
                              />
                            </TableCell>
                            <TableCell className="text-right flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditCategoryDialog(cat, "expense")}
                                className="h-8 w-8 p-0"
                                disabled={cat.is_fixed}
                              >
                                <Edit className="h-3.5 w-3.5" />
                                <span className="sr-only">Editar</span>
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    disabled={cat.is_fixed}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span className="sr-only">Eliminar</span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Esto eliminará permanentemente la categoría 
                                      **{cat.name}** de egresos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteCategory(cat.id, cat.name, "expense", cat.is_fixed)}>
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground">No hay categorías de egresos.</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Categories;