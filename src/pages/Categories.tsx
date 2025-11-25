"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2 } from "lucide-react"; // Importar Trash2
import { showSuccess, showError } from "@/utils/toast";
import ColorPicker from "@/components/ColorPicker";
import { useCategoryContext, Category } from "@/context/CategoryContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"; // Importar AlertDialog

const Categories = () => {
  const { incomeCategories, expenseCategories, addCategory, updateCategory, deleteCategory, isLoadingCategories } = useCategoryContext();
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: "",
    type: "income" as "income" | "expense",
    color: "#3B82F6", // Default color
  });

  useEffect(() => {
    if (editingCategory) {
      setNewCategory({
        name: editingCategory.name,
        type: editingCategory.user_id?.startsWith("inc") ? "income" : "expense", // Asumiendo que el user_id puede indicar el tipo si no hay otra forma
        color: editingCategory.color,
      });
    } else {
      resetForm();
    }
  }, [editingCategory]);

  const resetForm = () => {
    setNewCategory({ name: "", type: "income", color: "#3B82F6" });
    setEditingCategory(null);
  };

  const handleNewCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCategory((prev) => ({ ...prev, name: e.target.value }));
  };

  const handleNewCategoryTypeChange = (type: "income" | "expense") => {
    setNewCategory((prev) => ({ ...prev, type }));
  };

  const handleColorSelect = (color: string) => {
    setNewCategory((prev) => ({ ...prev, color }));
  };

  const handleOpenAddCategoryDialog = () => {
    resetForm();
    setIsCategoryDialogOpen(true);
  };

  const handleOpenEditCategoryDialog = (category: Category, type: "income" | "expense") => {
    setEditingCategory(category);
    setNewCategory({
      name: category.name,
      type: type, // Pasar el tipo correcto
      color: category.color,
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

    if (editingCategory) {
      const updatedCategory: Category = {
        ...editingCategory,
        name: newCategory.name.trim(),
        color: newCategory.color,
      };
      await updateCategory(updatedCategory, newCategory.type);
    } else {
      await addCategory(
        {
          name: newCategory.name.trim(),
          color: newCategory.color,
        },
        newCategory.type
      );
    }

    setIsCategoryDialogOpen(false);
    resetForm();
  };

  const handleDeleteCategory = async (id: string, name: string, type: "income" | "expense") => {
    await deleteCategory(id, type);
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Gestión de Categorías</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Categorías de Ingresos y Egresos</CardTitle>
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
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Tipo</Label>
                  <div className="col-span-3 flex gap-2">
                    <Button
                      type="button"
                      variant={newCategory.type === "income" ? "default" : "outline"}
                      onClick={() => handleNewCategoryTypeChange("income")}
                      disabled={!!editingCategory} // Deshabilitar cambio de tipo al editar
                    >
                      Ingreso
                    </Button>
                    <Button
                      type="button"
                      variant={newCategory.type === "expense" ? "default" : "outline"}
                      onClick={() => handleNewCategoryTypeChange("expense")}
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
                <DialogFooter>
                  <Button type="submit">{editingCategory ? "Actualizar Categoría" : "Guardar Categoría"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Categorías de Ingresos</h3>
              {incomeCategories.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomeCategories.map((cat) => (
                        <TableRow key={cat.id}>
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
                                  <AlertDialogAction onClick={() => handleDeleteCategory(cat.id, cat.name, "income")}>
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground">No hay categorías de ingresos.</p>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Categorías de Egresos</h3>
              {expenseCategories.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenseCategories.map((cat) => (
                        <TableRow key={cat.id}>
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
                                  <AlertDialogAction onClick={() => handleDeleteCategory(cat.id, cat.name, "expense")}>
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground">No hay categorías de egresos.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Categories;