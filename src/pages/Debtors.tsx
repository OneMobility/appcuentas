"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, DollarSign, History, Trash2, Edit, FileText, FileDown } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getLocalDateString } from "@/utils/date-helpers";
import { useCategoryContext } from "@/context/CategoryContext";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { evaluateExpression } from "@/utils/math-helpers"; // Importar la nueva función

interface DebtorTransaction {
  id: string;
  type: "charge" | "payment";
  amount: number;
  description: string;
  date: string;
  created_at: string; // Add created_at
  debtor_id?: string;
  user_id?: string;
}

interface Debtor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  debtor_transactions: DebtorTransaction[];
  user_id?: string;
}

interface CardData {
  id: string;
  name: string;
  bank_name: string;
  last_four_digits: string;
  type: "credit" | "debit";
  current_balance: number;
}

const Debtors = () => {
  const { user } = useSession();
  const { incomeCategories, isLoadingCategories } = useCategoryContext();
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [isAddDebtorDialogOpen, setIsAddDebtorDialogOpen] = useState(false);
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isEditTransactionDialogOpen, setIsEditTransactionDialogOpen] = useState(false);
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
  const [historyDebtor, setHistoryDebtor] = useState<Debtor | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<DebtorTransaction | null>(null);
  const [newDebtor, setNewDebtor] = useState({ name: "", initial_balance: "" });
  const [newTransaction, setNewTransaction] = useState({
    type: "payment" as "charge" | "payment",
    amount: "",
    description: "",
    sourceAccountType: "" as "cash" | "card" | "",
    sourceAccountId: "" as string | null,
    selectedIncomeCategoryId: "" as string | null,
  });
  const [cashBalance, setCashBalance] = useState(0);
  const [cards, setCards] = useState<CardData[]>([]);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");

  const fetchDebtors = async () => {
    if (!user) {
      setDebtors([]);
      return;
    }

    const { data, error } = await supabase
      .from('debtors')
      .select('*, debtor_transactions(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      showError('Error al cargar deudores: ' + error.message);
    } else {
      setDebtors(data || []);
    }
  };

  const fetchCashBalanceAndCards = async () => {
    if (!user) return;

    // Fetch cash balance
    const { data: cashTxData, error: cashTxError } = await supabase
      .from('cash_transactions')
      .select('type, amount')
      .eq('user_id', user.id);

    if (cashTxError) {
      showError('Error al cargar saldo en efectivo: ' + cashTxError.message);
    } else {
      const currentCashBalance = (cashTxData || []).reduce((sum, tx) => {
        return tx.type === "ingreso" ? sum + tx.amount : sum - tx.amount;
      }, 0);
      setCashBalance(currentCashBalance);
    }

    // Fetch cards
    const { data: cardsData, error: cardsError } = await supabase
      .from('cards')
      .select('id, name, bank_name, last_four_digits, type, current_balance')
      .eq('user_id', user.id);

    if (cardsError) {
      showError('Error al cargar tarjetas: ' + cardsError.message);
    } else {
      setCards(cardsData || []);
    }
  };

  useEffect(() => {
    if (user && !isLoadingCategories) {
      fetchDebtors();
      fetchCashBalanceAndCards();
    }
  }, [user, isLoadingCategories]);

  const totalDebtorsBalance = debtors.reduce((sum, debtor) => sum + debtor.current_balance, 0);

  const handleNewDebtorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewDebtor((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitNewDebtor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("Debes iniciar sesión para añadir deudores.");
      return;
    }

    let initialBalance: number;
    if (newDebtor.initial_balance.startsWith('=')) {
      const expression = newDebtor.initial_balance.substring(1);
      const result = evaluateExpression(expression);
      if (result !== null) {
        initialBalance = parseFloat(result.toFixed(2));
      } else {
        showError("Expresión matemática inválida para el saldo inicial.");
        return;
      }
    } else {
      initialBalance = parseFloat(newDebtor.initial_balance);
    }

    if (isNaN(initialBalance) || initialBalance <= 0) {
      showError("El saldo inicial debe ser un número positivo.");
      return;
    }

    const { data, error } = await supabase
      .from('debtors')
      .insert({
        user_id: user.id,
        name: newDebtor.name,
        initial_balance: initialBalance,
        current_balance: initialBalance,
      })
      .select();

    if (error) {
      showError('Error al registrar deudor: ' + error.message);
    } else {
      setDebtors((prev) => [...prev, { ...data[0], debtor_transactions: [] }]);
      setNewDebtor({ name: "", initial_balance: "" });
      setIsAddDebtorDialogOpen(false);
      showSuccess("Deudor registrado exitosamente.");
    }
  };

  const handleDeleteDebtor = async (debtorId: string) => {
    if (!user) {
      showError("Debes iniciar sesión para eliminar deudores.");
      return;
    }

    const { error } = await supabase
      .from('debtors')
      .delete()
      .eq('id', debtorId)
      .eq('user_id', user.id);

    if (error) {
      showError('Error al eliminar deudor: ' + error.message);
    } else {
      setDebtors((prev) => prev.filter((debtor) => debtor.id !== debtorId));
      showSuccess("Deudor eliminado exitosamente.");
    }
  };

  const handleOpenAddTransactionDialog = (debtorId: string) => {
    setSelectedDebtorId(debtorId);
    setNewTransaction({ type: "payment", amount: "", description: "", sourceAccountType: "", sourceAccountId: null, selectedIncomeCategoryId: null });
    setIsAddTransactionDialogOpen(true);
  };

  const handleOpenHistoryDialog = (debtor: Debtor) => {
    setHistoryDebtor(debtor);
    setIsHistoryDialogOpen(true);
  };

  const handleTransactionInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewTransaction((prev) => ({ ...prev, [name]: value }));
  };

  const handleTransactionTypeChange = (value: "charge" | "payment") => {
    setNewTransaction((prev) => ({ ...prev, type: value, sourceAccountType: "", sourceAccountId: null, selectedIncomeCategoryId: null }));
  };

  const handleSourceAccountTypeChange = (value: "cash" | "card") => {
    setNewTransaction((prev) => ({ ...prev, sourceAccountType: value, sourceAccountId: null }));
  };

  const handleSourceAccountIdChange = (value: string) => {
    setNewTransaction((prev) => ({ ...prev, sourceAccountId: value }));
  };

  const handleIncomeCategorySelectChange = (value: string) => {
    setNewTransaction((prev) => ({ ...prev, selectedIncomeCategoryId: value }));
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDebtorId) {
      showError("Debes iniciar sesión para registrar transacciones.");
      return;
    }

    let amount: number;
    if (newTransaction.amount.startsWith('=')) {
      const expression = newTransaction.amount.substring(1);
      const result = evaluateExpression(expression);
      if (result !== null) {
        amount = parseFloat(result.toFixed(2));
      } else {
        showError("Expresión matemática inválida para el monto.");
        return;
      }
    } else {
      amount = parseFloat(newTransaction.amount);
    }

    if (isNaN(amount) || amount <= 0) {
      showError("El monto debe ser un número positivo.");
      return;
    }
    if (!newTransaction.description.trim()) {
      showError("La descripción no puede estar vacía.");
      return;
    }

    const currentDebtor = debtors.find(d => d.id === selectedDebtorId);
    if (!currentDebtor) {
      showError("Deudor no encontrado.");
      return;
    }

    let newDebtorBalance = currentDebtor.current_balance;
    let transactionDate = getLocalDateString(new Date());

    try {
      // Update debtor's balance
      if (newTransaction.type === "charge") {
        newDebtorBalance += amount;
      } else { // payment from debtor to us (ingreso)
        if (newDebtorBalance < amount) {
          showError("El abono excede el saldo pendiente del deudor.");
          return;
        }
        newDebtorBalance -= amount;

        // If it's a payment from debtor, record it in our cash/card
        if (!newTransaction.sourceAccountType) {
          showError("Por favor, selecciona a qué cuenta va este abono.");
          return;
        }
        if (!newTransaction.selectedIncomeCategoryId) {
          showError("Por favor, selecciona una categoría de ingreso.");
          return;
        }

        if (newTransaction.sourceAccountType === "cash") {
          const { error: cashTxError } = await supabase
            .from('cash_transactions')
            .insert({
              user_id: user.id,
              type: "ingreso",
              amount: amount,
              description: `Abono de ${currentDebtor.name}: ${newTransaction.description}`,
              date: transactionDate,
              income_category_id: newTransaction.selectedIncomeCategoryId,
            });
          if (cashTxError) throw cashTxError;
          setCashBalance(prev => prev + amount);
        } else if (newTransaction.sourceAccountType === "card" && newTransaction.sourceAccountId) {
          const selectedCard = cards.find(c => c.id === newTransaction.sourceAccountId);
          if (!selectedCard) {
            showError("Tarjeta de destino no encontrada.");
            return;
          }

          let newCardBalance = selectedCard.current_balance;
          
          // FIX: Correct logic for card balance update
          if (selectedCard.type === "credit") {
            newCardBalance -= amount; // Payment reduces debt (current_balance)
          } else { // Debit card
            newCardBalance += amount; // Payment increases balance (current_balance)
          }

          const { error: cardUpdateError } = await supabase
            .from('cards')
            .update({ current_balance: newCardBalance })
            .eq('id', newTransaction.sourceAccountId)
            .eq('user_id', user.id);
          if (cardUpdateError) throw cardUpdateError;

          const { error: cardTxError } = await supabase
            .from('card_transactions')
            .insert({
              user_id: user.id,
              card_id: newTransaction.sourceAccountId,
              type: "payment",
              amount: amount,
              description: `Abono de ${currentDebtor.name} a tarjeta ${selectedCard.name}: ${newTransaction.description}`,
              date: transactionDate,
              income_category_id: newTransaction.selectedIncomeCategoryId,
            });
          if (cardTxError) throw cardTxError;
          // Llama a fetchCashBalanceAndCards para actualizar el estado local de las tarjetas
          await fetchCashBalanceAndCards(); 
        }
      }

      // Record transaction in debtor_transactions
      const { data: debtorTransactionData, error: debtorTransactionError } = await supabase
        .from('debtor_transactions')
        .insert({
          user_id: user.id,
          debtor_id: selectedDebtorId,
          type: newTransaction.type,
          amount,
          description: newTransaction.description,
          date: transactionDate,
        })
        .select();
      if (debtorTransactionError) throw debtorTransactionError;

      // Update debtor's current balance in the debtors table
      const { data: updatedDebtorData, error: debtorUpdateError } = await supabase
        .from('debtors')
        .update({ current_balance: newDebtorBalance })
        .eq('id', selectedDebtorId)
        .eq('user_id', user.id)
        .select();
      if (debtorUpdateError) throw debtorUpdateError;

      // Check if debtor balance is zero or less and delete if so
      if (newDebtorBalance <= 0) {
        const { error: deleteDebtorError } = await supabase
          .from('debtors')
          .delete()
          .eq('id', selectedDebtorId)
          .eq('user_id', user.id);
        if (deleteDebtorError) throw deleteDebtorError;
        setDebtors((prev) => prev.filter((d) => d.id !== selectedDebtorId));
        showSuccess(`Deudor ${currentDebtor.name} saldado y eliminado exitosamente.`);
      } else {
        setDebtors((prev) =>
          prev.map((debtor) => {
            if (debtor.id === selectedDebtorId) {
              return {
                ...debtor,
                current_balance: newDebtorBalance,
                debtor_transactions: [...debtor.debtor_transactions, debtorTransactionData[0]],
              };
            }
            return debtor;
          })
        );
        showSuccess("Transacción registrada exitosamente.");
      }
      
      setNewTransaction({ type: "payment", amount: "", description: "", sourceAccountType: "", sourceAccountId: null, selectedIncomeCategoryId: null });
      setSelectedDebtorId(null);
      setIsAddTransactionDialogOpen(false);
    } catch (error: any) {
      showError('Error al registrar transacción: ' + error.message);
      console.error("Debtor transaction error:", error);
    }
  };

  const handleOpenEditTransactionDialog = (transaction: DebtorTransaction, debtorId: string) => {
    setEditingTransaction(transaction);
    setSelectedDebtorId(debtorId);
    setNewTransaction({
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description,
      sourceAccountType: "",
      sourceAccountId: null,
      selectedIncomeCategoryId: null,
    });
    setIsEditTransactionDialogOpen(true);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingTransaction || !selectedDebtorId) {
      showError("No se ha seleccionado una transacción o deudor para actualizar.");
      return;
    }

    const oldAmount = editingTransaction.amount;
    const oldType = editingTransaction.type;
    
    let newAmount: number;
    if (newTransaction.amount.startsWith('=')) {
      const expression = newTransaction.amount.substring(1);
      const result = evaluateExpression(expression);
      if (result !== null) {
        newAmount = parseFloat(result.toFixed(2));
      } else {
        showError("Expresión matemática inválida para el monto.");
        return;
      }
    } else {
      newAmount = parseFloat(newTransaction.amount);
    }

    const newType = newTransaction.type;

    if (isNaN(newAmount) || newAmount <= 0) {
      showError("El monto debe ser un número positivo.");
      return;
    }
    if (!newTransaction.description.trim()) {
      showError("La descripción no puede estar vacía.");
      return;
    }

    const currentDebtor = debtors.find(d => d.id === selectedDebtorId);
    if (!currentDebtor) {
      showError("Deudor no encontrado.");
      return;
    }

    let newDebtorBalance = currentDebtor.current_balance;

    // Revertir el impacto de la transacción antigua en el saldo del deudor
    newDebtorBalance = oldType === "charge" ? newDebtorBalance - oldAmount : newDebtorBalance + oldAmount;

    // Aplicar el impacto de la nueva transacción en el saldo del deudor
    if (newType === "charge") {
      newDebtorBalance += newAmount;
    } else { // payment
      if (newDebtorBalance < newAmount) {
        showError("El abono excede el saldo pendiente.");
        return;
      }
      newDebtorBalance -= newAmount;
    }

    try {
      const { data: updatedTransactionData, error: transactionError } = await supabase
        .from('debtor_transactions')
        .update({
          type: newType,
          amount: newAmount,
          description: newTransaction.description,
          date: getLocalDateString(new Date()),
        })
        .eq('id', editingTransaction.id)
        .eq('user_id', user.id)
        .select();
      if (transactionError) throw transactionError;

      const { data: debtorData, error: debtorError } = await supabase
        .from('debtors')
        .update({ current_balance: newDebtorBalance })
        .eq('id', currentDebtor.id)
        .eq('user_id', user.id)
        .select();
      if (debtorError) throw debtorError;

      // Check if debtor balance is zero or less and delete if so
      if (newDebtorBalance <= 0) {
        const { error: deleteDebtorError } = await supabase
          .from('debtors')
          .delete()
          .eq('id', selectedDebtorId)
          .eq('user_id', user.id);
        if (deleteDebtorError) throw deleteDebtorError;
        setDebtors((prev) => prev.filter((d) => d.id !== selectedDebtorId));
        showSuccess(`Deudor ${currentDebtor.name} saldado y eliminado exitosamente.`);
        setIsEditTransactionDialogOpen(false);
        setHistoryDebtor(null); // Close history dialog if open for this debtor
      } else {
        setDebtors((prevDebtors) =>
          prevDebtors.map((debtor) => {
            if (debtor.id === currentDebtor.id) {
              return {
                ...debtor,
                current_balance: newDebtorBalance,
                debtor_transactions: debtor.debtor_transactions.map(t => t.id === editingTransaction.id ? updatedTransactionData[0] : t),
              };
            }
            return debtor;
          })
        );

        setHistoryDebtor((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            current_balance: newDebtorBalance,
            debtor_transactions: prev.debtor_transactions.map(t => t.id === editingTransaction.id ? updatedTransactionData[0] : t),
          };
        });
        showSuccess("Transacción actualizada exitosamente.");
        setIsEditTransactionDialogOpen(false);
      }

      setNewTransaction({ type: "payment", amount: "", description: "", sourceAccountType: "", sourceAccountId: null, selectedIncomeCategoryId: null });
      setEditingTransaction(null);
      setSelectedDebtorId(null);
    } catch (error: any) {
      showError('Error al actualizar transacción: ' + error.message);
      console.error("Debtor transaction update error:", error);
    }
  };

  const handleDeleteDebtorTransaction = async (transactionId: string, debtorId: string, transactionAmount: number, transactionType: "charge" | "payment") => {
    if (!user) {
      showError("Debes iniciar sesión para eliminar transacciones.");
      return;
    }

    const currentDebtor = debtors.find(d => d.id === debtorId);
    if (!currentDebtor) {
      showError("Deudor no encontrado.");
      return;
    }

    let newDebtorBalance = currentDebtor.current_balance;
    // Revertir el impacto de la transacción eliminada en el saldo
    newDebtorBalance = transactionType === "charge" ? newDebtorBalance - transactionAmount : newDebtorBalance + transactionAmount;

    try {
      const { error: transactionError } = await supabase
        .from('debtor_transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user.id);
      if (transactionError) throw transactionError;

      const { error: debtorError } = await supabase
        .from('debtors')
        .update({ current_balance: newDebtorBalance })
        .eq('id', debtorId)
        .eq('user_id', user.id);
      if (debtorError) throw debtorError;

      // Check if debtor balance is zero or less and delete if so
      if (newDebtorBalance <= 0) {
        const { error: deleteDebtorError } = await supabase
          .from('debtors')
          .delete()
          .eq('id', debtorId)
          .eq('user_id', user.id);
        if (deleteDebtorError) throw deleteDebtorError;
        setDebtors((prev) => prev.filter((d) => d.id !== debtorId));
        showSuccess(`Deudor ${currentDebtor.name} saldado y eliminado exitosamente.`);
        setIsHistoryDialogOpen(false); // Close history dialog if open for this debtor
      } else {
        setDebtors((prevDebtors) =>
          prevDebtors.map((debtor) => {
            if (debtor.id === debtorId) {
              return {
                ...debtor,
                current_balance: newDebtorBalance,
                debtor_transactions: debtor.debtor_transactions.filter(t => t.id !== transactionId),
              };
            }
            return debtor;
          })
        );

        setHistoryDebtor((prev) => {
          if (!prev || prev.id !== debtorId) return prev;
          return {
            ...prev,
            current_balance: newDebtorBalance,
            debtor_transactions: prev.debtor_transactions.filter(t => t.id !== transactionId),
          };
        });
        showSuccess("Transacción eliminada exitosamente.");
      }
    } catch (error: any) {
      showError('Error al eliminar transacción: ' + error.message);
      console.error("Debtor transaction delete error:", error);
    }
  };

  const filteredDebtors = debtors.filter((debtor) =>
    debtor.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = (formatType: 'csv' | 'pdf') => {
    const dataToExport = filteredDebtors.map(debtor => ({
      Nombre: debtor.name,
      "Saldo Inicial": debtor.initial_balance.toFixed(2),
      "Saldo Actual": debtor.current_balance.toFixed(2),
    }));

    const filename = `deudores_${format(new Date(), "yyyyMMdd_HHmmss")}`;
    const title = "Reporte de Deudores";
    const headers = ["Nombre", "Saldo Inicial", "Saldo Actual"];
    const pdfData = dataToExport.map(row => Object.values(row));

    if (formatType === 'csv') {
      exportToCsv(`${filename}.csv`, dataToExport);
      showSuccess("Deudores exportados a CSV.");
    } else {
      exportToPdf(`${filename}.pdf`, title, headers, pdfData);
      showSuccess("Deudores exportados a PDF.");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Los que te deben</h1>

      <Card className="border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800">
        <CardHeader>
          <CardTitle>Saldo Total de Deudores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">${totalDebtorsBalance.toFixed(2)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lista de Deudores</CardTitle>
          <div className="flex gap-2">
            <Dialog open={isAddDebtorDialogOpen} onOpenChange={setIsAddDebtorDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Añadir Deudor
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Añadir Nuevo Deudor</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmitNewDebtor} className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Nombre
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={newDebtor.name}
                      onChange={handleNewDebtorChange}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="initial_balance" className="text-right">
                      Saldo Inicial
                    </Label>
                    <Input
                      id="initial_balance"
                      name="initial_balance"
                      type="text" // Cambiado a text para permitir '='
                      step="0.01"
                      value={newDebtor.initial_balance}
                      onChange={handleNewDebtorChange}
                      className="col-span-3"
                      required
                      placeholder="Ej. 100 o =50+20*2"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Guardar Deudor</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <FileDown className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Exportar
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  <FileText className="mr-2 h-4 w-4" /> Exportar a CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>
                  <FileText className="mr-2 h-4 w-4" /> Exportar a PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Buscar deudor por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Saldo Inicial</TableHead>
                  <TableHead>Saldo Actual</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDebtors.map((debtor) => (
                  <TableRow key={debtor.id}>
                    <TableCell>{debtor.name}</TableCell>
                    <TableCell>${debtor.initial_balance.toFixed(2)}</TableCell>
                    <TableCell>${debtor.current_balance.toFixed(2)}</TableCell>
                    <TableCell className="text-right flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAddTransactionDialog(debtor.id)}
                        className="h-8 gap-1"
                      >
                        <DollarSign className="h-3.5 w-3.5" />
                        Transacción
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenHistoryDialog(debtor)}
                        className="h-8 gap-1"
                      >
                        <History className="h-3.5 w-3.5" />
                        Historial
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Esto eliminará permanentemente al deudor 
                              **{debtor.name}** y todas sus transacciones asociadas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteDebtor(debtor.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Registrar Transacción para {debtors.find(d => d.id === selectedDebtorId)?.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitTransaction} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="transactionType" className="text-right">
                    Tipo
                  </Label>
                  <Select value={newTransaction.type} onValueChange={handleTransactionTypeChange}>
                    <SelectTrigger id="transactionType" className="col-span-3">
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="charge">Cargo (Deudor nos debe más)</SelectItem>
                      <SelectItem value="payment">Abono (Deudor nos paga)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="transactionAmount" className="text-right">
                    Monto
                  </Label>
                  <Input
                    id="transactionAmount"
                    name="amount"
                    type="text" // Cambiado a text para permitir '='
                    step="0.01"
                    value={newTransaction.amount}
                    onChange={handleTransactionInputChange}
                    className="col-span-3"
                    required
                    placeholder="Ej. 100 o =50+20*2"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="transactionDescription" className="text-right">
                    Descripción
                  </Label>
                  <Input
                    id="transactionDescription"
                    name="description"
                    value={newTransaction.description}
                    onChange={handleTransactionInputChange}
                    className="col-span-3"
                    required
                  />
                </div>
                {newTransaction.type === "payment" && (
                  <>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="sourceAccountType" className="text-right">
                        Abonar a
                      </Label>
                      <Select value={newTransaction.sourceAccountType} onValueChange={handleSourceAccountTypeChange}>
                        <SelectTrigger id="sourceAccountType" className="col-span-3">
                          <SelectValue placeholder="Selecciona cuenta de destino" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Efectivo (Saldo: ${cashBalance.toFixed(2)})</SelectItem>
                          {cards.filter(c => c.type === "debit" || c.type === "credit").map(card => (
                            <SelectItem key={card.id} value={card.id}>
                              Tarjeta {card.name} ({card.bank_name} ****{card.last_four_digits}) (Saldo: ${card.current_balance.toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {newTransaction.sourceAccountType === "card" && (
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="sourceAccountId" className="text-right">
                          Tarjeta
                        </Label>
                        <Select value={newTransaction.sourceAccountId || ""} onValueChange={handleSourceAccountIdChange}>
                          <SelectTrigger id="sourceAccountId" className="col-span-3">
                            <SelectValue placeholder="Selecciona tarjeta" />
                          </SelectTrigger>
                          <SelectContent>
                            {cards.filter(c => c.type === "debit" || c.type === "credit").map(card => (
                              <SelectItem key={card.id} value={card.id}>
                                Tarjeta {card.name} ({card.bank_name} ****{card.last_four_digits}) (Saldo: ${card.current_balance.toFixed(2)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="incomeCategory" className="text-right">
                        Categoría de Ingreso
                      </Label>
                      <Select value={newTransaction.selectedIncomeCategoryId || ""} onValueChange={handleIncomeCategorySelectChange}>
                        <SelectTrigger id="incomeCategory" className="col-span-3">
                          <SelectValue placeholder="Selecciona categoría de ingreso" />
                        </SelectTrigger>
                        <SelectContent>
                          {incomeCategories.map((cat) => (
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
                  <Button type="submit">Registrar Transacción</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Historial de Transacciones para {historyDebtor?.name}</DialogTitle>
              </DialogHeader>
              <div className="py-4 overflow-x-auto">
                {historyDebtor?.debtor_transactions && historyDebtor.debtor_transactions.length > 0 ? (
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
                      {historyDebtor.debtor_transactions
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) // Sort by created_at
                        .map((transaction, index) => (
                        <TableRow key={transaction.id || index}>
                          <TableCell>{format(new Date(transaction.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                          <TableCell className={transaction.type === "charge" ? "text-red-600" : "text-green-600"}>
                            {transaction.type === "charge" ? "Cargo" : "Abono"}
                          </TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell className="text-right">
                            {transaction.type === "charge" ? "+" : "-"}${transaction.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditTransactionDialog(transaction, historyDebtor.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span className="sr-only">Editar</span>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="sr-only">Eliminar</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Esto eliminará permanentemente la transacción de {transaction.type === "charge" ? "cargo" : "abono"} por ${transaction.amount.toFixed(2)}: "{transaction.description}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteDebtorTransaction(transaction.id, historyDebtor.id, transaction.amount, transaction.type)}>
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground">No hay historial de transacciones para este deudor.</p>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setIsHistoryDialogOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditTransactionDialogOpen} onOpenChange={setIsEditTransactionDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Editar Transacción</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateTransaction} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editTransactionType" className="text-right">
                    Tipo
                  </Label>
                  <Select value={newTransaction.type} onValueChange={handleTransactionTypeChange}>
                    <SelectTrigger id="editTransactionType" className="col-span-3">
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="charge">Cargo</SelectItem>
                      <SelectItem value="payment">Abono</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editTransactionAmount" className="text-right">
                    Monto
                  </Label>
                  <Input
                    id="editTransactionAmount"
                    name="amount"
                    type="text" // Cambiado a text para permitir '='
                    step="0.01"
                    value={newTransaction.amount}
                    onChange={handleTransactionInputChange}
                    className="col-span-3"
                    required
                    placeholder="Ej. 100 o =50+20*2"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editTransactionDescription" className="text-right">
                    Descripción
                  </Label>
                  <Input
                    id="editTransactionDescription"
                    name="description"
                    value={newTransaction.description}
                    onChange={handleTransactionInputChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Actualizar Transacción</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default Debtors;