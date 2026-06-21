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
import { PlusCircle, Trash2, ShoppingCart, CheckCircle2, DollarSign, ArrowRightLeft, FileText, Share2, Copy, MessageSquare, Filter, Search, AlertCircle, ListPlus, History, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { useCategoryContext } from "@/context/CategoryContext";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
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
  actual_unit_price?: number;
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
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
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

  const [selectedItemForExpense, setSelectedItemForExpense] = useState<ShoppingItem | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    quantity: "1",
    unitPrice: "",
    totalPrice: "",
    paymentMethod: "cash",
    description: "",
  });

  const [historyItemName, setHistoryItemName] = useState("");
  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [globalPriceHistories, setGlobalPriceHistories] = useState<Record<string, PriceHistoryItem[]>>({});

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("all");
  const [sharePhone, setSharePhone] = useState("");

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
      // Cargar históricos de precios para los artículos de esta lista
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

  // Cargar históricos de precios de forma masiva para comparar
  const fetchGlobalPriceHistories = async (itemNames: string[]) => {
    if (!user || itemNames.length === 0) return;
    
    // Eliminar duplicados
    const uniqueNames = Array.from(new Set(itemNames.map(n => n.trim().toLowerCase())));

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

  // Iniciar proceso de marcar como completado (abre calculadora de compra)
  const handleToggleComplete = (item: ShoppingItem) => {
    if (!item.is_completed) {
      setSelectedItemForExpense(item);
      setExpenseForm({
        quantity: item.quantity.toString(),
        unitPrice: item.estimated_unit_price > 0 ? item.estimated_unit_price.toString() : "",
        totalPrice: item.estimated_unit_price > 0 ? (item.quantity * item.estimated_unit_price).toString() : "",
        paymentMethod: "cash",
        description: `Compra: ${item.name}`,
      });
      setIsExpenseDialogOpen(true);
    } else {
      // Desmarcar
      supabase.from('shopping_items')
        .update({ is_completed: false, actual_unit_price: null })
        .eq('id', item.id)
        .then(({ error }) => {
          if (error) showError("Error al actualizar.");
          else {
            fetchItems();
            showSuccess("Artículo marcado como pendiente.");
          }
        });
    }
  };

  // Sincronizar cálculos en el formulario de compra
  const handleExpenseFormChange = (field: 'quantity' | 'unitPrice' | 'totalPrice', value: string) => {
    setExpenseForm(prev => {
      const updated = { ...prev, [field]: value };
      const qty = parseFloat(updated.quantity) || 0;
      
      if (field === 'quantity' || field === 'unitPrice') {
        const unit = parseFloat(updated.unitPrice) || 0;
        updated.totalPrice = (qty * unit).toFixed(2);
      } else if (field === 'totalPrice') {
        const total = parseFloat(updated.totalPrice) || 0;
        updated.unitPrice = qty > 0 ? (total / qty).toFixed(2) : "0";
      }
      return updated;
    });
  };

  // Confirmar compra y registrar gasto financiero
  const handleConfirmExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedItemForExpense) return;

    const qty = parseFloat(expenseForm.quantity) || 1;
    const unitPrice = parseFloat(expenseForm.unitPrice) || 0;
    const total = qty * unitPrice;

    if (total <= 0) {
      showError("El monto total debe ser mayor a cero.");
      return;
    }

    const transactionDate = getLocalDateString(new Date());

    try {
      // 1. Registrar transacción en Supabase
      if (expenseForm.paymentMethod === "cash") {
        const { error } = await supabase.from('cash_transactions').insert({
          user_id: user.id,
          type: "egreso",
          amount: total,
          description: expenseForm.description,
          date: transactionDate,
          expense_category_id: selectedItemForExpense.category_id || null,
        });
        if (error) throw error;
      } else {
        const card = cards.find(c => c.id === expenseForm.paymentMethod);
        if (card) {
          const newCardBalance = card.type === "credit" 
            ? card.current_balance + total 
            : card.current_balance - total;

          const { error: cardUpdateError } = await supabase
            .from('cards')
            .update({ current_balance: newCardBalance })
            .eq('id', card.id);
          if (cardUpdateError) throw cardUpdateError;

          const { error: txError } = await supabase.from('card_transactions').insert({
            user_id: user.id,
            card_id: card.id,
            type: "charge",
            amount: total,
            description: expenseForm.description,
            date: transactionDate,
            expense_category_id: selectedItemForExpense.category_id || null,
          });
          if (txError) throw txError;
        }
      }

      // 2. Actualizar artículo en la lista de compras
      const { error: itemError } = await supabase
        .from('shopping_items')
        .update({
          is_completed: true,
          quantity: qty,
          actual_unit_price: unitPrice
        })
        .eq('id', selectedItemForExpense.id);

      if (itemError) throw itemError;

      showSuccess("¡Compra registrada y gasto guardado!");
      setIsExpenseDialogOpen(false);
      setSelectedItemForExpense(null);
      fetchItems();
      fetchFinancialData();
    } catch (error: any) {
      showError("Error al procesar compra: " + error.message);
    }
  };

  // Marcar como comprado sin registrar gasto financiero
  const handleSkipExpense = async () => {
    if (!selectedItemForExpense) return;
    const qty = parseFloat(expenseForm.quantity) || 1;
    const unitPrice = parseFloat(expenseForm.unitPrice) || 0;

    const { error } = await supabase
      .from('shopping_items')
      .update({
        is_completed: true,
        quantity: qty,
        actual_unit_price: unitPrice > 0 ? unitPrice : null
      })
      .eq('id', selectedItemForExpense.id);

    if (error) {
      showError("Error al actualizar artículo.");
    } else {
      showSuccess("Artículo marcado como comprado.");
      setIsExpenseDialogOpen(false);
      setSelectedItemForExpense(null);
      fetchItems();
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

  // Comparar precio actual con el último registrado
  const getPriceComparison = (itemName: string, currentPrice: number) => {
    const key = itemName.trim().toLowerCase();
    const history = globalPriceHistories[key];
    if (!history || history.length === 0) return null;

    const lastPrice = history[0].actual_unit_price;
    if (currentPrice === 0) return { lastPrice, diff: 0, status: 'none' as const };

    const diffPercent = ((currentPrice - lastPrice) / lastPrice) * 100;
    
    if (diffPercent > 1) {
      return { lastPrice, diff: diffPercent, status: 'up' as const };
    } else if (diffPercent < -1) {
      return { lastPrice, diff: Math.abs(diffPercent), status: 'down' as const };
    }
    return { lastPrice, diff: 0, status: 'equal' as const };
  };

  // Filtrar artículos
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === "all" || item.category_id === filterCategory;
      const matchesStatus = filterStatus === "all" || 
                            (filterStatus === "pending" && !item.is_completed) || 
                            (filterStatus === "completed" && item.is_completed);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, searchTerm, filterCategory, filterStatus]);

  // Métricas de la lista seleccionada
  const metrics = useMemo(() => {
    const pending = items.filter(i => !i.is_completed);
    const completed = items.filter(i => i.is_completed);
    
    const estimatedPendingTotal = pending.reduce((sum, i) => sum + (i.quantity * i.estimated_unit_price), 0);
    const actualCompletedTotal = completed.reduce((sum, i) => sum + (i.quantity * (i.actual_unit_price || i.estimated_unit_price)), 0);

    return {
      pendingCount: pending.length,
      completedCount: completed.length,
      estimatedPendingTotal,
      actualCompletedTotal,
    };
  }, [items]);

  // Generar texto para compartir
  const generateShareText = () => {
    const currentList = lists.find(l => l.id === selectedListId);
    let text = `🛒 *LISTA DE COMPRAS: ${currentList?.name.toUpperCase() || "OINKASH"}*\n\n`;
    const pending = items.filter(i => !i.is_completed);
    const completed = items.filter(i => i.is_completed);

    if (pending.length > 0) {
      text += `📝 *Pendientes por comprar:*\n`;
      pending.forEach(i => {
        text += `☐ ${i.quantity}x ${i.name} ${i.estimated_unit_price > 0 ? `(~ $${(i.quantity * i.estimated_unit_price).toFixed(2)})` : ""}\n`;
      });
      text += `\n💰 *Presupuesto estimado:* $${metrics.estimatedPendingTotal.toFixed(2)}\n`;
    } else {
      text += `🎉 ¡No hay artículos pendientes!\n`;
    }

    if (completed.length > 0) {
      text += `\n✅ *Ya comprados:*\n`;
      completed.slice(0, 10).forEach(i => {
        text += `✓ ~${i.name}~ ${i.actual_unit_price ? `($${(i.quantity * i.actual_unit_price).toFixed(2)})` : ""}\n`;
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
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
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
                  placeholder="Buscar artículo..." 
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
                  <Label>Cant.</Label>
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
                  <Label>Precio Est.</Label>
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
                      <TableHead className="text-right">Precio Unitario</TableHead>
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
                        const category = getCategoryById(item.category_id);
                        const currentPrice = item.is_completed ? (item.actual_unit_price || 0) : item.estimated_unit_price;
                        const comparison = getPriceComparison(item.name, currentPrice);

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
                                  {item.quantity}x {item.name}
                                </span>
                                
                                {/* Indicador de Comparación de Precios */}
                                {comparison && (
                                  <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold">
                                    {comparison.status === 'up' && (
                                      <span className="text-red-600 flex items-center gap-0.5">
                                        <TrendingUp className="h-3 w-3" /> Subió {comparison.diff.toFixed(0)}% (Antes: ${comparison.lastPrice.toFixed(2)})
                                      </span>
                                    )}
                                    {comparison.status === 'down' && (
                                      <span className="text-green-600 flex items-center gap-0.5">
                                        <TrendingDown className="h-3 w-3" /> Bajó {comparison.diff.toFixed(0)}% (Antes: ${comparison.lastPrice.toFixed(2)})
                                      </span>
                                    )}
                                    {comparison.status === 'equal' && (
                                      <span className="text-muted-foreground flex items-center gap-0.5">
                                        <Minus className="h-3 w-3" /> Mismo precio (${comparison.lastPrice.toFixed(2)})
                                      </span>
                                    )}
                                  </div>
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
                              ${currentPrice.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-sm">
                              ${(item.quantity * currentPrice).toFixed(2)}
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

      {/* Diálogo para Registrar Gasto al Comprar */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Registrar Gasto de Compra</DialogTitle>
            <DialogDescription>
              Ingresa la cantidad y el precio unitario real para calcular el total.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmExpense} className="grid gap-4 py-4">
            <div className="bg-primary/10 p-4 rounded-2xl text-center">
              <p className="text-xs text-muted-foreground uppercase font-bold">Artículo comprado</p>
              <p className="text-lg font-black text-primary-foreground">{selectedItemForExpense?.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Cantidad Real</Label>
                <Input 
                  type="number"
                  step="0.1"
                  value={expenseForm.quantity} 
                  onChange={e => handleExpenseFormChange('quantity', e.target.value)} 
                  required
                  className="rounded-xl h-10"
                />
              </div>
              <div className="grid gap-2">
                <Label>Precio Unitario</Label>
                <Input 
                  value={expenseForm.unitPrice} 
                  onChange={e => handleExpenseFormChange('unitPrice', e.target.value)} 
                  placeholder="0.00"
                  required
                  className="rounded-xl h-10"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Total Calculado</Label>
              <Input 
                value={expenseForm.totalPrice} 
                onChange={e => handleExpenseFormChange('totalPrice', e.target.value)} 
                placeholder="0.00"
                required
                className="rounded-xl h-10 font-bold text-primary-foreground"
              />
            </div>

            <div className="grid gap-2">
              <Label>Método de Pago</Label>
              <Select 
                value={expenseForm.paymentMethod} 
                onValueChange={v => setExpenseForm({...expenseForm, paymentMethod: v})}
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
                onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} 
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