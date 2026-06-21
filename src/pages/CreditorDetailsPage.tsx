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
import { DollarSign, Trash2, Edit, ArrowLeft, FileDown, History, Search, Filter, FileText, ChevronLeft, ChevronRight } from "lucide-react";
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

interface CreditorTransaction {
  id: string;
  type: "charge" | "payment";
  amount: number;
  description: string;
  date: string;
  created_at: string;
}

interface Creditor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  creditor_transactions: CreditorTransaction[];
}

const CreditorDetailsPage: React.FC = () => {
  const { creditorId } = useParams<{ creditorId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { expenseCategories } = useCategoryContext();
  
  const [creditor, setCreditor] = useState<Creditor | null>(null);
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
    sourceAccountId: "cash",
    selectedExpenseCategoryId: "",
  });

  const fetchData = async () => {
    if (!user || !creditorId) return;
    setIsLoading(true);
    try {
      const { data: creditorData, error: creditorError } = await supabase
        .from('creditors')
        .select('*, creditor_transactions(*)')
        .eq('id', creditorId)
        .eq('user_id', user.id)
        .single();

      if (creditorError) throw creditorError;
      setCreditor(creditorData);

      const { data: cardsData } = await supabase.from('cards').select('*').eq('user_id', user.id);
      setCards(cardsData || []);

      const { data: cashTxData } = await supabase.from('cash_transactions').select('type, amount').eq('user_id', user.id);
      setCashBalance((cashTxData || []).reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0));

      if (!transactionForm.selectedExpenseCategoryId && expenseCategories.length > 0) {
        setTransactionForm(prev => ({ ...prev, selectedExpenseCategoryId: expenseCategories[0].id }));
      }
    } catch (error: any) {
      showError('Error al cargar detalles');
      navigate('/creditors');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [creditorId, user, expenseCategories]);

  // Auto-sincronizar el saldo actual en la base de datos si no coincide con la suma de transacciones
  useEffect(() => {
    if (!creditor) return;
    const totalCharges = creditor.creditor_transactions
      .filter(t => t.type === 'charge')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalPayments = creditor.creditor_transactions
      .filter(t => t.type === 'payment')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expectedBalance = creditor.initial_balance + totalCharges - totalPayments;

    if (Math.abs(creditor.current_balance - expectedBalance) > 0.01) {
      const syncBalance = async () => {
        await supabase
          .from('creditors')
          .update({ current_balance: expectedBalance })
          .eq('id', creditor.id);
        fetchData();
      };
      syncBalance();
    }
  }, [creditor]);

  // Cálculo de Saldo Acumulado calculando hacia adelante desde la deuda inicial
  const transactionsWithBalance = useMemo(() => {
    if (!creditor) return [];
    
    const sortedAsc = [...creditor.creditor_transactions].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let current = creditor.initial_balance;
    const computedAsc = sortedAsc.map(tx => {
      if (tx.type === "charge") {
        current += tx.amount;
      } else {
        current -= tx.amount;
      }
      return { ...tx, runningBalance: current };
    });

    return computedAsc.reverse();
  }, [creditor]);

  // Intervalo de filtrado por mes calendario
  const filterInterval = useMemo(() => {
    return {
      start: startOfMonth(currentViewDate),
      end: endOfMonth(currentViewDate)
    };
  }, [currentViewDate]);

  const filteredTransactions = useMemo(() => {
    return transactionsWithBalance.filter(tx => {
      const matchesDate = isWithinInterval(parseISO(tx.date), filterInterval);
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      return matchesDate && matchesSearch && matchesType;
    });
  }, [transactionsWithBalance, filterInterval, searchTerm, filterType]);

  // Calcular métricas del mes seleccionado
  const monthMetrics = useMemo(() => {
    if (!creditor) return { charges: 0, payments: 0, net: 0 };
    const monthTxs = creditor.creditor_transactions.filter(tx => 
      isWithinInterval(parseISO(tx.date), filterInterval)
    );
    const charges = monthTxs.filter(tx => tx.type === "charge").reduce((sum, tx) => sum + tx.amount, 0);
    const payments = monthTxs.filter(tx => tx.type === "payment").reduce((sum, tx) => sum + tx.amount, 0);
    return {
      charges,
      payments,
      net: charges - payments
    };
  }, [creditor, filterInterval]);

  const handleOpenAdd = () => {
    setEditingTransaction(null);
    setTransactionForm({
      type: (creditor?.current_balance || 0) <= 0 ? "charge" : "payment",
      amount: "",
      description: "",
      sourceAccountId: "cash",
      selectedExpenseCategoryId: expenseCategories[0]?.id || "",
    });
    setSkipLinkedTransaction(false);
    setIsTransactionDialogOpen(true);
  };

  const handleOpenEdit = (tx: any) => {
    setEditingTransaction(tx);
    setTransactionForm({
      type: tx.type,
      amount: tx.amount.toString(),
      description: tx.description,
      sourceAccountId: "cash",
      selectedExpenseCategoryId: expenseCategories[0]?.id || "",
    });
    setSkipLinkedTransaction(true);
    setIsTransactionDialogOpen(true);
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !creditor) return;

    const amount = evaluateExpression(transactionForm.amount) || 0;
    if (amount <= 0) { showError("Monto inválido"); return; }

    try {
      if (editingTransaction) {
        const { error: updateTxError } = await supabase
          .from('creditor_transactions')
          .update({ 
            type: transactionForm.type, 
            amount, 
            description: transactionForm.description 
          })
          .eq('id', editingTransaction.id);
        
        if (updateTxError) throw updateTxError;
      } else {
        const { error: insertTxError } = await supabase
          .from('creditor_transactions')
          .insert({ 
            user_id: user.id, 
            creditor_id: creditor.id, 
            type: transactionForm.type, 
            amount, 
            description: transactionForm.description, 
            date: getLocalDateString(new Date()) 
          });
        
        if (insertTxError) throw insertTxError;

        if (transactionForm.type === "payment" && !skipLinkedTransaction) {
          const linkedDesc = `Pago a ${creditor.name}: ${transactionForm.description}`;
          if (transactionForm.sourceAccountId === "cash") {
            await supabase.from('cash_transactions').insert({ 
              user_id: user.id, 
              type: "egreso", 
              amount, 
              description: linkedDesc, 
              date: getLocalDateString(new Date()), 
              expense_category_id: transactionForm.selectedExpenseCategoryId || null 
            });
          } else {
            const card = cards.find(c => c.id === transactionForm.sourceAccountId);
            if (card) {
              const newCardBalance = card.type === "credit" ? card.current_balance + amount : card.current_balance - amount;
              await supabase.from('cards').update({ current_balance: newCardBalance }).eq('id', card.id);
              await supabase.from('card_transactions').insert({ 
                user_id: user.id, 
                card_id: card.id, 
                type: "charge", 
                amount, 
                description: linkedDesc, 
                date: getLocalDateString(new Date()), 
                expense_category_id: transactionForm.selectedExpenseCategoryId || null 
              });
            }
          }
        }
      }

      const { data: txs, error: fetchError } = await supabase
        .from('creditor_transactions')
        .select('type, amount')
        .eq('creditor_id', creditor.id);
      
      if (fetchError) throw fetchError;

      const totalCharges = (txs || [])
        .filter(t => t.type === 'charge')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalPayments = (txs || [])
        .filter(t => t.type === 'payment')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const newBalance = creditor.initial_balance + totalCharges - totalPayments;

      const { error: updateError } = await supabase
        .from('creditors')
        .update({ current_balance: newBalance })
        .eq('id', creditor.id);

      if (updateError) throw updateError;

      showSuccess(editingTransaction ? "Movimiento actualizado" : "Movimiento registrado");
      setIsTransactionDialogOpen(false);
      fetchData();
    } catch (error: any) {
      showError('Error: ' + error.message);
    }
  };

  const handleDeleteTransaction = async (tx: any) => {
    if (!user || !creditor) return;
    try {
      const { error: deleteError } = await supabase
        .from('creditor_transactions')
        .delete()
        .eq('id', tx.id);

      if (deleteError) throw deleteError;

      const { data: txs, error: fetchError } = await supabase
        .from('creditor_transactions')
        .select('type, amount')
        .eq('creditor_id', creditor.id);
      
      if (fetchError) throw fetchError;

      const totalCharges = (txs || [])
        .filter(t => t.type === 'charge')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalPayments = (txs || [])
        .filter(t => t.type === 'payment')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const newBalance = creditor.initial_balance + totalCharges - totalPayments;

      const { error: updateError } = await supabase
        .from('creditors')
        .update({ current_balance: newBalance })
        .eq('id', creditor.id);

      if (updateError) throw updateError;

      showSuccess("Movimiento eliminado");
      fetchData();
    } catch (error: any) {
      showError('Error al eliminar: ' + error.message);
    }
  };

  const handleExport = (formatType: 'csv' | 'pdf') => {
    if (!creditor) return;
    const data = filteredTransactions.map(tx => ({
      Fecha: format(parseISO(tx.date), "dd/MM/yyyy"),
      Tipo: tx.type === "charge" ? "Cargo" : "Pago",
      Descripción: tx.description,
      Monto: tx.amount.toFixed(2),
      Saldo: tx.runningBalance.toFixed(2)
    }));
    if (formatType === 'csv') exportToCsv(`historial_${creditor.name}.csv`, data);
    else exportToPdf(`historial_${creditor.name}.pdf`, `Historial: ${creditor.name}`, ["Fecha", "Tipo", "Descripción", "Monto", "Saldo"], data.map(d => Object.values(d)));
  };

  if (isLoading) return <LoadingSpinner />;
  if (!creditor) return null;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/creditors')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-3xl font-bold">Acreedor: {creditor.name}</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-800">Deuda Pendiente Global</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-red-900">${creditor.current_balance.toFixed(2)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Deuda del Mes Seleccionado</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">${monthMetrics.net.toFixed(2)}</div></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Deuda Inicial</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">${creditor.initial_balance.toFixed(2)}</div></CardContent></Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full md:max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar descripción..." className="pl-8 h-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-full sm:w-[140px] h-9">
              <Filter className="mr-2 h-3 w-3" />
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="charge">Cargos</SelectItem>
              <SelectItem value="payment">Pagos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" title="Exportar"><FileDown className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}><FileText className="mr-2 h-4 w-4" /> CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}><FileText className="mr-2 h-4 w-4" /> PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="h-9 gap-1" onClick={handleOpenAdd}><DollarSign className="h-4 w-4" /> Nuevo</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/10 gap-2">
          <div className="flex flex-col">
            <CardTitle className="text-sm font-bold">Movimientos del Mes</CardTitle>
            <span className="text-[10px] text-muted-foreground font-medium">
              {format(filterInterval.start, "dd 'de' MMM", { locale: es })} - {format(filterInterval.end, "dd 'de' MMM, yyyy", { locale: es })}
            </span>
          </div>
          
          {/* Navegación de Meses */}
          <div className="flex items-center bg-background rounded-lg p-0.5 border">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentViewDate(subMonths(currentViewDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-2 text-[10px] font-bold min-w-[80px] text-center capitalize">{format(currentViewDate, "MMM yyyy", { locale: es })}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentViewDate(addMonths(currentViewDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                    Sin movimientos registrados en este mes.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs">{format(parseISO(tx.date), "dd/MM/yy")}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-xs">{tx.description}</span>
                        <Badge variant="outline" className={cn("w-fit text-[9px] px-1 py-0", tx.type === "charge" ? "text-red-600 border-red-100" : "text-green-600 border-green-100")}>
                          {tx.type === "charge" ? "Cargo" : "Pago"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-right font-bold text-xs", tx.type === "charge" ? "text-red-600" : "text-green-600")}>
                      {tx.type === "charge" ? "+" : "-"}${tx.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-black text-xs">${tx.runningBalance.toFixed(2)}</TableCell>
                    <TableCell className="text-right flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(tx)}><Edit className="h-3.5 w-3.5" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle><AlertDialogDescription>Se ajustará el saldo.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>No</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTransaction(tx)}>Sí</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTransaction ? "Editar Movimiento" : "Registrar Movimiento"}</DialogTitle></DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={transactionForm.type} onValueChange={(v: any) => setTransactionForm({...transactionForm, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="payment">Pago (Abono a deuda)</SelectItem><SelectItem value="charge">Cargo (Debo más)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Monto</Label><Input value={transactionForm.amount} onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})} required /></div>
            <div className="grid gap-2"><Label>Descripción</Label><Input value={transactionForm.description} onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} required /></div>
            {transactionForm.type === "payment" && !editingTransaction && (
              <>
                <div className="flex items-center space-x-2 bg-blue-50 p-3 rounded-md border border-blue-100">
                  <Checkbox id="skip" checked={skipLinkedTransaction} onCheckedChange={(v) => setSkipLinkedTransaction(!!v)} />
                  <Label htmlFor="skip" className="text-xs">Ya registré este egreso manualmente</Label>
                </div>
                {!skipLinkedTransaction && (
                  <>
                    <div className="grid gap-2">
                      <Label>Origen del dinero</Label>
                      <Select value={transactionForm.sourceAccountId} onValueChange={(v) => setTransactionForm({...transactionForm, sourceAccountId: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Efectivo (${cashBalance.toFixed(2)})</SelectItem>
                          {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Categoría de gasto</Label>
                      <Select value={transactionForm.selectedExpenseCategoryId} onValueChange={(v) => setTransactionForm({...transactionForm, selectedExpenseCategoryId: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{expenseCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </>
            )}
            <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreditorDetailsPage;