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
import { getLocalDateString } from "@/utils/date-helpers"; // Importar la nueva función de utilidad

interface DebtorTransaction {
  id: string;
  type: "charge" | "payment"; // 'charge' para cargo, 'payment' para abono
  amount: number;
  description: string;
  date: string;
  debtor_id?: string;
  user_id?: string;
}

interface Debtor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  debtor_transactions: DebtorTransaction[]; // Renombrado de 'payments'
  user_id?: string;
}

const Debtors = () => {
  const { user } = useSession();
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [isAddDebtorDialogOpen, setIsAddDebtorDialogOpen] = useState(false);
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false); // Renombrado
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isEditTransactionDialogOpen, setIsEditTransactionDialogOpen] = useState(false); // Renombrado
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
  const [historyDebtor, setHistoryDebtor] = useState<Debtor | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<DebtorTransaction | null>(null); // Renombrado
  const [newDebtor, setNewDebtor] = useState({ name: "", initial_balance: "" });
  const [newTransaction, setNewTransaction] = useState({ // Nuevo estado para transacciones
    type: "payment" as "charge" | "payment",
    amount: "",
    description: "",
  });

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");

  const fetchDebtors = async () => {
    if (!user) {
      setDebtors([]);
      return;
    }

    const { data, error } = await supabase
      .from('debtors')
      .select('*, debtor_transactions(*)') // Seleccionar la nueva tabla
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      showError('Error al cargar deudores: ' + error.message);
    } else {
      setDebtors(data || []);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDebtors();
    }
  }, [user]);

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

    const initialBalance = parseFloat(newDebtor.initial_balance);
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

  const handleOpenAddTransactionDialog = (debtorId: string) => { // Renombrado
    setSelectedDebtorId(debtorId);
    setNewTransaction({ type: "payment", amount: "", description: "" }); // Resetear formulario
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
    setNewTransaction((prev) => ({ ...prev, type: value }));
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => { // Renombrado
    e.preventDefault();
    if (!user || !selectedDebtorId) {
      showError("Debes iniciar sesión para registrar transacciones.");
      return;
    }

    const amount = parseFloat(newTransaction.amount);
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

    let newBalance = currentDebtor.current_balance;
    if (newTransaction.type === "charge") {
      newBalance += amount;
    } else { // payment
      if (newBalance < amount) {
        showError("El abono excede el saldo pendiente.");
        return;
      }
      newBalance -= amount;
    }

    const { data: transactionData, error: transactionError } = await supabase
      .from('debtor_transactions') // Usar la nueva tabla
      .insert({
        user_id: user.id,
        debtor_id: selectedDebtorId,
        type: newTransaction.type,
        amount,
        description: newTransaction.description,
        date: getLocalDateString(new Date()), // Usar getLocalDateString
      })
      .select();

    if (transactionError) {
      showError('Error al registrar transacción: ' + transactionError.message);
      return;
    }

    const { data: debtorData, error: debtorError } = await supabase
      .from('debtors')
      .update({ current_balance: newBalance })
      .eq('id', selectedDebtorId)
      .eq('user_id', user.id)
      .select();

    if (debtorError) {
      showError('Error al actualizar saldo del deudor: ' + debtorError.message);
      return;
    }

    setDebtors((prevDebtors) =>
      prevDebtors.map((debtor) => {
        if (debtor.id === selectedDebtorId) {
          return {
            ...debtor,
            current_balance: newBalance,
            debtor_transactions: [...debtor.debtor_transactions, transactionData[0]],
          };
        }
        return debtor;
      })
    );
    setNewTransaction({ type: "payment", amount: "", description: "" });
    setSelectedDebtorId(null);
    setIsAddTransactionDialogOpen(false);
    showSuccess("Transacción registrada exitosamente.");
  };

  const handleOpenEditTransactionDialog = (transaction: DebtorTransaction, debtorId: string) => { // Renombrado
    setEditingTransaction(transaction);
    setSelectedDebtorId(debtorId);
    setNewTransaction({
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description,
    });
    setIsEditTransactionDialogOpen(true);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => { // Renombrado
    e.preventDefault();
    if (!user || !editingTransaction || !selectedDebtorId) {
      showError("No se ha seleccionado una transacción o deudor para actualizar.");
      return;
    }

    const oldAmount = editingTransaction.amount;
    const oldType = editingTransaction.type;
    const newAmount = parseFloat(newTransaction.amount);
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

    // Revertir el impacto de la transacción antigua en el saldo
    newDebtorBalance = oldType === "charge" ? newDebtorBalance - oldAmount : newDebtorBalance + oldAmount;

    // Aplicar el impacto de la nueva transacción en el saldo
    if (newType === "charge") {
      newDebtorBalance += newAmount;
    } else { // payment
      if (newDebtorBalance < newAmount) {
        showError("El abono excede el saldo pendiente.");
        return;
      }
      newDebtorBalance -= newAmount;
    }

    const { data: updatedTransactionData, error: transactionError } = await supabase
      .from('debtor_transactions') // Usar la nueva tabla
      .update({
        type: newType,
        amount: newAmount,
        description: newTransaction.description,
        date: getLocalDateString(new Date()), // Usar getLocalDateString
      })
      .eq('id', editingTransaction.id)
      .eq('user_id', user.id)
      .select();

    if (transactionError) {
      showError('Error al actualizar transacción: ' + transactionError.message);
      return;
    }

    const { data: debtorData, error: debtorError } = await supabase
      .from('debtors')
      .update({ current_balance: newDebtorBalance })
      .eq('id', currentDebtor.id)
      .eq('user_id', user.id)
      .select();

    if (debtorError) {
      showError('Error al actualizar saldo del deudor: ' + debtorError.message);
      return;
    }

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

    setNewTransaction({ type: "payment", amount: "", description: "" });
    setEditingTransaction(null);
    setSelectedDebtorId(null);
    setIsEditTransactionDialogOpen(false);
    showSuccess("Transacción actualizada exitosamente.");
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

    const { error: transactionError } = await supabase
      .from('debtor_transactions')
      .delete()
      .eq('id', transactionId)
      .eq('user_id', user.id);

    if (transactionError) {
      showError('Error al eliminar transacción: ' + transactionError.message);
      return;
    }

    const { error: debtorError } = await supabase
      .from('debtors')
      .update({ current_balance: newDebtorBalance })
      .eq('id', debtorId)
      .eq('user_id', user.id);

    if (debtorError) {
      showError('Error al actualizar saldo del deudor después de eliminar transacción: ' + debtorError.message);
      return;
    }

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
                      type="number"
                      step="0.01"
                      value={newDebtor.initial_balance}
                      onChange={handleNewDebtorChange}
                      className="col-span-3"
                      required
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
                        onClick={() => handleOpenAddTransactionDialog(debtor.id)} // Renombrado
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
          <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}> {/* Renombrado */}
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Registrar Transacción para {debtors.find(d => d.id === selectedDebtorId)?.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitTransaction} className="grid gap-4 py-4"> {/* Renombrado */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="transactionType" className="text-right">
                    Tipo
                  </Label>
                  <Select value={newTransaction.type} onValueChange={handleTransactionTypeChange}>
                    <SelectTrigger id="transactionType" className="col-span-3">
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="charge">Cargo</SelectItem>
                      <SelectItem value="payment">Abono</SelectItem>
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
                    type="number"
                    step="0.01"
                    value={newTransaction.amount}
                    onChange={handleTransactionInputChange}
                    className="col-span-3"
                    required
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
                      {historyDebtor.debtor_transactions.map((transaction, index) => (
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
                    type="number"
                    step="0.01"
                    value={newTransaction.amount}
                    onChange={handleTransactionInputChange}
                    className="col-span-3"
                    required
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