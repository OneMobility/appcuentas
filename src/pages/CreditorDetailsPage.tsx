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
import { DollarSign, Trash2, Edit, ArrowLeft, FileDown, History, AlertCircle, Search, Filter, FileText } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useCategoryContext } from "@/context/CategoryContext";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
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

  const filteredTransactions = useMemo(() => {
    if (!creditor) return [];
    return creditor.creditor_transactions.filter(tx => {
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      return matchesSearch && matchesType;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [creditor, searchTerm, filterType]);

  const handleOpenAdd = () => {
    setEditingTransaction(null);
    setTransactionForm({
      type: "payment",
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
      let newCreditorBalance = creditor.current_balance;

      if (editingTransaction) {
        newCreditorBalance = editingTransaction.type === "charge" ? newCreditorBalance - editingTransaction.amount : newCreditorBalance + editingTransaction.amount;
      }

      if (transactionForm.type === "charge") newCreditorBalance += amount;
      else {
        if (newCreditorBalance < amount - 0.01) { showError("El pago excede la deuda."); return; }
        newCreditorBalance -= amount;

        if (!editingTransaction && !skipLinkedTransaction) {
          const linkedDesc = `Pago a ${creditor.name}: ${transactionForm.description}`;
          if (transactionForm.sourceAccountId === "cash") {
            if (cashBalance < amount) { showError("Saldo insuficiente en efectivo."); return; }
            await supabase.from('cash_transactions').insert({ user_id: user.id, type: "egreso", amount, description: linkedDesc, date: getLocalDateString(new Date()), expense_category_id: transactionForm.selectedExpenseCategoryId || null });
          } else {
            const card = cards.find(c => c.id === transactionForm.sourceAccountId);
            if (card) {
              if (card.type === "debit" && card.current_balance < amount) { showError("Saldo insuficiente en tarjeta."); return; }
              const newCardBalance = card.type === "credit" ? card.current_balance + amount : card.current_balance - amount;
              await supabase.from('cards').update({ current_balance: newCardBalance }).eq('id', card.id);
              await supabase.from('card_transactions').insert({ user_id: user.id, card_id: card.id, type: "charge", amount, description: linkedDesc, date: getLocalDateString(new Date()), expense_category_id: transactionForm.selectedExpenseCategoryId || null });
            }
          }
        }
      }

      await supabase.from('creditors').update({ current_balance: newCreditorBalance }).eq('id', creditor.id);
      
      if (editingTransaction) {
        await supabase.from('creditor_transactions').update({ type: transactionForm.type, amount, description: transactionForm.description }).eq('id', editingTransaction.id);
      } else {
        await supabase.from('creditor_transactions').insert({ user_id: user.id, creditor_id: creditor.id, type: transactionForm.type, amount, description: transactionForm.description, date: getLocalDateString(new Date()) });
      }

      showSuccess(editingTransaction ? "Movimiento actualizado" : "Movimiento registrado");
      setIsTransactionDialogOpen(false);
      fetchData();
    } catch (error: any) {
      showError('Error: ' + error.message);
    }
  };

  const handleDeleteTransaction = async (tx: CreditorTransaction) => {
    if (!user || !creditor) return;
    try {
      const newBalance = tx.type === "charge" ? creditor.current_balance - tx.amount : creditor.current_balance + tx.amount;
      await supabase.from('creditors').update({ current_balance: newBalance }).eq('id', creditor.id);
      await supabase.from('creditor_transactions').delete().eq('id', tx.id);
      showSuccess("Movimiento eliminado");
      fetchData();
    } catch (error: any) {
      showError('Error al eliminar');
    }
  };

  const handleExport = (formatType: 'csv' | 'pdf') => {
    if (!creditor) return;
    const data = filteredTransactions.map(tx => ({
      Fecha: format(parseISO(tx.date), "dd/MM/yyyy"),
      Tipo: tx.type === "charge" ? "Cargo" : "Pago",
      Descripción: tx.description,
      Monto: tx.amount.toFixed(2)
    }));
    if (formatType === 'csv') exportToCsv(`historial_${creditor.name}.csv`, data);
    else exportToPdf(`historial_${creditor.name}.pdf`, `Historial: ${creditor.name}`, ["Fecha", "Tipo", "Descripción", "Monto"], data.map(d => Object.values(d)));
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
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-800">Deuda Pendiente</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-red-900">${creditor.current_balance.toFixed(2)}</div></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Deuda Inicial</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">${creditor.initial_balance.toFixed(2)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Estado</CardTitle></CardHeader><CardContent><Badge className={cn(creditor.current_balance <= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>{creditor.current_balance <= 0 ? "Completado" : "Activo"}</Badge></CardContent></Card>
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
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Historial</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{format(parseISO(tx.date), "dd/MM/yyyy")}</TableCell>
                  <TableCell><Badge variant="outline" className={tx.type === "charge" ? "text-red-600 border-red-200" : "text-green-600 border-green-200"}>{tx.type === "charge" ? "Cargo" : "Pago"}</Badge></TableCell>
                  <TableCell>{tx.description}</TableCell>
                  <TableCell className="text-right font-medium">{tx.type === "charge" ? "+" : "-"}${tx.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(tx)}><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle><AlertDialogDescription>Se ajustará la deuda del acreedor.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTransaction(tx)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
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
                <SelectContent><SelectItem value="payment">Pago (Yo le pago)</SelectItem><SelectItem value="charge">Cargo (Le debo más)</SelectItem></SelectContent>
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
                      <Label>Origen</Label>
                      <Select value={transactionForm.sourceAccountId} onValueChange={(v) => setTransactionForm({...transactionForm, sourceAccountId: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Efectivo (${cashBalance.toFixed(2)})</SelectItem>
                          {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.bank_name})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Categoría</Label>
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