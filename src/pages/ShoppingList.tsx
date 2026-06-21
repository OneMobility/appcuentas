"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Trash2, ShoppingCart, CheckCircle2, DollarSign, ArrowRightLeft, FileText, Share2, Copy, MessageSquare, Filter, Search, AlertCircle } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { useCategoryContext } from "@/context/CategoryContext";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";

interface ShoppingItem {
  id: string;
  name: string;
  estimated_price: number;
  actual_price?: number;
  is_completed: boolean;
  category_id: string;
  notes?: string;
}

const ShoppingList: React.FC = () => {
  const { user } = useSession();
  const { expenseCategories, getCategoryById } = useCategoryContext();
  
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("all");

  const [newItem, setNewItem] = useState({
    name: "",
    estimated_price: "",
    category_id: "",
    notes: "",
  });

  const [selectedItemForExpense, setSelectedItemForExpense] = useState<ShoppingItem | null>(null);
  const [expenseForm, setTransactionForm] = useState({
    amount: "",
    paymentMethod: "cash", // 'cash' o cardId
    description: "",
  });

  // Cargar datos iniciales
  const fetchFinancialData = async () => {
    if (!user) return;
    
    // Cargar tarjetas
    const { data: cardsData } = await supabase
      .from('cards')
      .select('id, name, bank_name, type, current_balance')
      .eq('user_id', user.id);
    setCards(cardsData || []);

    // Calcular saldo de efectivo
    const { data: cashTxData } = await supabase
      .from('cash_transactions')
      .select('type, amount')
      .eq('user_id', user.id);
    
    const currentCash = (cashTxData || []).reduce((sum, tx) => 
      tx.type === "ingreso" ? sum + tx.amount : sum - tx.amount, 0
    );
    setCashBalance(currentCash);
  };

  useEffect(() => {
    if (user) {
      fetchFinancialData();
      // Cargar lista de compras desde localStorage
      const savedItems = localStorage.getItem(`oinkash_shopping_${user.id}`);
      if (savedItems) {
        try {
          setItems(JSON.parse(savedItems));
        } catch (e) {
          setItems([]);
        }
      }
    }
  }, [user]);

  // Guardar lista de compras
  const saveItems = (updatedItems: ShoppingItem[]) => {
    if (!user) return;
    setItems(updatedItems);
    localStorage.setItem(`oinkash_shopping_${user.id}`, JSON.stringify(updatedItems));
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim()) {
      showError("El nombre del artículo es obligatorio.");
      return;
    }

    let estPrice = 0;
    if (newItem.estimated_price) {
      estPrice = newItem.estimated_price.startsWith('=')
        ? (evaluateExpression(newItem.estimated_price.substring(1)) || 0)
        : (parseFloat(newItem.estimated_price) || 0);
    }

    const item: ShoppingItem = {
      id: crypto.randomUUID(),
      name: newItem.name.trim(),
      estimated_price: estPrice,
      is_completed: false,
      category_id: newItem.category_id || (expenseCategories[0]?.id || ""),
      notes: newItem.notes.trim() || undefined,
    };

    const updated = [...items, item];
    saveItems(updated);
    setIsAddDialogOpen(false);
    setNewItem({ name: "", estimated_price: "", category_id: "", notes: "" });
    showSuccess("Artículo añadido a la lista.");
  };

  const handleToggleComplete = (item: ShoppingItem) => {
    if (!item.is_completed) {
      // Si se marca como completado, abrir diálogo para registrar gasto
      setSelectedItemForExpense(item);
      setTransactionForm({
        amount: item.estimated_price.toString(),
        paymentMethod: "cash",
        description: `Compra: ${item.name}`,
      });
      setIsExpenseDialogOpen(true);
    } else {
      // Si se desmarca, simplemente cambiar estado
      const updated = items.map(i => 
        i.id === item.id ? { ...i, is_completed: false, actual_price: undefined } : i
      );
      saveItems(updated);
      showSuccess("Artículo marcado como pendiente.");
    }
  };

  const handleConfirmExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedItemForExpense) return;

    let amount = 0;
    if (expenseForm.amount) {
      amount = expenseForm.amount.startsWith('=')
        ? (evaluateExpression(expenseForm.amount.substring(1)) || 0)
        : (parseFloat(expenseForm.amount) || 0);
    }

    if (isNaN(amount) || amount <= 0) {
      showError("Monto inválido.");
      return;
    }

    const transactionDate = getLocalDateString(new Date());

    try {
      if (expenseForm.paymentMethod === "cash") {
        // Registrar en efectivo
        const { error } = await supabase.from('cash_transactions').insert({
          user_id: user.id,
          type: "egreso",
          amount,
          description: expenseForm.description,
          date: transactionDate,
          expense_category_id: selectedItemForExpense.category_id,
        });
        if (error) throw error;
      } else {
        // Registrar en tarjeta
        const card = cards.find(c => c.id === expenseForm.paymentMethod);
        if (card) {
          const newCardBalance = card.type === "credit" 
            ? card.current_balance + amount 
            : card.current_balance - amount;

          const { error: cardUpdateError } = await supabase
            .from('cards')
            .update({ current_balance: newCardBalance })
            .eq('id', card.id);
          if (cardUpdateError) throw cardUpdateError;

          const { error: txError } = await supabase.from('card_transactions').insert({
            user_id: user.id,
            card_id: card.id,
            type: "charge",
            amount,
            description: expenseForm.description,
            date: transactionDate,
            expense_category_id: selectedItemForExpense.category_id,
          });
          if (txError) throw txError;
        }
      }

      // Actualizar estado del artículo en la lista
      const updated = items.map(i => 
        i.id === selectedItemForExpense.id 
          ? { ...i, is_completed: true, actual_price: amount } 
          : i
      );
      saveItems(updated);
      setIsExpenseDialogOpen(false);
      setSelectedItemForExpense(null);
      showSuccess("¡Artículo comprado y gasto registrado!");
      fetchFinancialData();
    } catch (error: any) {
      showError("Error al registrar el gasto: " + error.message);
    }
  };

  const handleSkipExpense = () => {
    if (!selectedItemForExpense) return;
    const updated = items.map(i => 
      i.id === selectedItemForExpense.id ? { ...i, is_completed: true } : i
    );
    saveItems(updated);
    setIsExpenseDialogOpen(false);
    setSelectedItemForExpense(null);
    showSuccess("Artículo marcado como comprado (sin registrar gasto).");
  };

  const handleDeleteItem = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    saveItems(updated);
    showSuccess("Artículo eliminado.");
  };

  const handleClearCompleted = () => {
    const updated = items.filter(i => !i.is_completed);
    saveItems(updated);
    showSuccess("Lista limpia de artículos comprados.");
  };

  // Filtrar artículos
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = filterCategory === "all" || item.category_id === filterCategory;
      const matchesStatus = filterStatus === "all" || 
                            (filterStatus === "pending" && !item.is_completed) || 
                            (filterStatus === "completed" && item.is_completed);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, searchTerm, filterCategory, filterStatus]);

  // Métricas de la lista
  const metrics = useMemo(() => {
    const pending = items.filter(i => !i.is_completed);
    const completed = items.filter(i => i.is_completed);
    
    const estimatedPendingTotal = pending.reduce((sum, i) => sum + i.estimated_price, 0);
    const actualCompletedTotal = completed.reduce((sum, i) => sum + (i.actual_price || i.estimated_price), 0);

    return {
      pendingCount: pending.length,
      completedCount: completed.length,
      estimatedPendingTotal,
      actualCompletedTotal,
    };
  }, [items]);

  // Generar texto para compartir
  const generateShareText = () => {
    let text = `🛒 *MI LISTA DE COMPRAS - OINKASH*\n\n`;
    const pending = items.filter(i => !i.is_completed);
    const completed = items.filter(i => i.is_completed);

    if (pending.length > 0) {
      text += `📝 *Pendientes por comprar:*\n`;
      pending.forEach(i => {
        text += `☐ ${i.name} ${i.estimated_price > 0 ? `(~ $${i.estimated_price.toFixed(2)})` : ""}${i.notes ? ` _(${i.notes})_` : ""}\n`;
      });
      text += `\n💰 *Presupuesto estimado:* $${metrics.estimatedPendingTotal.toFixed(2)}\n`;
    } else {
      text += `🎉 ¡No hay artículos pendientes!\n`;
    }

    if (completed.length > 0) {
      text += `\n✅ *Ya comprados:*\n`;
      completed.slice(0, 10).forEach(i => {
        text += `✓ ~${i.name}~ ${i.actual_price ? `($${i.actual_price.toFixed(2)})` : ""}\n`;
      });
    }

    text += `\nOrganizado con Oinkash 🐷`;
    return text;
  };

  const handleCopyList = () => {
    navigator.clipboard.writeText(generateShareText());
    showSuccess("Lista copiada al portapapeles.");
    setIsShareDialogOpen(false);
  };

  const handleSendWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharePhone.trim()) {
      showError("Ingresa un número de teléfono.");
      return;
    }
    const cleanPhone = sharePhone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(generateShareText())}`, '_blank');
    setIsShareDialogOpen(false);
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-8 w-8 text-primary" /> Lista de Compras
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsShareDialogOpen(true)}>
            <Share2 className="h-4 w-4 mr-1" /> Compartir
          </Button>
          {metrics.completedCount > 0 && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={handleClearCompleted}>
              Limpiar Comprados
            </Button>
          )}
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Por Comprar ({metrics.pendingCount} artículos)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${metrics.estimatedPendingTotal.toFixed(2)}</div>
            <p className="text-xs text-yellow-700 mt-1">Presupuesto estimado pendiente</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-green-500 bg-green-50 text-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gasto Real en esta Lista</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${metrics.actualCompletedTotal.toFixed(2)}</div>
            <p className="text-xs text-green-700 mt-1">Total invertido en artículos comprados</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full md:max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar artículo o nota..." 
              className="pl-8 h-10 rounded-xl" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
          <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
            <SelectTrigger className="w-full sm:w-[150px] h-10 rounded-xl">
              <Filter className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="completed">Comprados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-xl">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {expenseCategories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="w-full md:w-auto h-10 rounded-xl font-bold gap-1.5" onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle className="h-4 w-4" /> Añadir Artículo
        </Button>
      </div>

      {/* Tabla de Artículos */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] pl-4">Estado</TableHead>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Est. / Real</TableHead>
                  <TableHead className="text-right pr-4">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                      No hay artículos que coincidan con los filtros. ¡Añade uno nuevo!
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map(item => {
                    const category = getCategoryById(item.category_id);
                    return (
                      <TableRow key={item.id} className={cn(item.is_completed && "bg-muted/30 opacity-70")}>
                        <TableCell className="pl-4">
                          <Checkbox 
                            checked={item.is_completed} 
                            onCheckedChange={() => handleToggleComplete(item)}
                            className="h-5 w-5 rounded-md"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className={cn("font-bold text-sm", item.is_completed && "line-through text-muted-foreground")}>
                              {item.name}
                            </span>
                            {item.notes && (
                              <span className="text-xs text-muted-foreground italic">{item.notes}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {category ? (
                            <div className="flex items-center gap-1.5 text-xs">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                              <span>{category.name}</span>
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">
                          {item.is_completed ? (
                            <span className="text-green-600 font-bold">
                              ${(item.actual_price || item.estimated_price).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              ${item.estimated_price.toFixed(2)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive" 
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo para Añadir Artículo */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Añadir Artículo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="itemName">Nombre del Artículo</Label>
              <Input 
                id="itemName"
                value={newItem.name} 
                onChange={e => setNewItem({...newItem, name: e.target.value})} 
                placeholder="Ej. Leche, Detergente, Manzanas..." 
                required
                className="rounded-xl h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="itemPrice">Precio Estimado (Opcional)</Label>
              <Input 
                id="itemPrice"
                value={newItem.estimated_price} 
                onChange={e => setNewItem({...newItem, estimated_price: e.target.value})} 
                placeholder="Ej. 45 o =20+25" 
                className="rounded-xl h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label>Categoría de Gasto</Label>
              <Select 
                value={newItem.category_id} 
                onValueChange={v => setNewItem({...newItem, category_id: v})}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-4 w-4" />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="itemNotes">Notas / Cantidad (Opcional)</Label>
              <Input 
                id="itemNotes"
                value={newItem.notes} 
                onChange={e => setNewItem({...newItem, notes: e.target.value})} 
                placeholder="Ej. 2 piezas, marca específica..." 
                className="rounded-xl h-10"
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full rounded-xl h-11 font-bold">Añadir a la Lista</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para Registrar Gasto al Comprar */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>¿Registrar Gasto de Compra?</DialogTitle>
            <DialogDescription>
              Puedes registrar automáticamente este artículo como un gasto real en tu cuenta.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmExpense} className="grid gap-4 py-4">
            <div className="bg-primary/10 p-4 rounded-2xl text-center">
              <p className="text-xs text-muted-foreground uppercase font-bold">Artículo comprado</p>
              <p className="text-lg font-black text-primary-foreground">{selectedItemForExpense?.name}</p>
            </div>

            <div className="grid gap-2">
              <Label>Monto Real Pagado</Label>
              <Input 
                value={expenseForm.amount} 
                onChange={e => setTransactionForm({...expenseForm, amount: e.target.value})} 
                placeholder="0.00" 
                required
                className="rounded-xl h-10"
              />
            </div>

            <div className="grid gap-2">
              <Label>Método de Pago</Label>
              <Select 
                value={expenseForm.paymentMethod} 
                onValueChange={v => setTransactionForm({...expenseForm, paymentMethod: v})}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo (Saldo: ${cashBalance.toFixed(2)})</SelectItem>
                  {cards.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.bank_name}) - ${c.current_balance.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Descripción del Gasto</Label>
              <Input 
                value={expenseForm.description} 
                onChange={e => setTransactionForm({...expenseForm, description: e.target.value})} 
                required
                className="rounded-xl h-10"
              />
            </div>

            <DialogFooter className="flex flex-col gap-2">
              <Button type="submit" className="w-full rounded-xl h-11 font-bold">
                Registrar Gasto y Marcar Comprado
              </Button>
              <Button type="button" variant="outline" className="w-full rounded-xl h-11" onClick={handleSkipExpense}>
                Solo Marcar Comprado (Sin Gasto)
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para Compartir Lista */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" /> Compartir Lista de Compras
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="border rounded-2xl p-4 bg-muted/50 max-h-[200px] overflow-y-auto text-xs font-mono whitespace-pre-wrap">
              {generateShareText()}
            </div>
            <form onSubmit={handleSendWhatsApp} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sharePhone">Número de WhatsApp</Label>
                <Input
                  id="sharePhone"
                  placeholder="Ej. 521234567890"
                  value={sharePhone}
                  onChange={(e) => setSharePhone(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>
              <Button type="submit" className="w-full gap-2 rounded-xl h-11 font-bold">
                <MessageSquare className="h-4 w-4" /> Enviar por WhatsApp
              </Button>
            </form>
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-muted"></div>
              <span className="flex-shrink mx-4 text-muted-foreground text-xs">O</span>
              <div className="flex-grow border-t border-muted"></div>
            </div>
            <Button variant="outline" onClick={handleCopyList} className="w-full gap-2 rounded-xl h-11">
              <Copy className="h-4 w-4" /> Copiar al Portapapeles
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShoppingList;