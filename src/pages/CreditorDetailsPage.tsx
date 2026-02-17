"use client";

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DollarSign, Trash2, ArrowLeft, FileDown, History, AlertCircle } from "lucide-react";
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

interface CardData {
  id: string;
  name: string;
  bank_name: string;
  last_four_digits: string;
  type: "credit" | "debit";
  current_balance: number;
}

const CreditorDetailsPage: React.FC = () => {
  const { creditorId } = useParams<{ creditorId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { expenseCategories } = useCategoryContext();
  const [creditor, setCreditor] = useState<Creditor | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [skipLinkedTransaction, setSkipLinkedTransaction] = useState(false);

  const [newTransaction, setNewTransaction] = useState({
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

      const { data: cardsData } = await supabase
        .from('cards')
        .select('id, name, bank_name, last_four_digits, type, current_balance')
        .eq('user_id', user.id);
      setCards(cardsData || []);

      const { data: cashTxData } = await supabase
        .from('cash_transactions')
        .select('type, amount')
        .eq('user_id', user.id);
      
      const currentCash = (cashTxData || []).reduce((sum, tx) => 
        tx.type === "ingreso" ? sum + tx.amount : sum - tx.amount, 0
      );
      setCashBalance(currentCash);

      if (!newTransaction.selectedExpenseCategoryId && expenseCategories.length > 0) {
        setNewTransaction(prev => ({ ...prev, selectedExpenseCategoryId: expenseCategories[0].id }));
      }

    } catch (error: any) {
      showError('Error al cargar detalles: ' + error.message);
      navigate('/creditors');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [creditorId, user, expenseCategories]);

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !creditor) return;

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
      let newCreditorBalance = creditor.current_balance;

      if (newTransaction.type === "charge") {
        newCreditorBalance += amount;
      } else {
        if (newCreditorBalance < amount - 0.01) {
          showError("El pago excede la deuda.");
          return;
        }
        newCreditorBalance -= amount;

        // Solo registrar egreso si NO se marcó "skipLinkedTransaction"
        if (!skipLinkedTransaction) {
          if (newTransaction.sourceAccountId === "cash") {
            if (cashBalance < amount) {
              showError("Saldo insuficiente en efectivo.");
              return;
            }
            await supabase.from('cash_transactions').insert({
              user_id: user.id,
              type: "egreso",
              amount,
              description: `Pago a ${creditor.name}: ${newTransaction.description}`,
              date: transactionDate,
              expense_category_id: newTransaction.selectedExpenseCategoryId || null,
            });
          } else {
            const card = cards.find(c => c.id === newTransaction.sourceAccountId);
            if (card) {
              if (card.type === "debit" && card.current_balance < amount) {
                showError("Saldo insuficiente en tarjeta.");
                return;
              }
              const newCardBalance = card.type === "credit" ? card.current_balance + amount : card.current_balance - amount;
              await supabase.from('cards').update({ current_balance: newCardBalance }).eq('id', card.id);
              await supabase.from('card_transactions').insert({
                user_id: user.id,
                card_id: card.id,
                type: "charge",
                amount,
                description: `Pago a ${creditor.name}: ${newTransaction.description}`,
                date: transactionDate,
                expense_category_id: newTransaction.selectedExpenseCategoryId || null,
              });
            }
          }
        }
      }

      await supabase.from('creditors').update({ current_balance: newCreditorBalance }).eq('id', creditor.id);
      await supabase.from('creditor_transactions').insert({
        user_id: user.id,
        creditor_id: creditor.id,
        type: newTransaction.type,
        amount,
        description: newTransaction.description + (skipLinkedTransaction ? " (Registro manual previo)" : ""),
        date: transactionDate,
      });

      showSuccess("Transacción registrada.");
      setIsTransactionDialogOpen(false);
      setSkipLinkedTransaction(false);
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
      showSuccess("Transacción eliminada.");
      fetchData();
    } catch (error: any) {
      showError('Error: ' + error.message);
    }
  };

  const handleExport = (formatType: 'csv' | 'pdf') => {
    if (!creditor) return;
    const data = creditor.creditor_transactions.map(tx => ({
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
        <Button variant="ghost" size="icon" onClick={() => navigate('/creditors')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">Gestión de Acreedor: {creditor.name}</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Deuda Pendiente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900">${creditor.current_balance.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Deuda Inicial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">${creditor.initial_balance.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={cn(creditor.current_balance <= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
              {creditor.current_balance <= 0 ? "Completado" : "Activo"}
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
              <DollarSign className="h-4 w-4 mr-1" /> Registrar Pago/Cargo
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
              {creditor.creditor_transactions
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{format(parseISO(tx.date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={tx.type === "charge" ? "text-red-600 border-red-200" : "text-green-600 border-green-200"}>
                      {tx.type === "charge" ? "Cargo" : "Pago"}
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
                          <AlertDialogDescription>Se ajustará la deuda del acreedor automáticamente.</AlertDialogDescription>
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
                  <SelectItem value="payment">Pago (Yo le pago)</SelectItem>
                  <SelectItem value="charge">Cargo (Le debo más)</SelectItem>
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
                <div className="flex items-center space-x-2 bg-blue-50 p-3 rounded-md border border-blue-100">
                  <Checkbox 
                    id="skip" 
                    checked={skipLinkedTransaction} 
                    onCheckedChange={(v) => setSkipLinkedTransaction(!!v)} 
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="skip"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
                    >
                      Ya registré este egreso manualmente <AlertCircle className="h-3 w-3 text-blue-500" />
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Marca esto si ya creaste el registro en "Lo que tienes" o "Tarjetas" para evitar duplicados.
                    </p>
                  </div>
                </div>

                {!skipLinkedTransaction && (
                  <>
                    <div className="grid gap-2">
                      <Label>Origen del Dinero</Label>
                      <Select value={newTransaction.sourceAccountId} onValueChange={(v) => setNewTransaction({...newTransaction, sourceAccountId: v})}>
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
                      <Label>Categoría de Egreso</Label>
                      <Select value={newTransaction.selectedExpenseCategoryId} onValueChange={(v) => setNewTransaction({...newTransaction, selectedExpenseCategoryId: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {expenseCategories.map(cat => (
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

export default CreditorDetailsPage;