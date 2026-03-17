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
import { DollarSign, Trash2, Edit, ArrowLeft, FileDown, History, MessageCircle, AlertCircle, Search, Filter } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "charge" | "payment">("all");

  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [skipLinkedTransaction, setSkipLinkedTransaction] = useState(false);
  
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
  const [pendingWhatsApp, setPendingWhatsApp] = useState<any>(null);

  const [transactionForm, setTransactionForm] = useState({
    type: "payment" as "charge" | "payment",
    amount: "",
    description: "",
    destinationAccountId: "cash",
    selectedIncomeCategoryId: "",
  });

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

      if (!transactionForm.selectedIncomeCategoryId && incomeCategories.length > 0) {
        setTransactionForm(prev => ({ ...prev, selectedIncomeCategoryId: incomeCategories[0].id }));
      }
    } catch (error: any) {
      showError('Error al cargar detalles');
      navigate('/debtors');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [debtorId, user, incomeCategories]);

  const filteredTransactions = useMemo(() => {
    if (!debtor) return [];
    return debtor.debtor_transactions.filter(tx => {
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      return matchesSearch && matchesType;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [debtor, searchTerm, filterType]);

  const handleOpenAdd = () => {
    setEditingTransaction(null);
    setTransactionForm({
      type: (debtor?.current_balance || 0) <= 0 ? "charge" : "payment",
      amount: "",
      description: "",
      destinationAccountId: "cash",
      selectedIncomeCategoryId: incomeCategories[0]?.id || "",
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
      destinationAccountId: "cash", // No podemos saber el destino original fácilmente
      selectedIncomeCategoryId: incomeCategories[0]?.id || "",
    });
    setSkipLinkedTransaction(true); // Al editar, no vinculamos de nuevo para evitar duplicados
    setIsTransactionDialogOpen(true);
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !debtor) return;

    const amount = evaluateExpression(transactionForm.amount) || 0;
    if (amount <= 0) { showError("Monto inválido"); return; }

    try {
      let newDebtorBalance = debtor.current_balance;

      if (editingTransaction) {
        // Revertir efecto anterior
        newDebtorBalance = editingTransaction.type === "charge" ? newDebtorBalance - editingTransaction.amount : newDebtorBalance + editingTransaction.amount;
      }

      // Aplicar nuevo efecto
      if (transactionForm.type === "charge") newDebtorBalance += amount;
      else {
        if (newDebtorBalance < amount - 0.01) { showError("El abono excede la deuda."); return; }
        newDebtorBalance -= amount;

        if (!editingTransaction && !skipLinkedTransaction) {
          const linkedDesc = `Abono de ${debtor.name}: ${transactionForm.description}`;
          if (transactionForm.destinationAccountId === "cash") {
            await supabase.from('cash_transactions').insert({ user_id: user.id, type: "ingreso", amount, description: linkedDesc, date: getLocalDateString(new Date()), income_category_id: transactionForm.selectedIncomeCategoryId || null });
          } else {
            const card = cards.find(c => c.id === transactionForm.destinationAccountId);
            if (card) {
              const newCardBalance = card.type === "credit" ? card.current_balance - amount : card.current_balance + amount;
              await supabase.from('cards').update({ current_balance: newCardBalance }).eq('id', card.id);
              await supabase.from('card_transactions').insert({ user_id: user.id, card_id: card.id, type: "payment", amount, description: linkedDesc, date: getLocalDateString(new Date()), income_category_id: transactionForm.selectedIncomeCategoryId || null });
            }
          }
        }
      }

      await supabase.from('debtors').update({ current_balance: newDebtorBalance }).eq('id', debtor.id);
      
      if (editingTransaction) {
        await supabase.from('debtor_transactions').update({ type: transactionForm.type, amount, description: transactionForm.description }).eq('id', editingTransaction.id);
      } else {
        await supabase.from('debtor_transactions').insert({ user_id: user.id, debtor_id: debtor.id, type: transactionForm.type, amount, description: transactionForm.description, date: getLocalDateString(new Date()) });
        
        if (debtor.phone) {
          setPendingWhatsApp({ type: transactionForm.type === "charge" ? "Cargo" : "Abono", amount, description: transactionForm.description, newBalance: newDebtorBalance });
          setIsWhatsAppDialogOpen(true);
        }
      }

      showSuccess(editingTransaction ? "Movimiento actualizado" : "Movimiento registrado");
      setIsTransactionDialogOpen(false);
      fetchData();
    } catch (error: any) {
      showError('Error: ' + error.message);
    }
  };

  const handleDeleteTransaction = async (tx: DebtorTransaction) => {
    if (!user || !debtor) return;
    try {
      const newBalance = tx.type === "charge" ? debtor.current_balance - tx.amount : debtor.current_balance + tx.amount;
      await supabase.from('debtors').update({ current_balance: newBalance }).eq('id', debtor.id);
      await supabase.from('debtor_transactions').delete().eq('id', tx.id);
      showSuccess("Movimiento eliminado");
      fetchData();
    } catch (error: any) {
      showError('Error al eliminar');
    }
  };

  const handleExport = (formatType: 'csv' | 'pdf') => {
    if (!debtor) return;
    const data = filteredTransactions.map(tx => ({
      Fecha: format(parseISO(tx.date), "dd/MM/yyyy"),
      Tipo: tx.type === "charge" ? "Cargo" : "Abono",
      Descripción: tx.description,
      Monto: tx.amount.toFixed(2)
    }));
    if (formatType === 'csv') exportToCsv(`historial_${debtor.name}.csv`, data);
    else exportToPdf(`historial_${debtor.name}.pdf`, `Historial: ${debtor.name}`, ["Fecha", "Tipo", "Descripción", "Monto"], data.map(d => Object.values(d)));
  };

  if (isLoading) return <LoadingSpinner />;
  if (!debtor) return null;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/debtors')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-3xl font-bold">Deudor: {debtor.name}</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-yellow-800">Saldo Pendiente</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-yellow-900">${debtor.current_balance.toFixed(2)}</div></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Deuda Inicial</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">${debtor.initial_balance.toFixed(2)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Estado</CardTitle></CardHeader><CardContent><Badge className={cn(debtor.current_balance <= 0 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800")}>{debtor.current_balance <= 0 ? "Completado" : "Activo"}</Badge></CardContent></Card>
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
              <SelectItem value="payment">Abonos</SelectItem>
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
                  <TableCell><Badge variant="outline" className={tx.type === "charge" ? "text-red-600 border-red-200" : "text-green-600 border-green-200"}>{tx.type === "charge" ? "Cargo" : "Abono"}</Badge></TableCell>
                  <TableCell>{tx.description}</TableCell>
                  <TableCell className="text-right font-medium">{tx.type === "charge" ? "+" : "-"}${tx.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(tx)}><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle><AlertDialogDescription>Se ajustará el saldo del deudor.</AlertDialogDescription></AlertDialogHeader>
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
                <SelectContent><SelectItem value="payment">Abono (Me paga)</SelectItem><SelectItem value="charge">Cargo (Me debe más)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Monto</Label><Input value={transactionForm.amount} onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})} required /></div>
            <div className="grid gap-2"><Label>Descripción</Label><Input value={transactionForm.description} onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} required /></div>
            {transactionForm.type === "payment" && !editingTransaction && (
              <>
                <div className="flex items-center space-x-2 bg-blue-50 p-3 rounded-md border border-blue-100">
                  <Checkbox id="skip" checked={skipLinkedTransaction} onCheckedChange={(v) => setSkipLinkedTransaction(!!v)} />
                  <Label htmlFor="skip" className="text-xs">Ya registré este ingreso manualmente</Label>
                </div>
                {!skipLinkedTransaction && (
                  <>
                    <div className="grid gap-2">
                      <Label>Destino</Label>
                      <Select value={transactionForm.destinationAccountId} onValueChange={(v) => setTransactionForm({...transactionForm, destinationAccountId: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Efectivo (${cashBalance.toFixed(2)})</SelectItem>
                          {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.bank_name})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Categoría</Label>
                      <Select value={transactionForm.selectedIncomeCategoryId} onValueChange={(v) => setTransactionForm({...transactionForm, selectedIncomeCategoryId: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{incomeCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
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

export default DebtorDetailsPage;