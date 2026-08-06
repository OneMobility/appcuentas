"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, ShoppingCart, CheckCircle2, FileText, Share2, Copy, MessageSquare, Search, AlertCircle, ListPlus, History, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { useCategoryContext } from "@/context/CategoryContext";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";
import { format, parseISO } from "date-fns";

const GIF_SUPER = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/cart.gif";

interface ShoppingListType {
  id: string;
  name: string;
  status: string;
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
  category_id?: string | null;
}

interface PriceHistoryItem {
  actual_unit_price: number;
  created_at: string;
  list_name: string;
}

const ShoppingList: React.FC = () => {
  const { user } = useSession();
  const { expenseCategories } = useCategoryContext();
  
  const [lists, setLists] = useState<ShoppingListType[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  
  const [isAddListDialogOpen, setIsAddListDialogOpen] = useState(false);
  const [isBulkAddDialogOpen, setIsBulkAddDialogOpen] = useState(false);
  const [isFinalizeDialogOpen, setIsFinalizeDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  const [newListName, setNewListListName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: "1",
    estimated_unit_price: "",
    category_id: "",
  });

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
  const [sharePhone, setSharePhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim() || !selectedListId || !user) return;

    const lines = bulkText.split("\n");
    const itemsToInsert: any[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

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

  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase.from('shopping_items').delete().eq('id', itemId);
    if (error) showError("Error al eliminar artículo.");
    else {
      setItems(prev => prev.filter(i => i.id !== itemId));
      showSuccess("Artículo eliminado.");
    }
  };

  const handleUpdateItemInline = async (itemId: string, field: 'quantity' | 'actual_unit_price', value: string) => {
    const parsedValue = parseFloat(value);
    const updateData = { [field]: isNaN(parsedValue) ? null : parsedValue };

    setItems(prev => prev.map(item => item.id === itemId ? { ...item, ...updateData } : item));

    await supabase
      .from('shopping_items')
      .update(updateData)
      .eq('id', itemId);
  };

  const handleToggleCart = async (itemId: string, isChecked: boolean) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
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

  const totalInCart = useMemo(() => {
    return items
      .filter(i => i.is_completed)
      .reduce((sum, i) => sum + (i.quantity * (i.actual_unit_price || 0)), 0);
  }, [items]);

  const handleOpenAdd = () => {
    const currentList = lists.find(l => l.id === selectedListId);
    setExpenseForm({
      totalChargedByStore: totalInCart.toFixed(2),
      paymentMethod: "cash",
      selectedCategoryId: expenseCategories[0]?.id || "",
      description: `Compra Súper: ${currentList?.name || "Despensa"}`,
    });
    setIsFinalizeDialogOpen(true);
  };

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
    
    let finalDescription = finalizeForm.description;
    if (Math.abs(difference) >= 0.01) {
      finalDescription += ` (Diferencia de cuadre: ${difference > 0 ? "+" : ""}${difference.toFixed(2)})`;
    }

    try {
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

  const handleViewHistory = (itemName: string) => {
    const key = itemName.trim().toLowerCase();
    const history = globalPriceHistories[key] || [];
    setHistoryItemName(itemName);
    setPriceHistory(history);
    setIsHistoryDialogOpen(true);
  };

  const getPriceTrend = (itemName: string, currentPrice: number) => {
    const key = itemName.trim().toLowerCase();
    const history = globalPriceHistories[key];
    if (!history || history.length === 0) return null;

    const prices = history.slice(0, 3).map(h => h.actual_unit_price);
    
    if (prices.length < 1) return null;

    const lastPrice = prices[0];
    if (currentPrice === 0) return { lastPrice, status: 'stable' as const, label: "Estable" };

    if (currentPrice > lastPrice + 0.05) {
      return { lastPrice, status: 'up' as const, label: "Subió" };
    } else if (currentPrice < lastPrice - 0.05) {
      return { lastPrice, status: 'down' as const, label: "Bajó" };
    }
    return { lastPrice, status: 'stable' as const, label: "Estable" };
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [items, searchTerm]);

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
    }

    if (completed.length > 0) {
      text += `\n✅ *Ya comprados:*\n`;
      completed.forEach(i => {
        text += `✓ ~${i.name}~\n`;
      });
    }

    text += `\nOrganizado con Oinkash 🐷`;
    return text;
  };

  return (
    <div className="flex flex-col gap-6 p-2 sm:p-4 md:p-6 pb-24 max-w-5xl mx-auto">
      <header className="relative">
        <div className="absolute inset-0 bg-blue-100/50 blur-3xl rounded-full -z-10" />
        <Card className="bg-blue-600 text-white rounded-3xl md:rounded-[2.5rem] border-none shadow-xl overflow-hidden">
          <div className="p-6 md:p-8 relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-4 flex-1 text-center md:text-left w-full">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Lista del Súper 🐷</p>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center justify-center md:justify-start gap-2">
                  <ShoppingCart className="h-7 w-7 shrink-0" /> {lists.find(l => l.id === selectedListId)?.name || "Tu Despensa"}
                </h1>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2 w-full">
                <Select value={selectedListId} onValueChange={setSelectedListId}>
                  <SelectTrigger className="w-full max-w-[220px] rounded-xl h-10 bg-white/10 border-white/20 text-white font-bold">
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
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-white/10 border-white/20 hover:bg-white/20 shrink-0" onClick={() => setIsAddListDialogOpen(true)}>
                  <ListPlus className="h-5 w-5 text-white" />
                </Button>
              </div>
            </div>
            <div className="flex-shrink-0">
              <img src={GIF_SUPER} alt="Súper" className="h-28 w-28 md:h-32 md:w-32 object-contain" />
            </div>
          </div>
        </Card>
      </header>

      {selectedListId ? (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <Card className="border-l-4 border-primary bg-primary/10 text-primary">
              <CardContent className="p-4">
                <p className="text-xs font-bold text-blue-900 uppercase">Total en Carrito (Marcados)</p>
                <div className="text-3xl font-black text-blue-900 mt-1">${totalInCart.toFixed(2)}</div>
                <p className="text-xs text-blue-800/70 mt-1 font-medium">Suma acumulada de lo que llevas marcado</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800 flex flex-col justify-between">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-yellow-800 uppercase">Progreso</p>
                  <div className="text-2xl font-black mt-0.5">
                    {items.filter(i => i.is_completed).length} / {items.length}
                  </div>
                  <p className="text-xs text-yellow-700">Artículos marcados</p>
                </div>
                {items.filter(i => i.is_completed).length > 0 && (
                  <Button onClick={handleOpenAdd} className="rounded-xl font-bold bg-yellow-600 hover:bg-yellow-700 text-white h-10 text-xs">
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Finalizar
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Buscar artículo..." 
                className="pl-9 h-10 rounded-xl bg-white border-slate-200 text-sm" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-none h-10 rounded-xl font-bold text-xs" onClick={() => setIsBulkAddDialogOpen(true)}>
                <FileText className="h-4 w-4 mr-1" /> Pegar Lista
              </Button>
              <Button variant="outline" className="h-10 w-10 rounded-xl p-0" onClick={() => setIsShareDialogOpen(true)}>
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Formulario Añadir Producto Individual (Mobile Responsive) */}
          <Card className="p-4 rounded-2xl border-slate-100 shadow-sm bg-white">
            <form onSubmit={handleAddSingleItem} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4 space-y-1">
                <Label className="text-xs font-bold text-slate-600">Artículo</Label>
                <Input 
                  placeholder="Ej. Leche, Pan..." 
                  value={newItem.name} 
                  onChange={e => setNewItem({...newItem, name: e.target.value})} 
                  required
                  className="rounded-xl h-10 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:col-span-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-600">Cantidad</Label>
                  <Input 
                    type="number" 
                    step="0.1" 
                    value={newItem.quantity} 
                    onChange={e => setNewItem({...newItem, quantity: e.target.value})} 
                    required
                    className="rounded-xl h-10 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-600">Precio Est. ($)</Label>
                  <Input 
                    placeholder="0.00" 
                    value={newItem.estimated_unit_price} 
                    onChange={e => setNewItem({...newItem, estimated_unit_price: e.target.value})} 
                    className="rounded-xl h-10 text-sm"
                  />
                </div>
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label className="text-xs font-bold text-slate-600">Categoría</Label>
                <Select value={newItem.category_id} onValueChange={v => setNewItem({...newItem, category_id: v})}>
                  <SelectTrigger className="rounded-xl h-10 text-sm">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="sm:col-span-1 h-10 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white">
                +
              </Button>
            </form>
          </Card>

          {/* Tabla de Artículos Adaptable */}
          <Card className="shadow-sm overflow-hidden rounded-2xl border-slate-100 bg-white">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] pl-3">Listo</TableHead>
                      <TableHead>Artículo</TableHead>
                      <TableHead className="w-[80px]">Cant.</TableHead>
                      <TableHead className="w-[100px] text-right">Precio</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right pr-3">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                          No hay artículos en esta lista.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map(item => {
                        const currentPrice = item.actual_unit_price || 0;
                        const trend = getPriceTrend(item.name, currentPrice);

                        return (
                          <TableRow key={item.id} className={cn(item.is_completed && "bg-blue-50/30")}>
                            <TableCell className="pl-3">
                              <Checkbox 
                                checked={item.is_completed} 
                                onCheckedChange={(checked) => handleToggleCart(item.id, !!checked)}
                                className="h-5 w-5 rounded-md"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className={cn("font-bold text-xs sm:text-sm", item.is_completed && "line-through text-slate-400")}>
                                  {item.name}
                                </span>
                                
                                {trend && (
                                  <div className="flex items-center gap-1 mt-0.5 text-[9px] font-semibold">
                                    {trend.status === 'up' && (
                                      <span className="text-rose-600 flex items-center gap-0.5">
                                        <TrendingUp className="h-2.5 w-2.5" /> Subió (${trend.lastPrice.toFixed(2)})
                                      </span>
                                    )}
                                    {trend.status === 'down' && (
                                      <span className="text-emerald-600 flex items-center gap-0.5">
                                        <TrendingDown className="h-2.5 w-2.5" /> Bajó (${trend.lastPrice.toFixed(2)})
                                      </span>
                                    )}
                                    {trend.status === 'stable' && (
                                      <span className="text-slate-400 flex items-center gap-0.5">
                                        <Minus className="h-2.5 w-2.5" /> Estable
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
                                className="h-8 w-14 rounded-lg text-center p-1 text-xs"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-[10px] text-slate-400">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.actual_unit_price !== null && item.actual_unit_price !== undefined ? item.actual_unit_price : ""}
                                  placeholder={item.estimated_unit_price > 0 ? item.estimated_unit_price.toString() : "0.00"}
                                  onChange={(e) => handleUpdateItemInline(item.id, 'actual_unit_price', e.target.value)}
                                  className="h-8 w-16 rounded-lg text-right p-1 text-xs"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-xs sm:text-sm">
                              ${(item.quantity * (item.actual_unit_price || 0)).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right pr-3">
                              <div className="flex gap-1 justify-end">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-indigo-600 hover:bg-indigo-50 rounded-lg" 
                                  onClick={() => handleViewHistory(item.name)}
                                  title="Ver historial de precios"
                                >
                                  <History className="h-3.5 w-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-rose-600 hover:bg-rose-50 rounded-lg" 
                                  onClick={() => handleDeleteItem(item.id)}
                                  title="Eliminar ítem"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
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
        <Card className="p-8 text-center border-dashed border-2 rounded-3xl bg-white">
          <ShoppingCart className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold mb-1">No tienes listas activas</h3>
          <p className="text-xs text-slate-400 mb-4">Crea una lista para comenzar tus compras.</p>
          <Button onClick={() => setIsAddListDialogOpen(true)} className="rounded-xl font-bold">
            Crear Lista
          </Button>
        </Card>
      )}

      {/* DIÁLOGOS DE APOYO */}
      <Dialog open={isAddListDialogOpen} onOpenChange={setIsAddListDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Nueva Lista de Compras</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateList} className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="listName" className="text-xs font-bold text-slate-600">Nombre de la Lista</Label>
              <Input 
                id="listName"
                value={newListName} 
                onChange={e => setNewListListName(e.target.value)} 
                placeholder="Ej. Súper Quincenal" 
                required
                className="rounded-xl h-11"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full rounded-xl h-12 font-bold">Crear Lista</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkAddDialogOpen} onOpenChange={setIsBulkAddDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[450px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Pegar Lista Completa</DialogTitle>
            <DialogDescription className="text-xs">Escribe un artículo por línea.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBulkAdd} className="grid gap-4 py-2">
            <div className="space-y-1">
              <Textarea 
                value={bulkText} 
                onChange={e => setBulkText(e.target.value)} 
                placeholder="2 leches&#10;1 kg de carne&#10;Pan molido" 
                rows={6}
                required
                className="rounded-xl text-sm"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full rounded-xl h-12 font-bold">Añadir Todos</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isFinalizeDialogOpen} onOpenChange={setIsFinalizeDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Finalizar Compra</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFinalizePurchase} className="grid gap-4 py-2">
            <div className="bg-primary/10 p-4 rounded-2xl text-center">
              <p className="text-[10px] font-bold text-blue-900 uppercase">Marcado en Carrito</p>
              <p className="text-2xl font-black text-blue-900">${totalInCart.toFixed(2)}</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">Total Cobrado Real ($)</Label>
              <Input 
                type="number"
                step="0.01"
                value={finalizeForm.totalChargedByStore} 
                onChange={e => setExpenseForm({...finalizeForm, totalChargedByStore: e.target.value})} 
                required
                className="rounded-xl h-12 font-bold text-base"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">Método de Pago</Label>
              <Select value={finalizeForm.paymentMethod} onValueChange={v => setExpenseForm({...finalizeForm, paymentMethod: v})}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo (${cashBalance.toFixed(2)})</SelectItem>
                  {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.bank_name})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full rounded-xl h-12 font-bold" disabled={isSubmitting}>
                {isSubmitting ? "Procesando..." : "Confirmar y Guardar Gasto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[420px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-600" /> Histórico: {historyItemName}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {priceHistory.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No hay registros de compras pasadas para este producto.</p>
            ) : (
              <div className="max-h-[250px] overflow-y-auto border rounded-2xl">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Fecha</TableHead>
                      <TableHead className="text-[10px]">Lista</TableHead>
                      <TableHead className="text-right text-[10px]">Precio Unitario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceHistory.map((hist, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs">{format(parseISO(hist.created_at), "dd/MM/yy")}</TableCell>
                        <TableCell className="text-xs font-medium truncate max-w-[120px]">{hist.list_name}</TableCell>
                        <TableCell className="text-right font-bold text-xs">${hist.actual_unit_price.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)} className="w-full rounded-xl h-10">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShoppingList;