"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, 
  Trash2, 
  Edit, 
  ArrowLeft, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Coins, 
  Plus, 
  History, 
  MessageSquare,
  Sparkles,
  FileDown,
  FileSpreadsheet,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  Eye
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
} from "recharts";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useCategoryContext } from "@/context/CategoryContext";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";
import { Badge } from "@/components/ui/badge";
import { fetchUsdToMxnRate } from "@/utils/currency-helper";
import { exportToCsv, exportBankStatementPdf } from "@/utils/export";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface DebtorTransaction {
  id: string;
  type: "charge" | "payment";
  amount: number;
  description: string;
  date: string;
  created_at: string;
  isInitial?: boolean;
}

interface Debtor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  phone?: string;
  due_date?: string;
  created_at: string;
  debtor_transactions: DebtorTransaction[];
}

const DebtorDetailsPage: React.FC = () => {
  const { debtorId } = useParams<{ debtorId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { incomeCategories } = useCategoryContext();
  
  const [debtor, setDebtor] = useState<Debtor | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const [timeViewMode, setTimeViewMode] = useState<"all" | "month">("all");
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "charge" | "payment">("all");

  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isStatementPreviewOpen, setIsStatementPreviewOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [skipLinkedTransaction, setSkipLinkedTransaction] = useState(false);

  const [transactionForm, setTransactionForm] = useState({
    type: "payment" as "charge" | "payment",
    amount: "",
    description: "",
    destinationAccountId: "cash",
    selectedIncomeCategoryId: "",
  });

  const [currency, setCurrency] = useState<"MXN" | "USD">("MXN");
  const [usdToMxnRate, setUsdToMxnRate] = useState<number>(20.00);

  useEffect(() => {
    const fetchRate = async () => {
      const rate = await fetchUsdToMxnRate();
      setUsdToMxnRate(rate);
    };
    fetchRate();
  }, [isTransactionDialogOpen]);

  const fetchData = async () => {
    if (!user || !debtorId) return;
    setIsLoading(true);
    try {
      const { data: debtorData, error: debtorError } = await supabase
        .from('debtors')
        .select('*, debtor_transactions(*)')
        .eq('id', debtorId)
        .eq('user_id', user.id)
        .single();

      if (debtorError) throw debtorError;
      setDebtor(debtorData);

      const { data: cardsData } = await supabase.from('cards').select('*').eq('user_id', user.id);
      setCards(cardsData || []);

      const { data: cashTxData } = await supabase.from('cash_transactions').select('type, amount').eq('user_id', user.id);
      setCashBalance((cashTxData || []).reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0));

      if (incomeCategories.length > 0) {
        setTransactionForm(prev => ({ ...prev, selectedIncomeCategoryId: incomeCategories[0].id }));
      }
    } catch (error: any) {
      showError('Error al cargar detalles: ' + error.message);
      navigate('/debtors');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [debtorId, user, incomeCategories]);

  // Construir historial completo sin duplicar saldo inicial
  const allTimelineTransactions = useMemo(() => {
    if (!debtor) return [];

    const list: DebtorTransaction[] = [...(debtor.debtor_transactions || [])];

    // Verificar si ya existe un cargo registrado en transacciones que represente la apertura inicial
    const hasInitialTx = list.some(t => 
      t.description.toLowerCase().includes("inicial") || 
      t.description.toLowerCase().includes("apertura")
    );

    // Solo agregar el registro virtual si initial_balance > 0 y NO existe en la lista de transacciones
    if (debtor.initial_balance > 0 && !hasInitialTx) {
      list.push({
        id: "initial-balance-record",
        type: "charge",
        amount: debtor.initial_balance,
        description: "Préstamo inicial / Apertura de cuenta",
        date: debtor.created_at ? getLocalDateString(parseISO(debtor.created_at)) : getLocalDateString(new Date()),
        created_at: debtor.created_at || new Date().toISOString(),
        isInitial: true
      });
    }

    const sortedAsc = list.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    let running = 0;
    const withBalances = sortedAsc.map(tx => {
      if (tx.type === "charge") running += tx.amount;
      else running -= tx.amount;
      return { ...tx, runningBalance: running };
    });

    return withBalances.reverse();
  }, [debtor]);

  const filterInterval = useMemo(() => ({
    start: startOfMonth(currentViewDate),
    end: endOfMonth(currentViewDate)
  }), [currentViewDate]);

  const filteredTransactions = useMemo(() => {
    return allTimelineTransactions.filter(tx => {
      const matchesDate = timeViewMode === "all" || isWithinInterval(parseISO(tx.date), filterInterval);
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      return matchesDate && matchesSearch && matchesType;
    });
  }, [allTimelineTransactions, timeViewMode, filterInterval, searchTerm, filterType]);

  // Cálculo canónico y matemático: Total Cargos, Total Abonos y Saldo Pendiente exacto
  const stats = useMemo(() => {
    const charges = allTimelineTransactions
      .filter(t => t.type === 'charge')
      .reduce((s, t) => s + t.amount, 0);

    const payments = allTimelineTransactions
      .filter(t => t.type === 'payment')
      .reduce((s, t) => s + t.amount, 0);

    const pending = Math.max(0, charges - payments);
    return { charges, payments, pending };
  }, [allTimelineTransactions]);

  // Sincronizar en segundo plano el saldo correcto en la tabla de debtors si difería
  useEffect(() => {
    if (debtor && Math.abs(debtor.current_balance - stats.pending) > 0.01) {
      supabase
        .from('debtors')
        .update({ current_balance: stats.pending })
        .eq('id', debtor.id)
        .then(() => {
          setDebtor(prev => prev ? { ...prev, current_balance: stats.pending } : null);
        });
    }
  }, [debtor, stats.pending]);

  // Datos para la gráfica interactiva
  const chartData = useMemo(() => {
    const ascList = [...allTimelineTransactions].reverse();
    if (ascList.length === 0) return [];

    return ascList.map((tx) => ({
      name: format(parseISO(tx.date), "dd/MM"),
      saldo: tx.runningBalance,
      cargo: tx.type === "charge" ? tx.amount : 0,
      abono: tx.type === "payment" ? tx.amount : 0,
      descripcion: tx.description,
    }));
  }, [allTimelineTransactions]);

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !debtor) return;
    let base = evaluateExpression(transactionForm.amount) || 0;
    if (base <= 0) return showError("Monto inválido");

    let finalAmt = currency === "USD" ? base * usdToMxnRate : base;
    const date = getLocalDateString(new Date());
    const desc = transactionForm.description.trim() || (transactionForm.type === "payment" ? "Abono recibido" : "Cargo / Préstamo");

    try {
      if (editingTransaction && !editingTransaction.isInitial) {
        await supabase.from('debtor_transactions').update({ 
          type: transactionForm.type, 
          amount: finalAmt, 
          description: desc 
        }).eq('id', editingTransaction.id);
      } else {
        await supabase.from('debtor_transactions').insert({ 
          user_id: user.id, 
          debtor_id: debtor.id, 
          type: transactionForm.type, 
          amount: finalAmt, 
          description: desc, 
          date 
        });

        if (!skipLinkedTransaction) {
          if (transactionForm.type === "payment") {
            if (transactionForm.destinationAccountId === "cash") {
              await supabase.from('cash_transactions').insert({ 
                user_id: user.id, 
                type: "ingreso", 
                amount: finalAmt, 
                description: `Abono de ${debtor.name}: ${desc}`, 
                date, 
                income_category_id: transactionForm.selectedIncomeCategoryId || null 
              });
            } else {
              const card = cards.find(c => c.id === transactionForm.destinationAccountId);
              if (card) {
                const newBal = card.type === "credit" ? card.current_balance - finalAmt : card.current_balance + finalAmt;
                await supabase.from('cards').update({ current_balance: newBal }).eq('id', card.id);
                await supabase.from('card_transactions').insert({ 
                  user_id: user.id, 
                  card_id: card.id, 
                  type: "payment", 
                  amount: finalAmt, 
                  description: `Abono de ${debtor.name}: ${desc}`, 
                  date, 
                  income_category_id: transactionForm.selectedIncomeCategoryId || null 
                });
              }
            }
          }
        }
      }
      showSuccess("Movimiento guardado con éxito");
      setIsTransactionDialogOpen(false);
      fetchData();
    } catch (err: any) { 
      showError("Error: " + err.message); 
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (txId === "initial-balance-record") {
      if (debtor) {
        await supabase.from('debtors').update({ initial_balance: 0 }).eq('id', debtor.id);
        showSuccess("Saldo inicial removido");
        fetchData();
      }
      return;
    }
    await supabase.from('debtor_transactions').delete().eq('id', txId);
    showSuccess("Movimiento eliminado");
    fetchData();
  };

  const handleWhatsApp = () => {
    if (!debtor?.phone) return showError("No tiene teléfono registrado");
    const msg = `Hola ${debtor.name}, ¿cómo estás? Te comparto tu estado de cuenta con un pendiente de $${stats.pending.toFixed(2)}. ¡Saludos! 🐷`;
    window.open(`https://wa.me/${debtor.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleExportCsv = () => {
    if (!debtor || filteredTransactions.length === 0) {
      showError("No hay transacciones para exportar.");
      return;
    }

    const dataToExport = filteredTransactions.map((tx) => ({
      Fecha: format(parseISO(tx.date), "dd/MM/yyyy"),
      Tipo: tx.isInitial ? "Apertura Inicial" : (tx.type === "charge" ? "Cargo / Préstamo" : "Abono / Pago"),
      "Concepto / Motivo": tx.description,
      "Monto ($)": (tx.type === "charge" ? "+" : "-") + tx.amount.toFixed(2),
      "Saldo Acumulado ($)": tx.runningBalance.toFixed(2),
    }));

    exportToCsv(`Estado_Cuenta_${debtor.name.replace(/\s+/g, "_")}.csv`, dataToExport);
    showSuccess("Estado de cuenta exportado en CSV.");
  };

  const handleExportPdf = () => {
    if (!debtor || filteredTransactions.length === 0) {
      showError("No hay transacciones para exportar.");
      return;
    }

    exportBankStatementPdf({
      clientName: debtor.name,
      phone: debtor.phone,
      totalCharges: stats.charges,
      totalPayments: stats.payments,
      pendingBalance: stats.pending,
      transactions: filteredTransactions.map(tx => ({
        date: format(parseISO(tx.date), "dd/MM/yyyy"),
        type: tx.isInitial ? "Apertura Inicial" : (tx.type === "charge" ? "Cargo" : "Abono"),
        description: tx.description,
        amount: (tx.type === "charge" ? "+" : "-") + `$${tx.amount.toFixed(2)}`,
        balance: `$${tx.runningBalance.toFixed(2)}`,
      }))
    });

    showSuccess("Estado de cuenta oficial en PDF generado.");
  };

  if (isLoading) return <LoadingSpinner />;
  if (!debtor) return null;

  return (
    <div className="flex flex-col gap-6 p-2 sm:p-4 md:p-6 pb-24 max-w-5xl mx-auto">
      {/* 1. Header con botones de acción */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 shrink-0" onClick={() => navigate('/debtors')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              {debtor.name} 🐷
            </h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
              <Building2 className="h-3.5 w-3.5" /> Estado de Cuenta Bancario
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsStatementPreviewOpen(true)}
            className="rounded-2xl h-11 px-4 font-bold border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 gap-2 shadow-sm"
          >
            <ReceiptText className="h-4 w-4" /> Vista Estado de Cuenta
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-2xl h-11 px-4 font-bold border-slate-200 gap-2">
                <FileDown className="h-4 w-4 text-primary" /> Descargar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl p-2 w-52 shadow-xl">
              <DropdownMenuItem onClick={handleExportPdf} className="rounded-xl cursor-pointer font-medium text-xs gap-2 py-2.5">
                <FileDown className="h-4 w-4 text-rose-500" /> PDF Oficial Estilo Banco
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCsv} className="rounded-xl cursor-pointer font-medium text-xs gap-2 py-2.5">
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Archivo Excel / CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {debtor.phone && (
            <Button 
              variant="outline" 
              onClick={handleWhatsApp}
              className="rounded-2xl h-11 px-4 font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-2 shrink-0"
            >
              <MessageSquare className="h-4 w-4 text-emerald-600" /> WhatsApp
            </Button>
          )}
        </div>
      </div>

      {/* 2. Tarjetas de Resumen Financiero Estilo Banco con Totales Reales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-3xl border-none shadow-sm bg-slate-900 text-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo Pendiente</p>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-bold">Por cobrar</span>
          </div>
          <p className="text-3xl font-black mt-2 tracking-tight text-white">${stats.pending.toLocaleString()}</p>
          <span className="text-[10px] font-medium text-slate-400 mt-1 block">Cargos (${stats.charges.toFixed(0)}) − Abonos (${stats.payments.toFixed(0)})</span>
        </Card>

        <Card className="rounded-3xl border border-slate-100 shadow-sm bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Total Cargos</p>
            <TrendingUp className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2">+${stats.charges.toLocaleString()}</p>
          <span className="text-[10px] font-medium text-slate-400 mt-1 block">Total prestado históricamente</span>
        </Card>

        <Card className="rounded-3xl border border-slate-100 shadow-sm bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total Abonos</p>
            <TrendingDown className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">-${stats.payments.toLocaleString()}</p>
          <span className="text-[10px] font-medium text-slate-400 mt-1 block">Total recuperado históricamente</span>
        </Card>
      </div>

      {/* 3. Gráfica Interactiva de Evolución del Estado de Cuenta */}
      {chartData.length > 1 && (
        <Card className="rounded-[2.5rem] border-none shadow-soft bg-white p-6 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-600" /> Evolución de la Deuda
              </CardTitle>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Saldo acumulado movimiento tras movimiento</p>
            </div>
            <Badge variant="outline" className="w-fit rounded-full text-xs font-bold text-slate-600">
              {chartData.length} registros
            </Badge>
          </div>

          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-slate-300">{data.name}</p>
                          <p className="text-indigo-300 font-black text-sm">Saldo: ${data.saldo.toFixed(2)}</p>
                          <p className="text-[10px] text-slate-400 line-clamp-2">{data.descripcion}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="saldo" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorSaldo)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* 4. Tabla de Movimientos Detallada */}
      <Card className="rounded-3xl border-slate-100 shadow-sm bg-white overflow-hidden">
        <CardHeader className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Vista:</span>
              <div className="flex bg-slate-200 p-0.5 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTimeViewMode("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all",
                    timeViewMode === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Historial Completo
                </button>
                <button
                  type="button"
                  onClick={() => setTimeViewMode("month")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all",
                    timeViewMode === "month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Por Mes
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                className="h-10 px-4 gap-1.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" 
                onClick={() => {
                  setEditingTransaction(null);
                  setTransactionForm({
                    type: "payment",
                    amount: "",
                    description: "Abono recibido",
                    destinationAccountId: "cash",
                    selectedIncomeCategoryId: incomeCategories[0]?.id || "",
                  });
                  setIsTransactionDialogOpen(true);
                }}
              >
                <DollarSign className="h-4 w-4" /> Abonar
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="h-10 px-4 gap-1.5 rounded-xl font-bold border-rose-200 text-rose-700 hover:bg-rose-50 bg-rose-50/40" 
                onClick={() => {
                  setEditingTransaction(null);
                  setTransactionForm({
                    type: "charge",
                    amount: "",
                    description: "Préstamo / Cargo adicional",
                    destinationAccountId: "cash",
                    selectedIncomeCategoryId: "",
                  });
                  setIsTransactionDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 text-rose-600" /> Nuevo Cargo
              </Button>
            </div>
          </div>

          {timeViewMode === "month" && (
            <div className="flex items-center justify-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 max-w-sm mx-auto w-full">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCurrentViewDate(subMonths(currentViewDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-bold text-xs uppercase tracking-widest text-slate-700 min-w-[130px] text-center">
                {format(currentViewDate, "MMMM yyyy", { locale: es })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCurrentViewDate(addMonths(currentViewDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por motivo / descripción..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-9 rounded-xl bg-white border-slate-200 text-xs"
              />
            </div>
            <div className="flex gap-1.5">
              <Button 
                type="button" 
                size="sm" 
                variant={filterType === 'all' ? 'default' : 'outline'} 
                onClick={() => setFilterType('all')}
                className="rounded-xl h-9 text-xs font-bold"
              >
                Todos
              </Button>
              <Button 
                type="button" 
                size="sm" 
                variant={filterType === 'charge' ? 'default' : 'outline'} 
                onClick={() => setFilterType('charge')}
                className={cn("rounded-xl h-9 text-xs font-bold", filterType === 'charge' && "bg-rose-600 hover:bg-rose-700 text-white")}
              >
                Cargos
              </Button>
              <Button 
                type="button" 
                size="sm" 
                variant={filterType === 'payment' ? 'default' : 'outline'} 
                onClick={() => setFilterType('payment')}
                className={cn("rounded-xl h-9 text-xs font-bold", filterType === 'payment' && "bg-emerald-600 hover:bg-emerald-700 text-white")}
              >
                Abonos
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 w-[110px]">Fecha</TableHead>
                  <TableHead>Concepto / Motivo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Saldo Acumulado</TableHead>
                  <TableHead className="text-right pr-4 w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-xs">
                      No se encontraron movimientos registrados en este periodo.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx, idx) => (
                    <TableRow key={tx.id || idx} className={cn(tx.isInitial && "bg-indigo-50/30")}>
                      <TableCell className="text-xs font-bold text-slate-600 pl-4 whitespace-nowrap">
                        {format(parseISO(tx.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="max-w-[200px] sm:max-w-md">
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 leading-snug break-words">
                            {tx.description}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "w-fit text-[9px] px-2 py-0 border-none font-bold", 
                                tx.type === 'charge' ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                              )}
                            >
                              {tx.isInitial ? "Apertura Inicial" : (tx.type === 'charge' ? "Cargo (Préstamo)" : "Abono (Pago)")}
                            </Badge>
                            {tx.isInitial && (
                              <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-0.5">
                                <Sparkles className="h-3 w-3" /> Apertura
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-black text-xs sm:text-sm whitespace-nowrap", 
                        tx.type === 'charge' ? "text-rose-600" : "text-emerald-600"
                      )}>
                        {tx.type === 'charge' ? '+' : '-'}${tx.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-black text-xs sm:text-sm text-indigo-900 whitespace-nowrap">
                        ${tx.runningBalance.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right pr-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {!tx.isInitial && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg shrink-0"
                              onClick={() => {
                                setEditingTransaction(tx);
                                setTransactionForm({
                                  type: tx.type,
                                  amount: tx.amount.toString(),
                                  description: tx.description,
                                  destinationAccountId: "cash",
                                  selectedIncomeCategoryId: "",
                                });
                                setIsTransactionDialogOpen(true);
                              }}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl w-[90vw] max-w-md">
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se recalculará el saldo del deudor automáticamente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                <AlertDialogCancel className="rounded-xl mt-0">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteTransaction(tx.id)} className="rounded-xl bg-rose-600 hover:bg-rose-700">
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 5. Pie de Totales Consolidado Estilo Banco */}
          <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <Building2 className="h-4 w-4 text-indigo-600" /> Resumen de Cierre de Cuenta
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-6 text-right w-full sm:w-auto">
              <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-[9px] font-black uppercase text-slate-400 block">Total Cargos</span>
                <span className="text-sm font-black text-rose-600">+${stats.charges.toFixed(2)}</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-[9px] font-black uppercase text-slate-400 block">Total Abonos</span>
                <span className="text-sm font-black text-emerald-600">-${stats.payments.toFixed(2)}</span>
              </div>
              <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-md">
                <span className="text-[9px] font-black uppercase text-indigo-200 block">Saldo Pendiente</span>
                <span className="text-base font-black text-white">${stats.pending.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MODAL VISTA ESTADO DE CUENTA ESTILO BANCO */}
      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>
        <DialogContent className="w-[95vw] max-w-3xl rounded-[2.5rem] p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xs">
                    OK
                  </div>
                  <DialogTitle className="text-xl font-black tracking-tight text-slate-900">
                    OINKASH FINANCIAL
                  </DialogTitle>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estado de Cuenta Oficial</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase text-slate-400">Fecha de Emisión</p>
                <p className="text-xs font-bold text-slate-800">{new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Datos del Cliente */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-bold text-slate-400 uppercase text-[9px]">Cliente / Titular</span>
                <p className="text-sm font-black text-slate-900 mt-0.5">{debtor.name}</p>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase text-[9px]">Contacto</span>
                <p className="text-sm font-bold text-slate-700 mt-0.5">{debtor.phone || 'No registrado'}</p>
              </div>
            </div>

            {/* Resumen en 3 columnas */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100">
                <span className="text-[9px] font-black uppercase text-rose-500">Cargos (+)</span>
                <p className="text-lg font-black text-rose-600">${stats.charges.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                <span className="text-[9px] font-black uppercase text-emerald-600">Abonos (-)</span>
                <p className="text-lg font-black text-emerald-600">${stats.payments.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100">
                <span className="text-[9px] font-black uppercase text-indigo-600">Saldo Pendiente</span>
                <p className="text-lg font-black text-indigo-900">${stats.pending.toFixed(2)}</p>
              </div>
            </div>

            {/* Tabla resumen en modal */}
            <div className="border rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-[10px]">Fecha</TableHead>
                    <TableHead className="text-[10px]">Concepto</TableHead>
                    <TableHead className="text-right text-[10px]">Monto</TableHead>
                    <TableHead className="text-right text-[10px] pr-4">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{format(parseISO(tx.date), "dd/MM/yy")}</TableCell>
                      <TableCell className="text-xs font-medium max-w-[160px] truncate">{tx.description}</TableCell>
                      <TableCell className={cn("text-right font-bold text-xs", tx.type === 'charge' ? 'text-rose-600' : 'text-emerald-600')}>
                        {tx.type === 'charge' ? '+' : '-'}${tx.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-black text-xs pr-4">${tx.runningBalance.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsStatementPreviewOpen(false)} className="rounded-xl">
              Cerrar
            </Button>
            <Button onClick={handleExportPdf} className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              <FileDown className="h-4 w-4" /> Descargar PDF Oficial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO REGISTRAR / EDITAR MOVIMIENTO */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="rounded-3xl p-6 sm:p-8 w-[95vw] max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingTransaction ? 'Editar Movimiento' : (transactionForm.type === 'payment' ? 'Registrar Abono' : 'Registrar Nuevo Cargo')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <Button 
                type="button" 
                variant={transactionForm.type === 'payment' ? 'default' : 'ghost'} 
                className={cn("rounded-xl font-bold text-xs uppercase h-10", transactionForm.type === 'payment' && "bg-emerald-600 text-white shadow-sm")} 
                onClick={() => setTransactionForm({...transactionForm, type: 'payment'})}
              >
                <DollarSign className="h-4 w-4 mr-1" /> Abono (Resta)
              </Button>
              <Button 
                type="button" 
                variant={transactionForm.type === 'charge' ? 'default' : 'ghost'} 
                className={cn("rounded-xl font-bold text-xs uppercase h-10", transactionForm.type === 'charge' && "bg-rose-600 text-white shadow-sm")} 
                onClick={() => setTransactionForm({...transactionForm, type: 'charge'})}
              >
                <Plus className="h-4 w-4 mr-1" /> Cargo (Suma)
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Monto</Label>
              <Input 
                value={transactionForm.amount} 
                onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})} 
                className="rounded-xl h-12 text-lg font-bold bg-slate-50 border-slate-200" 
                placeholder="0.00 o =50+50"
                required 
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Motivo / Concepto</Label>
              <Input 
                value={transactionForm.description} 
                onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} 
                className="rounded-xl h-11 bg-slate-50 border-slate-200 font-medium text-sm" 
                placeholder="Ej. Abono quincenal, Comida, etc."
                required 
              />
            </div>

            {!editingTransaction && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">
                  {transactionForm.type === "payment" ? "¿A qué cuenta entra el dinero?" : "¿De qué cuenta salió el dinero?"}
                </Label>
                <Select value={transactionForm.destinationAccountId} onValueChange={v => setTransactionForm({...transactionForm, destinationAccountId: v})}>
                  <SelectTrigger className="rounded-xl h-11 bg-slate-50 border-slate-200 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="cash" className="rounded-xl">Efectivo (${cashBalance.toFixed(2)})</SelectItem>
                    {cards.map(c => (
                      <SelectItem key={c.id} value={c.id} className="rounded-xl">
                        {c.name} ({c.bank_name}) - Saldo: ${c.current_balance.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button 
                type="submit" 
                className={cn(
                  "w-full rounded-xl h-12 font-bold text-white shadow-md",
                  transactionForm.type === "payment" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                )}
              >
                Guardar Movimiento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DebtorDetailsPage;