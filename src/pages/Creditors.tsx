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

interface CreditorTransaction {
  id: string;
  type: "charge" | "payment"; // 'charge' para cargo, 'payment' para pago
  amount: number;
  description: string;
  date: string;
  creditor_id?: string;
  user_id?: string;
}

interface Creditor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  creditor_transactions: CreditorTransaction[]; // Renombrado de 'payments'
  user_id?: string;
}

const Creditors = () => {
  const { user } = useSession();
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [isAddCreditorDialogOpen, setIsAddCreditorDialogOpen] = useState(false);
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false); // Renombrado
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isEditTransactionDialogOpen, setIsEditTransactionDialogOpen] = useState(false); // Renombrado
  const [selectedCreditorId, setSelectedCreditorId] = useState<string | null>(null);
  const [historyCreditor, setHistoryCreditor] = useState<Creditor | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<CreditorTransaction | null>(null); // Renombrado
  const [newCreditor, setNewCreditor] = useState({ name: "", initial_balance: "" });
  const [newTransaction, setNewTransaction] = useState({ // Nuevo estado para transacciones
    type: "payment" as "charge" | "payment",
    amount: "",
    description: "",
  });

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");

  const fetchCreditors = async () => {
    if (!user) {
      setCreditors([]);
      return;
    }

    const { data, error } = await supabase
      .from('creditors')
      .select('*, creditor_transactions(*)') // Seleccionar la nueva tabla
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      showError('Error al cargar acreedores: ' + error.message);
    } else {
      setCreditors(data || []);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCreditors();
    }
  }, [user]);

  const totalCreditorsBalance = creditors.reduce((sum, creditor) => sum + creditor.current_balance, 0);

  const handleNewCreditorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewCreditor((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitNewCreditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("Debes iniciar sesión para añadir acreedores.");
      return;
    }

    const initialBalance = parseFloat(newCreditor.initial_balance);
    if (isNaN(initialBalance) || initialBalance <= 0) {
      showError("El saldo inicial debe ser un número positivo.");
      return;
    }

    const { data, error } = await supabase
      .from('creditors')
      .insert({
        user_id: user.id,
        name: newCreditor.name,
        initial_balance: initialBalance,
        current_balance: initialBalance,
      })
      .select();

    if (error) {
      showError('Error al registrar acreedor: ' + error.message);
    } else {
      setCreditors((prev) => [...prev, { ...data[0], creditor_transactions: [] }]);
      setNewCreditor({ name: "", initial_balance: "" });
      setIsAddCreditorDialogOpen(false);
      showSuccess("Acreedor registrado exitosamente.");
    }
  };

  const handleDeleteCreditor = async (creditorId: string) => {
    if (!user) {
      showError("Debes iniciar sesión para eliminar acreedores.");
      return;
    }

    const { error } = await supabase
      .from('creditors')
      .delete()
      .eq('id', creditorId)
      .eq('user_id', user.id);

    if (error) {
      showError('Error al eliminar acreedor: ' + error.message);
    } else {
      setCreditors((prev) => prev.filter((creditor) => creditor.id !== creditorId));
      showSuccess("Acreedor eliminado exitosamente.");
    }
  };

  const handleOpenAddTransactionDialog = (creditorId: string) => { // Renombrado
    setSelectedCreditorId(creditorId);
    setNewTransaction({ type: "payment", amount: "", description: "" }); // Resetear formulario
    setIsAddTransactionDialogOpen(true);
  };

  const handleOpenHistoryDialog = (creditor: Creditor) => {
    setHistoryCreditor(creditor);
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
    if (!user || !selectedCreditorId) {
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

    const currentCreditor = creditors.find(d => d.id === selectedCreditorId);
    if (!currentCreditor) {
      showError("Acreedor no encontrado.");
      return;
    }

    let newBalance = currentCreditor.current_balance;
    if (newTransaction.type === "charge") {
      newBalance += amount;
    } else { // payment
      if (newBalance < amount) {
        showError("El pago excede el saldo pendiente.");
        return;
      }
      newBalance -= amount;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Establecer a inicio del día local

    const { data: transactionData, error: transactionError } = await supabase
      .from('creditor_transactions') // Usar la nueva tabla
      .insert({
        user_id: user.id,
        creditor_id: selectedCreditorId,
        type: newTransaction.type,
        amount,
        description: newTransaction.description,
        date: format(today, "yyyy-MM-dd"), // Usar la fecha local del dispositivo
      })
      .select();

    if (transactionError) {
      showError('Error al registrar transacción: ' + transactionError.message);
      return;
    }

    const { data: creditorData, error: creditorError } = await supabase
      .from('creditors')
      .update({ current_balance: newBalance })
      .eq('id', selectedCreditorId)
      .eq('user_id', user.id)
      .select();

    if (creditorError) {
      showError('Error al actualizar saldo del acreedor: ' + creditorError.message);
      return;
    }

    setCreditors((prevCreditors) =>
      prevCreditors.map((creditor) => {
        if (creditor.id === selectedCreditorId) {
          return {
            ...creditor,
            current_balance: newBalance,
            creditor_transactions: [...creditor.creditor_transactions, transactionData[0]],
          };
        }
        return creditor;
      })
    );
    setNewTransaction({ type: "payment", amount: "", description: "" });
    setSelectedCreditorId(null);
    setIsAddTransactionDialogOpen(false);
    showSuccess("Transacción registrada exitosamente.");
  };

  const handleOpenEditTransactionDialog = (transaction: CreditorTransaction, creditorId: string) => { // Renombrado
    setEditingTransaction(transaction);
    setSelectedCreditorId(creditorId);
    setNewTransaction({
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description,
    });
    setIsEditTransactionDialogOpen(true);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => { // Renombrado
    e.preventDefault();
    if (!user || !editingTransaction || !selectedCreditorId) {
      showError("No se ha seleccionado una transacción o acreedor para actualizar.");
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

    const currentCreditor = creditors.find(d => d.id === selectedCreditorId);
    if (!currentCreditor) {
      showError("Acreedor no encontrado.");
      return;
    }

    let newCreditorBalance = currentCreditor.current_balance;

    // Revertir el impacto de la transacción antigua en el saldo
    newCreditorBalance = oldType === "charge" ? newCreditorBalance - oldAmount : newCreditorBalance + oldAmount;

    // Aplicar el impacto de la nueva transacción en el saldo
    if (newType === "charge") {
      newCreditorBalance += newAmount;
    } else { // payment
      if (newCreditorBalance < newAmount) {
        showError("El pago excede el saldo pendiente.");
        return;
      }
      newCreditorBalance -= newAmount;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Establecer a inicio del día local

    const { data: updatedTransactionData, error: transactionError } = await supabase
      .from('creditor_transactions') // Usar la nueva tabla
      .update({
        type: newType,
        amount: newAmount,
        description: newTransaction.description,
        date: format(today, "yyyy-MM-dd"), // Usar la fecha local del dispositivo
      })
      .eq('id', editingTransaction.id)
      .eq('user_id', user.id)
      .select();

    if (transactionError) {
      showError('Error al actualizar transacción: ' + transactionError.message);
      return;
    }

    const { data: creditorData, error: creditorError } = await supabase
      .from('creditors')
      .update({ current_balance: newCreditorBalance })
      .eq('id', currentCreditor.id)
      .eq('user_id', user.id)
      .select();

    if (creditorError) {
      showError('Error al actualizar saldo del acreedor: ' + creditorError.message);
      return;
    }

    setCreditors((prevCreditors) =>
      prevCreditors.map((creditor) => {
        if (creditor.id === currentCreditor.id) {
          return {
            ...creditor,
            current_balance: newCreditorBalance,
            creditor_transactions: creditor.creditor_transactions.map(t => t.id === editingTransaction.id ? updatedTransactionData[0] : t),
          };
        }
        return creditor;
      })
    );

    setHistoryCreditor((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        current_balance: newCreditorBalance,
        creditor_transactions: prev.creditor_transactions.map(t => t.id === editingTransaction.id ? updatedTransactionData[0] : t),
      };
    });

    setNewTransaction({ type: "payment", amount: "", description: "" });
    setEditingTransaction(null);
    setSelectedCreditorId(null);
    setIsEditTransactionDialogOpen(false);
    showSuccess("Transacción actualizada exitosamente.");
  };

  const handleDeleteCreditorTransaction = async (transactionId: string, creditorId: string, transactionAmount: number, transactionType: "charge" | "payment") => {
    if (!user) {
      showError("Debes iniciar sesión para eliminar transacciones.");
      return;
    }

    const currentCreditor = creditors.find(c => c.id === creditorId);
    if (!currentCreditor) {
      showError("Acreedor no encontrado.");
      return;
    }

    let newCreditorBalance = currentCreditor.current_balance;
    // Revertir el impacto de la transacción eliminada en el saldo
    newCreditorBalance = transactionType === "charge" ? newCreditorBalance - transactionAmount : newCreditorBalance + transactionAmount;

    const { error: transactionError } = await supabase
      .from('creditor_transactions')
      .delete()
      .eq('id', transactionId)
      .eq('user_id', user.id);

    if (transactionError) {
      showError('Error al eliminar transacción: ' + transactionError.message);
      return;
    }

    const { error: creditorError } = await supabase
      .from('creditors')
      .update({ current_balance: newCreditorBalance })
      .eq('id', creditorId)
      .eq('user_id', user.id);

    if (creditorError) {
      showError('Error al actualizar saldo del acreedor después de eliminar transacción: ' + creditorError.message);
      return;
    }

    setCreditors((prevCreditors) =>
      prevCreditors.map((creditor) => {
        if (creditor.id === creditorId) {
          return {
            ...creditor,
            current_balance: newCreditorBalance,
            creditor_transactions: creditor.creditor_transactions.filter(t => t.id !== transactionId),
          };
        }
        return creditor;
      })
    );

    setHistoryCreditor((prev) => {
      if (!prev || prev.id !== creditorId) return prev;
      return {
        ...prev,
        current_balance: newCreditorBalance,
        creditor_transactions: prev.creditor_transactions.filter(t => t.id !== transactionId),
      };
    });

    showSuccess("Transacción eliminada exitosamente.");
  };

  const filteredCreditors = creditors.filter((creditor) =>
    creditor.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = (formatType: 'csv' | 'pdf') => {
    const dataToExport = filteredCreditors.map(creditor => ({
      Nombre: creditor.name,
      "Saldo Inicial": creditor.initial_balance.toFixed(2),
      "Saldo Actual": creditor.current_balance.toFixed(2),
    }));

    const filename = `acreedores_${format(new Date(), "yyyyMMdd_HHmmss")}`;
    const title = "Reporte de Acreedores";
    const headers = ["Nombre", "Saldo Inicial", "Saldo Actual"];
    const pdfData = dataToExport.map(row => Object.values(row));

    if (formatType === 'csv') {
      exportToCsv(`${filename}.csv`, dataToExport);
      showSuccess("Acreedores exportados a CSV.");
    } else {
      exportToPdf(`${filename}.pdf`, title, headers, pdfData);
      showSuccess("Acreedores exportados a PDF.");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">A quien le debes</h1>

      <Card>
        <CardHeader>
          <CardTitle>Saldo Total a Acreedores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">${totalCreditorsBalance.toFixed(2)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lista de Acreedores</CardTitle>
          <div className="flex gap-2">
            <Dialog open={isAddCreditorDialogOpen} onOpenChange={setIsAddCreditorDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Añadir Acreedor
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Añadir Nuevo Acreedor</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmitNewCreditor} className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Nombre
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={newCreditor.name}
                      onChange={handleNewCreditorChange}
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
                      value={newCreditor.initial_balance}
                      onChange={handleNewCreditorChange}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Guardar Acreedor</Button>
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
              placeholder="Buscar acreedor por nombre..."
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
                {filteredCreditors.map((creditor) => (
                  <TableRow key={creditor.id}>
                    <TableCell>{creditor.name}</TableCell>
                    <TableCell>${creditor.initial_balance.toFixed(2)}</TableCell>
                    <TableCell>${creditor.current_balance.toFixed(2)}</TableCell>
                    <TableCell className="text-right flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAddTransactionDialog(creditor.id)} // Renombrado
                        className="h-8 gap-1"
                      >
                        <DollarSign className="h-3.5 w-3.5" />
                        Transacción
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenHistoryDialog(creditor)}
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
                              Esta acción no se puede deshacer. Esto eliminará permanentemente al acreedor 
                              **{creditor.name}** y todas sus transacciones asociadas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteCreditor(creditor.id)}>
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
                <DialogTitle>Registrar Transacción para {creditors.find(c => c.id === selectedCreditorId)?.name}</DialogTitle>
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
                      <SelectItem value="payment">Pago</SelectItem>
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
                <DialogTitle>Historial de Transacciones para {historyCreditor?.name}</DialogTitle>
              </DialogHeader>
              <div className="py-4 overflow-x-auto">
                {historyCreditor?.creditor_transactions && historyCreditor.creditor_transactions.length > 0 ? (
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
                      {historyCreditor.creditor_transactions.map((transaction, index) => (
                        <TableRow key={transaction.id || index}>
                          <TableCell>{format(new Date(transaction.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                          <TableCell className={transaction.type === "charge" ? "text-red-600" : "text-green-600"}>
                            {transaction.type === "charge" ? "Cargo" : "Pago"}
                          </TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell className="text-right">
                            {transaction.type === "charge" ? "+" : "-"}${transaction.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditTransactionDialog(transaction, historyCreditor.id)}
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
                                    Esta acción no se puede deshacer. Esto eliminará permanentemente la transacción de {transaction.type === "charge" ? "cargo" : "pago"} por ${transaction.amount.toFixed(2)}: "{transaction.description}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteCreditorTransaction(transaction.id, historyCreditor.id, transaction.amount, transaction.type)}>
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
                  <p className="text-center text-muted-foreground">No hay historial de transacciones para este acreedor.</p>
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
                      <SelectItem value="payment">Pago</SelectItem>
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

export default Creditors;