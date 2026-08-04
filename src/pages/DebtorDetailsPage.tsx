"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DollarSign, 
  Trash2, 
  Edit, 
  ArrowLeft, 
  FileDown, 
  History, 
  Search, 
  Filter, 
  FileText, 
  Share2, 
  Copy, 
  MessageSquare, 
  ChevronLeft, 
  ChevronRight, 
  Coins,
  TrendingUp,
  TrendingDown,
  Calendar,
  PlusCircle,
  Briefcase
} from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useCategoryContext } from "@/context/CategoryContext";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";
import { Badge } from "@/components/ui/badge";
import { fetchUsdToMxnRate } from "@/utils/currency-helper";

interface DebtorTransaction {
  id: string;
  type: "charge" | "payment";
  amount: number;
  description: string;
  date: string;
  created_at: string;
}

interface Debtor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  phone?: string;
  due_date?: string;
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
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "charge" | "payment">("all");

  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [skipLinkedTransaction, setSkipLinkedTransaction] = useState(false);

  const [sharePhone, setSharePhone] = useState("");

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
      setSharePhone(debtorData.phone || "");

      const { data: cardsData } = await supabase.from('cards').select('*').eq('user_id', user.id);
      setCards(cardsData || []);

      const { data: cashTxData } = await supabase.from('cash_transactions').select('type, amount').eq('user_id', user.id);
      setCashBalance((cashTxData || []).reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0));

      if (incomeCategories.length > 0) {
        setTransactionForm(prev => ({ ...prev, selectedIncomeCategoryId: incomeCategories[0].id }));
      }
    } catch (error: any) {
      showError('Error al cargar detalles');
      navigate('/debtors');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [debtorId, user, incomeCategories]);

  // Historial ordenado con saldo acumulado
  const transactionsWithBalance = useMemo(() => {
    if (!debtor) return [];
    const sortedAsc = [...debtor.debtor_transactions].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    let current = debtor.initial_balance;
    const computedAsc = sortedAsc.map(tx => {
      if (tx.type === "charge") current += tx.amount;
      else current -= tx.amount;
      return { ...tx, runningBalance: current };
    });
    return computedAsc.reverse();
  }, [debtor]);

  const filterInterval = useMemo(() => ({
    start: startOfMonth(currentViewDate),
    end: endOfMonth(currentViewDate)
  }), [currentViewDate]);

  const filteredTransactions = useMemo(() => {
    return transactionsWithBalance.filter(tx => {
      const matchesDate = isWithinInterval(parseISO(tx.date), filterInterval);
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      return matchesDate && matchesSearch && matchesType;
    });
  }, [transactionsWithBalance, filterInterval, searchTerm, filterType]);

  // Métricas totales (Histórico)
  const totalMetrics = useMemo(() => {
    if (!debtor) return { charges: 0, payments: 0, net: 0 };
    const charges = debtor.debtor_transactions.filter(tx => tx.type === "charge").reduce((sum, tx) => sum + tx.amount, 0);
    const payments = debtor.debtor_transactions.filter(tx => tx.type === "payment").reduce((sum, tx) => sum + tx.amount, 0);
    return {
      charges,
      payments,
      net: charges - payments
    };
  }, [debtor]);

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !debtor) return;
    let base = evaluateExpression(transactionForm.amount) || 0;
    if (base <= 0) return showError("Monto inválido");

    let finalAmt = currency === "USD" ? base * usdToMxnRate : base;
    const date = getLocalDateString(new Date());

    try {
      if (editingTransaction) {
        await supabase.from('debtor_transactions').update({ type: transactionForm.type, amount: finalAmt, description: transactionForm.description }).eq('id', editingTransaction.id);
      } else {
        await supabase.from('debtor_transactions').insert({ user_id: user.id, debtor_id: debtor.id, type: transactionForm.type, amount: finalAmt, description: transactionForm.description, date });
        if (transactionForm.type === "payment" && !skipLinkedTransaction) {
          if (transactionForm.destinationAccountId === "cash") {
            await supabase.from('cash_transactions').insert({ user_id: user.id, type: "ingreso", amount: finalAmt, description: `Abono de ${debtor.name}`, date, income_category_id: transactionForm.selectedIncomeCategoryId || null });
          } else {
            const card = cards.find(c => c.id === transactionForm.destinationAccountId);
            if (card) {
              const newBal = card.type === "credit" ? card.current_balance - finalAmt : card.current_balance + finalAmt;
              await supabase.from('cards').update({ current_balance: newBal }).eq('id', card.id);
              await supabase.from('card_transactions').insert({ user_id: user.id, card_id: card.id, type: "payment", amount: finalAmt, description: `Abono de ${debtor.name}`, date, income_category_id: transactionForm.selectedIncomeCategoryId || null });
            }
          }
        }
      }
      showSuccess("Movimiento guardado");
      setIsTransactionDialogOpen(false);
      fetchData();
    } catch (err: any) { showError(err.message); }
  };

  const handleDeleteTransaction = async (txId: string) => {
    await supabase.from('debtor_transactions').delete().eq('id', txId);
    showSuccess("Eliminado");
    fetchData();
  };

  const handleExport = (formatType: 'csv' | 'pdf', scope: 'month' | 'total') => {
    if (!debtor) return;
    
    const source = scope === 'month' ? filteredTransactions : transactionsWithBalance;
    const data = source.map(tx => ({
      Fecha: format(parseISO(tx.date), "dd/MM/yyyy"),
      Tipo: tx.type === "charge" ? "Cargo" : "Pago",
      Descripción: tx.description,
      Monto: tx.amount.toFixed(2),
      Saldo: tx.runningBalance.toFixed(2)
    }));

    const filename = `historial_${debtor.name}_${scope === 'month' ? format(currentViewDate, "MMM_yyyy") : 'total'}`;

    if (formatType === 'csv') {
      exportToCsv(`${filename}.csv`, data);
      showSuccess(`Historial ${scope === 'month' ? 'mensual' : 'total'} exportado a CSV.`);
    } else {
      exportToPdf(
        `${filename}.pdf`, 
        `Estado de Cuenta: ${debtor.name} (${scope === 'month' ? format(currentViewDate, "MMMM yyyy", { locale: es }) : 'Todo el Historial'})`, 
        ["Fecha", "Tipo", "Descripción", "Monto", "Saldo"], 
        data.map(d => Object.values(d))
      );
      showSuccess(`Historial ${scope === 'month' ? 'mensual' : 'total'} exportado a PDF.`);
    }
  };

  const generateStatementText = () => {
    if (!debtor) return "";
    let text = `📄 *ESTADO DE CUENTA: ${debtor.name.toUpperCase()}*\n\n`;
    text += `💰 *Saldo Pendiente:* $${debtor.current_balance.toFixed(2)}\n`;
    text += `📅 *Generado:* ${format(new Date(), "d 'de' MMMM")}\n\n`;
    text += `*Últimos Movimientos:*\n`;
    filteredTransactions.slice(0, 5).forEach(tx => {
      text += `${tx.type === 'charge' ? '➕' : '➖'} $${tx.amount.toFixed(2)} - ${tx.description}\n`;
    });
    text += `\nGenerado con Oinkash 🐷`;
    return text;
  };

  if (isLoading) return <LoadingSpinner />;
  if (!debtor) return null;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6 pb-24 max-w-5xl mx-auto">
      
      {/* HEADER DETALLE */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/debtors')}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{debtor.name}</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detalle de Cuenta</p>
          </div>
        </div>
        <div className="flex gap-2">
           <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" title="Exportar"><FileDown className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl w-56">
                <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400">Exportar Mes Actual</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleExport('csv', 'month')} className="text-xs font-bold gap-2">
                  <FileText className="h-3.5 w-3.5" /> CSV (Mes)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf', 'month')} className="text-xs font-bold gap-2">
                  <FileText className="h-3.5 w-3.5" /> PDF (Mes)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400">Exportar Historial Completo</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleExport('csv', 'total')} className="text-xs font-bold gap-2">
                  <Briefcase className="h-3.5 w-3.5" /> CSV (Todo)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf', 'total')} className="text-xs font-bold gap-2">
                  <Briefcase className="h-3.5 w-3.5" /> PDF (Todo)
                </DropdownMenuItem>
              </DropdownMenuContent>
           </DropdownMenu>
           <Button variant="outline" size="icon" className="rounded-xl h-10 w-10" onClick={() => setIsShareDialogOpen(true)}><Share2 className="h-4 w-4" /></Button>
           <Button className="rounded-xl h-10 font-black gap-2" onClick={() => { setEditingTransaction(null); setIsTransactionDialogOpen(true); }}><PlusCircle className="h-4 w-4" /> Nuevo</Button>
        </div>
      </div>

      {/* DASHBOARD DEUDOR (Basado en historial completo) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 text-white rounded-[2rem] border-none shadow-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign className="h-20 w-20" /></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deuda Pendiente</p>
          <p className="text-4xl font-black mt-1">${debtor.current_balance.toLocaleString()}</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 w-fit px-3 py-1 rounded-full">
            <TrendingDown className="h-3 w-3" /> Deuda Inicial: ${debtor.initial_balance.toLocaleString()}
          </div>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-sm bg-white p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Histórico de Movimientos</p>
          <div className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500">Total Prestado</span>
              <span className="text-sm font-black text-rose-500">+${totalMetrics.charges.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500">Total Abonado</span>
              <span className="text-sm font-black text-emerald-500">-${totalMetrics.payments.toLocaleString()}</span>
            </div>
            <div className="h-px bg-slate-100" />
            <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase text-slate-400">Balance Neto de Cuenta</span>
              <span className={cn("text-sm font-black", totalMetrics.net >= 0 ? "text-rose-500" : "text-emerald-500")}>
                {totalMetrics.net >= 0 ? '+' : ''}${totalMetrics.net.toLocaleString()}
              </span>
            </div>
          </div>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-sm bg-white p-6 flex flex-col justify-center items-center text-center">
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3">
            <Calendar className="h-6 w-6" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vencimiento Próximo</p>
          <p className="text-lg font-black text-slate-900 mt-1">{debtor.due_date ? format(parseISO(debtor.due_date), "d 'de' MMMM", { locale: es }) : "Sin fecha fija"}</p>
        </Card>
      </div>

      {/* HISTORIAL DE MOVIMIENTOS */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center bg-white p-1 rounded-2xl shadow-sm border">
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10" onClick={() => setCurrentViewDate(subMonths(currentViewDate, 1))}><ChevronLeft className="h-5 w-5" /></Button>
            <div className="px-6 text-xs font-black uppercase tracking-widest min-w-[140px] text-center">{format(currentViewDate, "MMMM yyyy", { locale: es })}</div>
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10" onClick={() => setCurrentViewDate(addMonths(currentViewDate, 1))}><ChevronRight className="h-5 w-5" /></Button>
          </div>
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar movimiento..." className="pl-9 rounded-2xl border-none shadow-sm h-11 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-none">
                <TableHead className="pl-8 text-[10px] font-black uppercase tracking-tighter">Fecha</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-tighter">Descripción</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-tighter">Monto</TableHead>
                <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-tighter">Saldo Acum.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 font-bold italic text-sm">No hay movimientos en este periodo.</TableCell></TableRow>
              ) : (
                filteredTransactions.map(tx => (
                  <TableRow key={tx.id} className="group hover:bg-slate-50/50 border-slate-50 transition-colors">
                    <TableCell className="pl-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900">{format(parseISO(tx.date), "dd")}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{format(parseISO(tx.date), "MMM", { locale: es })}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">{tx.description}</span>
                        <Badge variant="outline" className={cn("w-fit text-[9px] font-black uppercase mt-1 border-none px-2", tx.type === 'charge' ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>
                          {tx.type === 'charge' ? 'Cargo' : 'Abono'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("text-sm font-black", tx.type === 'charge' ? "text-rose-500" : "text-emerald-500")}>
                        {tx.type === 'charge' ? '+' : '-'}${tx.amount.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex items-center justify-end gap-3">
                        <span className="text-sm font-black text-slate-900">${tx.runningBalance.toLocaleString()}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Edit className="h-3.5 w-3.5 text-slate-400" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                             <DropdownMenuItem onClick={() => { setEditingTransaction(tx); setTransactionForm({ type: tx.type, amount: tx.amount.toString(), description: tx.description, destinationAccountId: "cash", selectedIncomeCategoryId: "" }); setIsTransactionDialogOpen(true); }} className="text-xs font-bold gap-2"><Edit className="h-3.5 w-3.5" /> Editar</DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleDeleteTransaction(tx.id)} className="text-xs font-bold gap-2 text-rose-500"><Trash2 className="h-3.5 w-3.5" /> Eliminar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* DIÁLOGOS */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-[400px]">
          <DialogHeader><DialogTitle className="text-2xl font-black">{editingTransaction ? 'Editar' : 'Nuevo'} Movimiento</DialogTitle></DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <Button type="button" variant={transactionForm.type === 'payment' ? 'default' : 'ghost'} className={cn("rounded-xl font-black text-xs uppercase", transactionForm.type === 'payment' && "bg-white text-emerald-600 shadow-sm")} onClick={() => setTransactionForm({...transactionForm, type: 'payment'})}>Abono</Button>
              <Button type="button" variant={transactionForm.type === 'charge' ? 'default' : 'ghost'} className={cn("rounded-xl font-black text-xs uppercase", transactionForm.type === 'charge' && "bg-white text-rose-600 shadow-sm")} onClick={() => setTransactionForm({...transactionForm, type: 'charge'})}>Préstamo</Button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase text-slate-400">Monto</Label></div>
              <div className="relative">
                <Input value={transactionForm.amount} onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})} className="rounded-2xl h-14 text-xl font-black bg-slate-50 border-none pr-12" required />
                <span className="absolute right-4 top-4 text-xs font-black text-slate-300">{currency}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Descripción</Label>
              <Input value={transactionForm.description} onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} className="rounded-2xl h-12 bg-slate-50 border-none font-bold" required />
            </div>
            <Button type="submit" className="w-full rounded-2xl h-14 font-black text-lg bg-indigo-600 shadow-xl shadow-indigo-100">Confirmar</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-[400px]">
          <DialogHeader><DialogTitle className="text-2xl font-black">Compartir Estado</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 font-mono text-[10px] whitespace-pre-wrap text-slate-600">
              {generateStatementText()}
            </div>
            <div className="grid grid-cols-1 gap-3">
              <Button className="rounded-2xl h-14 font-black bg-green-600 gap-3" onClick={() => window.open(`https://wa.me/${sharePhone.replace(/\D/g, '')}?text=${encodeURIComponent(generateStatementText())}`, '_blank')}><MessageSquare className="h-5 w-5" /> Enviar por WhatsApp</Button>
              <Button variant="outline" className="rounded-2xl h-14 font-black border-slate-200 gap-3" onClick={() => { navigator.clipboard.writeText(generateStatementText()); showSuccess("Copiado"); setIsShareDialogOpen(false); }}><Copy className="h-5 w-5" /> Copiar Texto</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DebtorDetailsPage;