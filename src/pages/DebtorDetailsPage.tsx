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
import { DollarSign, Trash2, Edit, ArrowLeft, FileText, FileDown, History } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
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
  debtor_transactions: DebtorTransaction[];
}

interface CardData {
  id: string;
  name: string;
  bank_name: string;
  last_four_digits: string;
  type: "credit" | "debit";
  current_balance: number;
}

const DebtorDetailsPage: React.FC = () => {
  const { debtorId } = useParams<{ debtorId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { incomeCategories, isLoadingCategories } = useCategoryContext();
  const [debtor, setDebtor] = useState<Debtor | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isEditTransactionDialogOpen, setIsEditTransactionDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<DebtorTransaction | null>(null);

  const [newTransaction, setNewTransaction] = useState({
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
      // Fetch Debtor
      const { data: debtorData, error: debtorError } = await supabase
        .from('debtors')
        .select('*, debtor_transactions(*)')
        .eq('id', debtorId)
        .eq('user_id', user.id)
        .single();

      if (debtorError) throw debtorError;
      setDebtor(debtorData);

      // Fetch Cards
      const { data: cardsData } = await supabase
        .from('cards')
        .select('id, name, bank_name, last_four_digits, type, current_balance')
        .eq('user_id', user.id);
      setCards(cardsData || []);

      // Fetch Cash
      const { data: cashTxData } = await supabase
        .from('cash_transactions')
        .select('type, amount')
        .eq('user_id', user.id);
      
      const currentCash = (cashTxData || []).reduce((sum, tx) => 
        tx.type === "ingreso" ? sum + tx.amount : sum - tx.amount, 0
      );
      setCashBalance(currentCash);

      if (!newTransaction.selectedIncomeCategoryId && incomeCategories.length > 0) {
        setNewTransaction(prev => ({ ...prev, selectedIncomeCategoryId: incomeCategories[0].id }));
      }

    } catch (error: any) {
      showError('Error al cargar detalles: ' + error.message);
      navigate('/debtors');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [debtorId, user, incomeCategories]);

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !debtor) return;

    let amount: number;
    if (newTransaction.amount.startsWith('=')) {
      amount = evaluateExpression(newTransaction.amount.substring(1)) || 0;
    } else {
      amount = parseFloat(newTransaction.amount);
    }

    if (isNaN(amount) || amount <= 0) {
      showError("Monto inválido.");
      return;
    }

    const transactionDate = getLocalDateString(new Date());

    try {
      let newDebtorBalance = debtor.current_balance;

      if (newTransaction.type === "charge") {
        newDebtorBalance += amount;
      } else {
        if (newDebtorBalance < amount - 0.01) {
          showError("El abono excede la deuda.");
          return;
        }
        newDebtorBalance -= amount;

        // Registrar ingreso
        if (newTransaction.destinationAccountId === "cash") {
          await supabase.from('cash_transactions').insert({
            user_id: user.id,
            type: "ingreso",
            amount,
            description: `Abono de ${debtor.name}: ${newTransaction.description}`,
            date: transactionDate,
            income_category_id: newTransaction.selectedIncomeCategoryId || null,
          });
        } else {
          const card = cards.find(c => c.id === newTransaction.destinationAccountId);
          if (card) {
            const newCardBalance = card.type === "credit" ? card.current_balance - amount : card.current_balance + amount;
            await supabase.from('cards').update({ current_balance: newCardBalance }).eq('id', card.id);
            await supabase.from('card_transactions').insert({
              user_id: user.id,
              card_id: card.id,
              type: "payment",
              amount,
              description: `Abono de ${debtor.name}: ${newTransaction.description}`,
              date: transactionDate,
              income_category_id: newTransaction.selectedIncomeCategoryId || null,
            });
          }
        }
      }

      // Actualizar deudor
      await supabase.from('debtors').update({ current_balance: newDebtorBalance }).eq('id', debtor.id);
      await supabase.from('debtor_transactions').insert({
        user_id: user.id,
        debtor_id: debtor.id,
        type: newTransaction.type,
        amount,
        description: newTransaction.description,
        date: transactionDate,
      });

      showSuccess("Transacción registrada.");
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
      showSuccess("Transacción eliminada.");
      fetchData();
    } catch (error: any) {
      showError('Error: ' + error.message);
    }
  };

  const handleExport = (formatType: 'csv' | 'pdf') => {
    if (!debtor) return;
    const data = debtor.debtor_transactions.map(tx => ({
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
        <Button variant="ghost" size="icon" onClick={() => navigate('/debtors')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">Gestión de Deudor: {debtor.name}</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">Saldo Pendiente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-900">${debtor.current_balance.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Deuda Inicial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">${debtor.initial_balance.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={cn(debtor.current_balance <= 0 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800")}>
              {debtor.current_balance <= 0 ? "Completado" : "Activo"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Historial de Movimientos
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setIsTransactionDialogOpen(true)}>
              <DollarSign className="h-4 w-4 mr-1" /> Nueva Transacción
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileDown className="h-4 w-4 mr-1" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
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
              {debtor.debtor_transactions
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{format(parseISO(tx.date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={tx.type === "charge" ? "text-red-600 border-red-200" : "text-green-600 border-green-200"}>
                      {tx.type === "charge" ? "Cargo" : "Abono"}
                    </Badge>
                  </TableCell>
                  <TableCell>{tx.description}</TableCell>
                  <TableCell className="text-right font-medium">
                    {tx.type === "charge" ? "+" : "-"}${tx.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
                          <AlertDialogDescription>Se ajustará el saldo del deudor automáticamente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTransaction(tx)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Diálogo de Transacción */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={newTransaction.type} onValueChange={(v: any) => setNewTransaction({...newTransaction, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment">Abono (Me paga)</SelectItem>
                  <SelectItem value="charge">Cargo (Me debe más)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Monto</Label>
              <Input 
                value={newTransaction.amount} 
                onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                placeholder="Ej. 100 o =50*2"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Input 
                value={newTransaction.description} 
                onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                required
              />
            </div>
            {newTransaction.type === "payment" && (
              <>
                <div className="grid gap-2">
                  <Label>Destino del Dinero</Label>
                  <Select value={newTransaction.destinationAccountId} onValueChange={(v) => setNewTransaction({...newTransaction, destinationAccountId: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo (Saldo: ${cashBalance.toFixed(2)})</SelectItem>
                      {cards.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.bank_name})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Categoría de Ingreso</Label>
                  <Select value={newTransaction.selectedIncomeCategoryId} onValueChange={(v) => setNewTransaction({...newTransaction, selectedIncomeCategoryId: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {incomeCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-4 w-4" />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="submit">Guardar Movimiento</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DebtorDetailsPage;