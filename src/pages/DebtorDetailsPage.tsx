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
import { Checkbox } from "@/components/ui/checkbox";
import { DollarSign, Trash2, Edit, ArrowLeft, FileDown, Search, Filter, FileText, ChevronLeft, ChevronRight, Coins } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useCategoryContext } from "@/context/CategoryContext";
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
      showError('Error al cargar detalles');
      navigate('/debtors');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [debtorId, user, incomeCategories]);

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

  if (isLoading) return <LoadingSpinner />;
  if (!debtor) return null;

  return (
    <div className="flex flex-col gap-6 p-2 sm:p-4 md:p-6 pb-24 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/debtors')}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-black tracking-tight">{debtor.name}</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detalle de Cuenta</p>
        </div>
      </div>

      <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 gap-2">
          <CardTitle className="text-sm font-bold">Movimientos Registrados</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-9 gap-1 rounded-xl font-bold" onClick={() => { setEditingTransaction(null); setIsTransactionDialogOpen(true); }}>
              <DollarSign className="h-4 w-4" /> Registrar Movimiento
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right pr-4">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400 text-xs">Sin movimientos.</TableCell></TableRow>
              ) : (
                filteredTransactions.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs font-medium pl-4">{format(parseISO(tx.date), "dd/MM/yy")}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-xs">{tx.description}</span>
                        <Badge variant="outline" className={cn("w-fit text-[9px] px-1 py-0 border-none", tx.type === 'charge' ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>
                          {tx.type === 'charge' ? 'Cargo' : 'Abono'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-right font-black text-xs", tx.type === 'charge' ? "text-rose-600" : "text-emerald-600")}>
                      {tx.type === 'charge' ? '+' : '-'}${tx.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-black text-xs">${tx.runningBalance.toFixed(2)}</TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
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

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl w-[90vw] max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
                              <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteTransaction(tx.id)} className="rounded-xl bg-rose-600">Eliminar</AlertDialogAction>
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
        </CardContent>
      </Card>

      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="rounded-3xl p-6 sm:p-8 w-[95vw] max-w-[400px]">
          <DialogHeader><DialogTitle className="text-xl font-bold">{editingTransaction ? 'Editar' : 'Nuevo'} Movimiento</DialogTitle></DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <Button type="button" variant={transactionForm.type === 'payment' ? 'default' : 'ghost'} className={cn("rounded-xl font-bold text-xs uppercase", transactionForm.type === 'payment' && "bg-emerald-600 text-white shadow-sm")} onClick={() => setTransactionForm({...transactionForm, type: 'payment'})}>Abono</Button>
              <Button type="button" variant={transactionForm.type === 'charge' ? 'default' : 'ghost'} className={cn("rounded-xl font-bold text-xs uppercase", transactionForm.type === 'charge' && "bg-rose-600 text-white shadow-sm")} onClick={() => setTransactionForm({...transactionForm, type: 'charge'})}>Préstamo</Button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Monto</Label>
              <Input value={transactionForm.amount} onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})} className="rounded-xl h-12 text-lg font-bold bg-slate-50 border-slate-200" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Descripción</Label>
              <Input value={transactionForm.description} onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} className="rounded-xl h-11 bg-slate-50 border-slate-200" required />
            </div>
            <Button type="submit" className="w-full rounded-xl h-12 font-bold bg-indigo-600 text-white">Guardar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DebtorDetailsPage;