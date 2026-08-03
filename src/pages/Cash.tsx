"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  PlusCircle, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Edit, 
  Search, 
  Scale, 
  ArrowUpCircle, 
  ArrowDownCircle,
  Wallet,
  ArrowRightLeft,
  History,
  Coins
} from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { useCategoryContext } from "@/context/CategoryContext";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import CashReconciliationDialog from "@/components/CashReconciliationDialog";
import CardTransferDialog from "@/components/CardTransferDialog";
import { motion } from "framer-motion";
import { getContrastColor } from "@/utils/color-helpers";

const Cash = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, getCategoryById, isLoadingCategories } = useCategoryContext();
  
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "ingreso" | "egreso">("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReconcileDialogOpen, setIsReconcileDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  const [currency, setCurrency] = useState<"MXN" | "USD">("MXN");
  const [usdToMxnRate, setUsdToMxnRate] = useState<number>(20.00);

  const [transactionForm, setTransactionForm] = useState({
    type: "ingreso" as "ingreso" | "egreso",
    amount: "",
    description: "",
    selectedCategoryId: "",
    imageUrl: "",
  });

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const { fetchUsdToMxnRate } = await import("@/utils/currency-helper");
        const rate = await fetchUsdToMxnRate();
        setUsdToMxnRate(rate);
      } catch (e) {
        console.error("No se pudo obtener la tasa en efectivo:", e);
      }
    };
    fetchRate();
  }, [isAddDialogOpen, isEditDialogOpen]);

  const fetchData = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('cash_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      showError('Error al cargar transacciones: ' + error.message);
    } else {
      let current = 0;
      const computed = (data || []).map(tx => {
        current = tx.type === "ingreso" ? current + tx.amount : current - tx.amount;
        return { ...tx, runningBalance: current };
      });
      setTransactions([...computed].reverse());
      setBalance(current);
    }

    const { data: cardsData } = await supabase.from('cards').select('*').eq('user_id', user.id);
    setCards(cardsData || []);
  };

  useEffect(() => {
    if (user && !isLoadingCategories) fetchData();
  }, [user, isLoadingCategories]);

  const monthStats = useMemo(() => {
    const start = startOfMonth(currentViewDate);
    const end = endOfMonth(currentViewDate);
    const monthTxs = transactions.filter(tx => isWithinInterval(parseISO(tx.date), { start, end }));
    
    const ingresos = monthTxs.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
    const egresos = monthTxs.filter(t => t.type === 'egreso').reduce((s, t) => s + t.amount, 0);
    
    return { ingresos, egresos };
  }, [transactions, currentViewDate]);

  const filteredTransactions = useMemo(() => {
    const start = startOfMonth(currentViewDate);
    const end = endOfMonth(currentViewDate);
    return transactions.filter(tx => {
      const txDate = parseISO(tx.date);
      const matchesDate = isWithinInterval(txDate, { start, end });
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      return matchesDate && matchesSearch && matchesType;
    });
  }, [transactions, currentViewDate, searchTerm, filterType]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredTransactions.forEach(tx => {
      if (!groups[tx.date]) groups[tx.date] = [];
      groups[tx.date].push(tx);
    });
    return groups;
  }, [filteredTransactions]);

  const handleOpenAdd = () => {
    setCurrency("MXN");
    setTransactionForm({
      type: "egreso",
      amount: "",
      description: "",
      selectedCategoryId: "",
      imageUrl: "",
    });
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (tx: any) => {
    setCurrency("MXN");
    setEditingTransaction(tx);
    setTransactionForm({
      type: tx.type,
      amount: tx.amount.toString(),
      description: tx.description,
      selectedCategoryId: tx.income_category_id || tx.expense_category_id || "",
      imageUrl: tx.image_url || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let baseAmount: number;
    if (transactionForm.amount.startsWith('=')) {
      baseAmount = evaluateExpression(transactionForm.amount.substring(1)) || 0;
    } else {
      baseAmount = parseFloat(transactionForm.amount);
    }

    if (isNaN(baseAmount) || baseAmount <= 0) {
      showError("Monto inválido");
      return;
    }

    let finalAmount = baseAmount;
    let finalDescription = transactionForm.description;
    if (currency === "USD") {
      finalAmount = baseAmount * usdToMxnRate;
      finalDescription += ` (Reg: $${baseAmount.toFixed(2)} USD a tasa $${usdToMxnRate.toFixed(2)} MXN)`;
    }

    setIsSubmitting(true);
    const txData = {
      user_id: user.id,
      type: transactionForm.type,
      amount: finalAmount,
      description: finalDescription,
      date: editingTransaction ? editingTransaction.date : getLocalDateString(new Date()),
      income_category_id: transactionForm.type === "ingreso" ? transactionForm.selectedCategoryId : null,
      expense_category_id: transactionForm.type === "egreso" ? transactionForm.selectedCategoryId : null,
      image_url: transactionForm.imageUrl,
    };

    try {
      let error;
      if (editingTransaction) {
        const { error: updateError } = await supabase.from('cash_transactions').update(txData).eq('id', editingTransaction.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('cash_transactions').insert(txData);
        error = insertError;
      }

      if (error) throw error;

      showSuccess(editingTransaction ? "Movimiento actualizado" : "Movimiento registrado");
      setIsAddDialogOpen(false);
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      fetchData();
    } catch (err: any) {
      showError("Error al guardar: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (tx: any) => {
    try {
      const { error } = await supabase.from('cash_transactions').delete().eq('id', tx.id);
      if (error) throw error;
      showSuccess("Movimiento eliminado");
      fetchData();
    } catch (err: any) {
      showError("Error al eliminar: " + err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 pb-24 max-w-4xl mx-auto">
      
      {/* HEADER: BILLETERA VISUAL */}
      <header className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full -z-10" />
        <Card className="bg-slate-950 text-white rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
          <div className="p-8 space-y-6 relative">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Wallet className="h-32 w-32 rotate-12" />
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo Total en Efectivo</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black tracking-tighter">${balance.toLocaleString()}</span>
                <span className="text-xl font-bold text-slate-500">MXN</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ArrowUpCircle className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold uppercase text-slate-500">Entradas</span>
                  <span className="text-sm font-black text-emerald-400">+${monthStats.ingresos.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
                  <ArrowDownCircle className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold uppercase text-slate-500">Salidas</span>
                  <span className="text-sm font-black text-rose-400">-${monthStats.egresos.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </header>

      {/* ACCIONES RÁPIDAS (NUEVA SECCIÓN) */}
      <section className="grid grid-cols-2 gap-3 px-1">
        <Button 
          variant="outline" 
          onClick={() => setIsTransferDialogOpen(true)}
          className="rounded-2xl h-14 bg-white border-slate-100 shadow-sm flex flex-col items-center justify-center gap-0.5 hover:bg-slate-50 transition-all active:scale-95 group"
        >
          <ArrowRightLeft className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">Transferir</span>
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setIsReconcileDialogOpen(true)}
          className="rounded-2xl h-14 bg-white border-slate-100 shadow-sm flex flex-col items-center justify-center gap-0.5 hover:bg-slate-50 transition-all active:scale-95 group"
        >
          <Scale className="h-5 w-5 text-indigo-500 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">Cuadrar Saldo</span>
        </Button>
      </section>

      {/* CONTROLES Y FILTROS */}
      <section className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center bg-white p-1 rounded-2xl shadow-sm border w-full md:w-auto">
          <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10" onClick={() => setCurrentViewDate(subMonths(currentViewDate, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="px-4 text-sm font-black uppercase tracking-widest min-w-[120px] text-center">
            {format(currentViewDate, "MMMM yyyy", { locale: es })}
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10" onClick={() => setCurrentViewDate(addMonths(currentViewDate, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar..." className="pl-9 rounded-2xl h-11 border-none shadow-sm bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Button className="rounded-2xl h-11 px-6 font-black bg-primary shadow-lg shadow-primary/20 gap-2" onClick={handleOpenAdd}>
            <PlusCircle className="h-5 w-5" /> <span className="hidden sm:inline">Nuevo</span>
          </Button>
        </div>
      </section>

      {/* HISTORIAL */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 px-2">
          <History className="h-4 w-4 text-slate-400" />
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Movimientos</h3>
        </div>

        {filteredTransactions.length === 0 ? (
          <Card className="border-dashed border-2 p-12 flex flex-col items-center justify-center text-center bg-transparent opacity-50">
            <Coins className="h-8 w-8 text-slate-400 mb-2" />
            <p className="text-xs font-bold text-slate-500">Sin movimientos</p>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a)).map(dateStr => (
              <div key={dateStr} className="space-y-3">
                <div className="flex items-center gap-4 px-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">
                    {isSameDay(parseISO(dateStr), new Date()) ? 'Hoy' : format(parseISO(dateStr), "eee d 'de' MMM", { locale: es })}
                  </span>
                  <div className="h-px bg-slate-100 flex-1" />
                </div>

                <div className="grid gap-3">
                  {groupedByDate[dateStr].map(tx => {
                    const category = getCategoryById(tx.income_category_id || tx.expense_category_id);
                    return (
                      <div 
                        key={tx.id}
                        className="group bg-white p-4 rounded-3xl shadow-sm border border-slate-50 flex items-center justify-between hover:shadow-md transition-all active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-4 overflow-hidden">
                          <div 
                            className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"
                            style={{ 
                              backgroundColor: category?.color || '#f1f5f9',
                              color: getContrastColor(category?.color || '#f1f5f9')
                            }}
                          >
                            <DynamicLucideIcon iconName={category?.icon || "Tag"} className="h-5 w-5" />
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="font-black text-slate-900 text-sm truncate">{tx.description}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{category?.name || "Sin categoría"}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right flex flex-col">
                            <span className={cn(
                              "text-base font-black tracking-tight",
                              tx.type === 'egreso' ? 'text-rose-500' : 'text-emerald-500'
                            )}>
                              {tx.type === 'egreso' ? '-' : '+'}${tx.amount.toLocaleString()}
                            </span>
                            <span className="text-[8px] font-bold text-slate-300 uppercase">Saldo: ${tx.runningBalance.toLocaleString()}</span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <PlusCircle className="h-4 w-4 text-slate-300 rotate-45" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem onClick={() => handleOpenEdit(tx)} className="text-xs font-bold gap-2">
                                <Edit className="h-3.5 w-3.5" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteTransaction(tx)} className="text-xs font-bold gap-2 text-rose-500 focus:text-rose-500">
                                <Trash2 className="h-3.5 w-3.5" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* DIÁLOGO MOVIMIENTO */}
      <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => { if(!open) { setIsAddDialogOpen(false); setIsEditDialogOpen(false); setEditingTransaction(null); } }}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-[2.5rem] p-8">
          <DialogHeader><DialogTitle className="text-2xl font-black tracking-tight">{editingTransaction ? "Editar" : "Nuevo"} Movimiento</DialogTitle></DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-6 py-4">
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-2xl">
                <Button 
                  type="button" 
                  variant={transactionForm.type === 'ingreso' ? 'default' : 'ghost'}
                  className={cn("rounded-xl font-bold h-10", transactionForm.type === 'ingreso' && "bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-200")}
                  onClick={() => setTransactionForm({...transactionForm, type: 'ingreso'})}
                >Entrada</Button>
                <Button 
                  type="button" 
                  variant={transactionForm.type === 'egreso' ? 'default' : 'ghost'}
                  className={cn("rounded-xl font-bold h-10", transactionForm.type === 'egreso' && "bg-rose-500 hover:bg-rose-600 shadow-md shadow-rose-200")}
                  onClick={() => setTransactionForm({...transactionForm, type: 'egreso'})}
                >Salida</Button>
              </div>
            </div>
            
            <div className="grid gap-2">
               <div className="flex justify-between items-center mb-1">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Monto</Label>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-[9px] gap-1">
                  <button type="button" onClick={() => setCurrency("MXN")} className={cn("px-2 py-0.5 rounded-md font-bold", currency === "MXN" ? "bg-white shadow-sm" : "text-slate-400")}>MXN</button>
                  <button type="button" onClick={() => setCurrency("USD")} className={cn("px-2 py-0.5 rounded-md font-bold", currency === "USD" ? "bg-white shadow-sm" : "text-slate-400")}>USD</button>
                </div>
              </div>
              <div className="relative">
                <Input value={transactionForm.amount} onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})} className="rounded-2xl h-14 text-xl font-black bg-slate-50 border-none pr-12 focus-visible:ring-primary/20" placeholder="0.00" required />
                <span className="absolute right-4 top-4 text-xs font-black text-slate-300">{currency}</span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Descripción</Label>
              <Input value={transactionForm.description} onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} className="rounded-2xl h-12 bg-slate-50 border-none focus-visible:ring-primary/20 font-bold" placeholder="¿En qué lo usaste?" required />
            </div>

            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Categoría</Label>
              <Select value={transactionForm.selectedCategoryId} onValueChange={(v) => setTransactionForm({...transactionForm, selectedCategoryId: v})}>
                <SelectTrigger className="rounded-2xl h-12 bg-slate-50 border-none focus-visible:ring-primary/20 font-bold">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {(transactionForm.type === "egreso" ? expenseCategories : incomeCategories).map(cat => (
                    <SelectItem key={cat.id} value={cat.id} className="rounded-xl">
                      <div className="flex items-center gap-2"><DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-4 w-4" /> {cat.name}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter><Button type="submit" className="w-full rounded-2xl font-black h-14 text-lg shadow-xl shadow-primary/20" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Confirmar Movimiento"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGOS DE APOYO */}
      <CardTransferDialog isOpen={isTransferDialogOpen} onClose={() => setIsTransferDialogOpen(false)} cards={cards} cashBalance={balance} onTransferSuccess={fetchData} />
      <CashReconciliationDialog isOpen={isReconcileDialogOpen} onClose={() => setIsReconcileDialogOpen(false)} appBalance={balance} transactionCount={transactions.length} onReconciliationSuccess={fetchData} onNoAdjustmentSuccess={() => showSuccess("Saldo cuadrado.")} />
    </div>
  );
};

export default Cash;