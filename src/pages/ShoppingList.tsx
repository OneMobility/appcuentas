"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Trash2, ShoppingCart, CheckCircle2, DollarSign, FileText, Share2, Copy, MessageSquare, Filter, Search, AlertCircle, ListPlus, History, TrendingUp, TrendingDown, Minus, Scale } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { useCategoryContext } from "@/context/CategoryContext";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface ShoppingListType {
  id: string;
  name: string;
  status: 'active' | 'completed';
  created_at: string;
}

interface ShoppingItem {
  id: string;
  list_id: string;
  name: string;
  quantity: number;
  estimated_unit_price: number;
  actual_unit_price?: number | null;
  is_completed: boolean;
  category_id?: string;
}

interface PriceHistoryItem {
  actual_unit_price: number;
  created_at: string;
  list_name: string;
}

const ShoppingList: React.FC = () => {
  const { user } = useSession();
  const { expenseCategories, getCategoryById } = useCategoryContext();
  
  // Listas y artículos
  const [lists, setLists] = useState<ShoppingListType[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  
  // Diálogos
  const [isAddListDialogOpen, setIsAddListDialogOpen] = useState(false);
  const [isBulkAddDialogOpen, setIsBulkAddDialogOpen] = useState(false);
  const [isFinalizeDialogOpen, setIsFinalizeDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  // Formularios
  const [newListName, setNewListListName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: "1",
    estimated_unit_price: "",
    category_id: "",
  });

  // Formulario de Cierre de Compra
  const [finalizeForm, setExpenseForm] = useState({
    totalChargedByStore: "",
    paymentMethod: "cash",
    selectedCategoryId: "",
    description: "",
  });

  const [historyItemName, setHistoryItemName] = useState("");
  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [globalPriceHistories, setGlobalPriceHistories] = useState<Record<string, PriceHistoryItem[]>>({});

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sharePhone, setSharePhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar listas de compras
  const fetchLists = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      showError("Error al cargar listas: " + error.message);
    } else {
      setLists(data || []);
      if (data && data.length > 0 && !selectedListId) {
        setSelectedListId(data[0].id);
      }
    }
  };

  // Cargar artículos de la lista seleccionada
  const fetchItems = async () => {
    if (!user || !selectedListId) {
      setItems([]);
      return;
    }
    const { data, error } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('list_id', selectedListId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      showError("Error al cargar artículos: " + error.message);
    } else {
      setItems(data || []);
      if (data && data.length > 0) {
        fetchGlobalPriceHistories(data.map(i => i.name));
      }
    }
  };

  // Cargar datos financieros (efectivo y tarjetas)
  const fetchFinancialData = async () => {
    if (!user) return;
    const [cardsRes, cashRes] = await Promise.all([
      supabase.from('cards').select('id, name, bank_name, type, current_balance').eq('user_id', user.id),
      supabase.from('cash_transactions').select('type, amount').eq('user_id', user.id)
    ]);
    setCards(cardsRes.data || []);
    setCashBalance((cashRes.data || []).reduce((sum, tx) => 
      tx.type === "ingreso" ? sum + tx.amount : sum - tx.amount, 0
    ));
  };

  // Cargar históricos de precios de forma masiva para comparar tendencias
  const fetchGlobalPriceHistories = async (itemNames: string[]) => {
    if (!user || itemNames.length === 0) return;

    const { data, error } = await supabase
      .from('shopping_items')
      .select('name, actual_unit_price, created_at, shopping_lists(name)')
      .eq('user_id', user.id)
      .eq('is_completed', true)
      .not('actual_unit_price', 'is', null)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const historyMap: Record<string, PriceHistoryItem[]> = {};
      data.forEach((row: any) => {
        const key = row.name.trim().toLowerCase();
        if (!historyMap[key]) historyMap[key] = [];
        historyMap[key].push({
          actual_unit_price: row.actual_unit_price,
          created_at: row.created_at,
          list_name: row.shopping_lists?.name || "Lista anterior"
        });
      });
      setGlobalPriceHistories(historyMap);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLists();
      fetchFinancialData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedListId) {
      fetchItems();
    }
  }, [selectedListId]);

  // Crear nueva lista
  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim() || !user) return;

    const { data, error } = await supabase
      .from('shopping_lists')
      .insert({ name: newListName.trim(), user_id: user.id })
      .select()
      .single();

    if (error) {
      showError("Error al crear lista: " + error.message);
    } else {
      showSuccess("Lista creada exitosamente.");
      setLists(prev => [data, ...prev]);
      setSelectedListId(data.id);
      setIsAddListDialogOpen(false);
      setNewListListName("");
    }
  };

  // Eliminar lista completa
  const handleDeleteList = async (listId: string) => {
    const { error } = await supabase.from('shopping_lists').delete().eq('id', listId);
    if (error) {
      showError("Error al eliminar lista: " + error.message);
    } else {
      showSuccess("Lista eliminada.");
      setLists(prev => prev.filter(l => l.id !== listId));
      if (selectedListId === listId) {
        setSelectedListId("");
      }
    }
  };

  // Parsear texto libre y añadir artículos masivamente
  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim() || !selectedListId || !user) return;

    const lines = bulkText.split("\n");
    const itemsToInsert: any[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Regex para detectar cantidad al inicio (ej: "2 leches", "1.5 manzanas", "3x huevos")
      const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:x|pcs|pzas|unidades|de|kg|g)?\s*(.+)$/i);
      
      if (match) {
        itemsToInsert.push({
          list_id: selectedListId,
          user_id: user.id,
          name: match[2].trim(),
          quantity: parseFloat(match[1]),
          category_id: bulkCategory || (expenseCategories[0]?.id || null),
        });
      } else {
        itemsToInsert.push({
          list_id: selectedListId,
          user_id: user.id,
          name: trimmed,
          quantity: 1,
          category_id: bulkCategory || (expenseCategories[0]?.id || null),
        });
      }
    });

    const { error } = await supabase.from('shopping_items').insert(itemsToInsert);

    if (error) {
      showError("Error al añadir artículos: " + error.message);
    } else {
      showSuccess(`${itemsToInsert.length} artículos añadidos.`);
      setIsBulkAddDialogOpen(false);
      setBulkText("");
      fetchItems();
    }
  };

  // Añadir un solo artículo
  const handleAddSingleItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim() || !selectedListId || !user) return;

    const qty = parseFloat(newItem.quantity) || 1;
    const estPrice = newItem.estimated_unit_price ? (evaluateExpression(newItem.estimated_unit_price) || 0) : 0;

    const { error } = await supabase.from('shopping_items').insert({
      list_id: selectedListId,
      user_id: user.id,
      name: newItem.name.trim(),
      quantity: qty,
      estimated_unit_price: estPrice,
      category_id: newItem.category_id || (expenseCategories[0]?.id || null),
    });

    if (error) {
      showError("Error al añadir artículo: " + error.message);
    } else {
      showSuccess("Artículo añadido.");
      setNewItem({ name: "", quantity: "1", estimated_unit_price: "", category_id: "" });
      fetchItems();
    }
  };

  // Eliminar un artículo
  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase.from('shopping_items').delete().eq('id', itemId);
    if (error) showError("Error al eliminar artículo.");
    else {
      setItems(prev => prev.filter(i => i.id !== itemId));
      showSuccess("Artículo eliminado.");
    }
  };

  // Actualizar cantidad o precio de un artículo directamente en la tabla
  const handleUpdateItemInline = async (itemId: string, field: 'quantity' | 'actual_unit_price', value: string) => {
    const parsedValue = parseFloat(value);
    const updateData = { [field]: isNaN(parsedValue) ? null : parsedValue };

    // Actualizar localmente primero para rapidez visual
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, ...updateData } : item));

    // Guardar en Supabase
    await supabase
      .from('shopping_items')
      .update(updateData)
      .eq('id', itemId);
  };

  // Marcar/Desmarcar artículo como "En el carrito"
  const handleToggleCart = async (itemId: string, isChecked: boolean) => {
    // Actualizar localmente
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        // Si se marca y no tiene precio real, sugerimos el estimado
        const actual_unit_price = isChecked && !item.actual_unit_price ? item.estimated_unit_price : item.actual_unit_price;
        return { ...item, is_completed: isChecked, actual_unit_price };
      }
      return item;
    }));

    const targetItem = items.find(i => i.id === itemId);
    const actual_unit_price = isChecked && targetItem && !targetItem.actual_unit_price ? targetItem.estimated_unit_price : (targetItem?.actual_unit_price || null);

    await supabase
      .from('shopping_items')
      .update({ is_completed: isChecked, actual_unit_price })
      .eq('id', itemId);
  };

  // Suma total de los artículos que están marcados (en el carrito)
  const totalInCart = useMemo(() => {
    return items
      .filter(i => i.is_completed)
      .reduce((sum, i) => sum + (i.quantity * (i.actual_unit_price || 0)), 0);
  }, [items]);

  // Abrir diálogo de finalización de compra
  const handleOpenFinalize = () => {
    const currentList = lists.find(l => l.id === selectedListId);
    setExpenseForm({
      totalChargedByStore: totalInCart.toFixed(2),
      paymentMethod: "cash",
      selectedCategoryId: expenseCategories[0]?.id || "",
      description: `Compra Súper: ${currentList?.name || "Despensa"}`,
    });
    setIsFinalizeDialogOpen(true);
  };

  // Confirmar compra y registrar un único gasto consolidado
  const handleFinalizePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedListId) return;

    const totalCharged = parseFloat(finalizeForm.totalChargedByStore) || 0;
    if (totalCharged <= 0) {
      showError("El total cobrado debe ser mayor a cero.");
      return;
    }

    setIsSubmitting(true);
    const transactionDate = getLocalDateString(new Date());
    const difference = totalCharged - totalInCart;
    
    // Nota de diferencia si existe
    let finalDescription = finalizeForm.description;
    if (Math.abs(difference) >= 0.01) {
      finalDescription += ` (Diferencia de cuadre: ${difference > 0 ? "+" : ""}${difference.toFixed(2)})`;
    }

    try {
      // 1. Registrar un único gasto consolidado en Efectivo o Tarjeta
      if (finalizeForm.paymentMethod === "cash") {
        const { error } = await supabase.from('cash_transactions').insert({
          user_id: user.id,
          type: "egreso",
          amount: totalCharged,
          description: finalDescription,
          date: transactionDate,
          expense_category_id: finalizeForm.selectedCategoryId || null,
        });
        if (error) throw error;
      } else {
        const card = cards.find(c => c.id === finalizeForm.paymentMethod);
        if (card) {
          const newCardBalance = card.type === "credit" 
            ? card.current_balance + totalCharged 
            : card.current_balance - totalCharged;

          const { error: cardUpdateError } = await supabase
            .from('cards')
            .update({ current_balance: newCardBalance })
            .eq('id', card.id);
          if (cardUpdateError) throw cardUpdateError;

          const { error: txError } = await supabase.from('card_transactions').insert({
            user_id: user.id,
            card_id: card.id,
            type: "charge",
            amount: totalCharged,
            description: finalDescription,
            date: transactionDate,
            expense_category_id: finalizeForm.selectedCategoryId || null,
          });
          if (txError) throw txError;
        }
      }

      // 2. Marcar la lista de compras como completada
      const { error: listError } = await supabase
        .from('shopping_lists')
        .update({ status: 'completed' })
        .eq('id', selectedListId);
      if (listError) throw listError;

      showSuccess("¡Compra finalizada! Se registró un único gasto consolidado.");
      setIsFinalizeDialogOpen(false);
      setSelectedListId("");
      fetchLists();
      fetchFinancialData();
    } catch (error: any) {
      showError("Error al finalizar compra: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ver historial de precios detallado de un artículo
  const handleViewHistory = (itemName: string) => {
    const key = itemName.trim().toLowerCase();
    const history = globalPriceHistories[key] || [];
    setHistoryItemName(itemName);
    setPriceHistory(history);
    setIsHistoryDialogOpen(true);
  };

  // Analizar tendencia de precios basada en las últimas 3 compras
  const getPriceTrend = (itemName: string, currentPrice: number) => {
    const key = itemName.trim().toLowerCase();
    const history = globalPriceHistories[key];
    if (!history || history.length === 0) return null;

    // Tomar los últimos 3 precios históricos (excluyendo el actual)
    const prices = history.slice(0, 3).map(h => h.actual_unit_price);
    
    if (prices.length < 1) return null;

    const lastPrice = prices[0];
    if (currentPrice === 0) return { lastPrice, status: 'stable' as const, label: "Estable" };

    // Comparación simple con la última compra
    if (currentPrice > lastPrice + 0.05) {
      return { lastPrice, status: 'up' as const, label: "Subió" };
    } else if (currentPrice < lastPrice - 0.05) {
      return { lastPrice, status: 'down' as const, label: "Bajó" };
    }
    return { lastPrice, status: 'stable' as const, label: "Estable" };
  };

  // Filtrar artículos
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === "all" || item.category_id === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, filterCategory]);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-8 w-8 text-primary" /> Lista de Compras
        </h1>
        
        {/* Selector de Listas */}
        <div className="flex items-center gap-2">
          <Select value={selectedListId} onValueChange={setSelectedListId}>
            <SelectTrigger className="w-[200px] rounded-xl h-10">
              <SelectValue placeholder="Selecciona una lista" />
            </SelectTrigger>
            <SelectContent>
              {lists.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} {l.status === 'completed' ? '(Completada)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setIsAddListDialogOpen(true)}>
            <ListPlus className="h-5 w-5" />
          </Button>
          {selectedListId && (
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl text-destructive" onClick={() => handleDeleteList(selectedListId)}>
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {selectedListId ? (
        <>
          {/* Barra de Progreso y Suma en Carrito */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-l-4 border-primary bg-primary/10 text-primary-foreground">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total en Carrito (Marcados)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-black">${totalInCart.toFixed(2)}</div>
                <p className="text-xs opacity-80 mt-1">Suma acumulada de lo que llevas marcado</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800 flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Progreso de Compra</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-2xl font-bold">
                    {items.filter(i => i.is_completed).length} / {items.length}
                  </div>
                  <p className="text-xs text-yellow-700">Artículos en el carrito</p>
                </div>
                {items.filter(i => i.is_completed).length > 0 && (
                  <Button onClick={handleOpenAdd} className="rounded-xl font-bold bg-yellow-600 hover:bg-yellow-700 text-white">
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Finalizar Compra
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Filtros y Búsqueda */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 w-full md:max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar artículo..." 
                  className="pl-8 h-10 rounded-xl" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" className="flex-1 md:flex-none h-10 rounded-xl font-bold" onClick={() => setIsBulkAddDialogOpen(true)}>
                <FileText className="h-4 w-4 mr-1" /> Pegar Texto
              </Button>
              <Button variant="outline" className="h-10 rounded-xl" onClick={() => setIsShareDialogOpen(true)}>
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Formulario de Añadir Artículo Rápido */}
          <Card className="p-4">
            <form onSubmit={handleAddSingleItem} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className="grid gap-1.5">
                <Label>Artículo</Label>
                <Input 
                  placeholder="Ej. Leche" 
                  value={newItem.name} 
                  onChange={e => setNewItem({...newItem, name: e.target.value})} 
                  required
                  className="rounded-xl h-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <Label>Cant. Planeada</Label>
                  <Input 
                    type="number" 
                    step="0.1" 
                    value={newItem.quantity} 
                    onChange={e => setNewItem({...newItem, quantity: e.target.value})} 
                    required
                    className="rounded-xl h-10"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Precio Est. (Opcional)</Label>
                  <Input 
                    placeholder="Ej. 25" 
                    value={newItem.estimated_unit_price} 
                    onChange={e => setNewItem({...newItem, estimated_unit_price: e.target.value})} 
                    className="rounded-xl h-10"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Categoría</Label>
                <Select value={newItem.category_id} onValueChange={v => setNewItem({...newItem, category_id: v})}>
                  <SelectTrigger className="rounded-xl h-10">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="h-10 rounded-xl font-bold">
                Añadir
              </Button>
            </form>
          </Card>

          {/* Tabla de Artículos Interactiva para Tienda */}
          <Card className="shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px] pl-4">Llevo</TableHead>
                      <TableHead>Artículo</TableHead>
                      <TableHead className="w-[100px]">Cant. Real</TableHead>
                      <TableHead className="w-[120px] text-right">Precio Unitario</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right pr-4">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                          No hay artículos en esta lista. ¡Usa el creador rápido o pega un texto!
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map(item => {
                        const currentPrice = item.actual_unit_price || 0;
                        const trend = getPriceTrend(item.name, currentPrice);

                        return (
                          <TableRow key={item.id} className={cn(item.is_completed && "bg-primary/5")}>
                            <TableCell className="pl-4">
                              <Checkbox 
                                checked={item.is_completed} 
                                onCheckedChange={(checked) => handleToggleCart(item.id, !!checked)}
                                className="h-6 w-6 rounded-md"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className={cn("font-bold text-sm", item.is_completed && "line-through text-muted-foreground")}>
                                  {item.name}
                                </span>
                                
                                {/* Indicador de Tendencia Histórica */}
                                {trend && (
                                  <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold">
                                    {trend.status === 'up' && (
                                      <span className="text-red-600 flex items-center gap-0.5">
                                        <TrendingUp className="h-3 w-3" /> Subió (Antes: ${trend.lastPrice.toFixed(2)})
                                      </span>
                                    )}
                                    {trend.status === 'down' && (
                                      <span className="text-green-600 flex items-center gap-0.5">
                                        <TrendingDown className="h-3 w-3" /> Bajó (Antes: ${trend.lastPrice.toFixed(2)})
                                      </span>
                                    )}
                                    {trend.status === 'stable' && (
                                      <span className="text-muted-foreground flex items-center gap-0.5">
                                        <Minus className="h-3 w-3" /> Estable (${trend.lastPrice.toFixed(2)})
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItemInline(item.id, 'quantity', e.target.value)}
                                className="h-8 w-16 rounded-lg text-center p-1"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-xs text-muted-foreground">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.actual_unit_price !== null && item.actual_unit_price !== undefined ? item.actual_unit_price : ""}
                                  placeholder={item.estimated_unit_price > 0 ? item.estimated_unit_price.toString() : "0.00"}
                                  onChange={(e) => handleUpdateItemInline(item.id, 'actual_unit_price', e.target.value)}
                                  className="h-8 w-20 rounded-lg text-right p-1"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-sm">
                              ${(item.quantity * (item.actual_unit_price || 0)).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right pr-4 flex gap-1 justify-end">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-primary" 
                                onClick={() => handleViewHistory(item.name)}
                                title="Ver histórico de precios"
                              >
                                <History className="h-4 w-4" />
                              </Button>
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
        </>
      ) : (
        <Card className="p-8 text-center border-dashed border-2">
          <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">No tienes listas de compras</h3>
          <p className="text-sm text-muted-foreground mb-4">Crea tu primera lista para empezar a organizar tus compras del súper.</p>
          <Button onClick={() => setIsAddListDialogOpen(true)}>Crear Lista de Compras</Button>
        </Card>
      )}

      {/* Diálogo para Crear Lista */}
      <Dialog open={isAddListDialogOpen} onOpenChange={setIsAddListDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Nueva Lista de Compras</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateList} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="listName">Nombre de la Lista</Label>
              <Input 
                id="listName"
                value={newListName} 
                onChange={e => setNewListListName(e.target.value)} 
                placeholder="Ej. Despensa Mensual, Fiesta, etc." 
                required
                className="rounded-xl h-10"
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full rounded-xl h-11 font-bold">Crear Lista</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para Pegar Texto Masivo */}
      <Dialog open={isBulkAddDialogOpen} onOpenChange={setIsBulkAddDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[450px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Pegar Lista de Compras</DialogTitle>
            <DialogDescription>
              Escribe o pega tu lista. Detectaremos automáticamente las cantidades al inicio de cada línea.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBulkAdd} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Lista de Artículos (Uno por línea)</Label>
              <Textarea 
                value={bulkText} 
                onChange={e => setBulkText(e.target.value)} 
                placeholder="Ej:&#10;2 leches&#10;1.5 kg de manzanas&#10;Jabón de trastes&#10;3x aguacates" 
                rows={8}
                required
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label>Categoría para todos los artículos</Label>
              <Select value={bulkCategory} onValueChange={setBulkCategory}>
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder="Selecciona categoría (Opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full rounded-xl h-11 font-bold">Procesar y Añadir</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para Finalizar Compra (Cierre de Caja) */}
      <Dialog open={isFinalizeDialogOpen} onOpenChange={setIsFinalizeDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Finalizar Compra y Cuadrar Ticket</DialogTitle>
            <DialogDescription>
              Ingresa el total cobrado por el supermercado. Calcularemos la diferencia automáticamente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFinalizePurchase} className="grid gap-4 py-4">
            <div className="bg-primary/10 p-4 rounded-2xl text-center">
              <p className="text-xs text-muted-foreground uppercase font-bold">Suma de Artículos Marcados</p>
              <p className="text-2xl font-black text-primary-foreground">${totalInCart.toFixed(2)}</p>
            </div>

            <div className="grid gap-2">
              <Label>Total Cobrado en Caja (Ticket Real)</Label>
              <Input 
                type="number"
                step="0.01"
                value={finalizeForm.totalChargedByStore} 
                onChange={e => setExpenseForm({...finalizeForm, totalChargedByStore: e.target.value})} 
                required
                className="rounded-xl h-10 font-bold text-lg"
              />
            </div>

            {/* Mostrar diferencia en tiempo real */}
            {(() => {
              const charged = parseFloat(finalizeForm.totalChargedByStore) || 0;
              const diff = charged - totalInCart;
              if (Math.abs(diff) >= 0.01) {
                return (
                  <div className="flex items-center gap-2 text-xs bg-yellow-50 border border-yellow-200 p-3 rounded-xl text-yellow-800">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span>
                      Diferencia detectada: <b>${diff > 0 ? "+" : ""}{diff.toFixed(2)}</b>. Se guardará en la nota del gasto.
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            <div className="grid gap-2">
              <Label>Método de Pago</Label>
              <Select 
                value={finalizeForm.paymentMethod} 
                onValueChange={v => setExpenseForm({...finalizeForm, paymentMethod: v})}
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
              <Label>Categoría de Gasto</Label>
              <Select 
                value={finalizeForm.selectedCategoryId} 
                onValueChange={v => setExpenseForm({...finalizeForm, selectedCategoryId: v})}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Descripción del Gasto</Label>
              <Input 
                value={finalizeForm.description} 
                onChange={e => setExpenseForm({...finalizeForm, description: e.target.value})} 
                required
                className="rounded-xl h-10"
              />
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full rounded-xl h-11 font-bold" disabled={isSubmitting}>
                {isSubmitting ? "Procesando..." : "Confirmar y Registrar Gasto Único"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Historial de Precios */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[450px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Historial de Precios: {historyItemName}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {priceHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay registros de compras anteriores para este artículo.</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto border rounded-2xl">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Lista / Origen</TableHead>
                      <TableHead className="text-right">Precio Unitario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceHistory.map((hist, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs">{format(parseISO(hist.created_at), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-xs font-medium">{hist.list_name}</TableCell>
                        <TableCell className="text-right font-bold text-xs">${hist.actual_unit_price.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)} className="w-full rounded-xl">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para Compartir */}
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