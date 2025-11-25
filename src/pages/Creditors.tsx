"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, DollarSign, History, Trash2, Edit, FileText, FileDown } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Payment {
  id: string;
  amount: number;
  date: string;
  creditor_id?: string;
  user_id?: string;
}

interface Creditor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  payments: Payment[];
  user_id?: string;
}

const Creditors = () => {
  const { user } = useSession();
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [isAddCreditorDialogOpen, setIsAddCreditorDialogOpen] = useState(false);
  const [isAddPaymentDialogOpen, setIsAddPaymentDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isEditPaymentDialogOpen, setIsEditPaymentDialogOpen] = useState(false);
  const [selectedCreditorId, setSelectedCreditorId] = useState<string | null>(null);
  const [historyCreditor, setHistoryCreditor] = useState<Creditor | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [newCreditor, setNewCreditor] = useState({ name: "", initial_balance: "" });
  const [paymentAmount, setPaymentAmount] = useState("");

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");

  const fetchCreditors = async () => {
    if (!user) {
      setCreditors([]);
      return;
    }

    const { data, error } = await supabase
      .from('creditors')
      .select('*, creditor_payments(*)')
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
      setCreditors((prev) => [...prev, { ...data[0], payments: [] }]);
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

  const handleOpenAddPaymentDialog = (creditorId: string) => {
    setSelectedCreditorId(creditorId);
    setIsAddPaymentDialogOpen(true);
  };

  const handleOpenHistoryDialog = (creditor: Creditor) => {
    setHistoryCreditor(creditor);
    setIsHistoryDialogOpen(true);
  };

  const handlePaymentAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPaymentAmount(e.target.value);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCreditorId) {
      showError("Debes iniciar sesión para registrar pagos.");
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      showError("El monto del pago debe ser un número positivo.");
      return;
    }

    const currentCreditor = creditors.find(d => d.id === selectedCreditorId);
    if (!currentCreditor) {
      showError("Acreedor no encontrado.");
      return;
    }

    const newBalance = currentCreditor.current_balance - amount;
    if (newBalance < 0) {
      showError("El pago excede el saldo pendiente.");
      return;
    }

    const { data: paymentData, error: paymentError } = await supabase
      .from('creditor_payments')
      .insert({
        user_id: user.id,
        creditor_id: selectedCreditorId,
        amount,
        date: new Date().toISOString().split('T')[0],
      })
      .select();

    if (paymentError) {
      showError('Error al registrar pago: ' + paymentError.message);
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
            payments: [...creditor.payments, paymentData[0]],
          };
        }
        return creditor;
      })
    );
    setPaymentAmount("");
    setSelectedCreditorId(null);
    setIsAddPaymentDialogOpen(false);
    showSuccess("Pago registrado exitosamente.");
  };

  const handleOpenEditPaymentDialog = (payment: Payment) => {
    setEditingPayment(payment);
    setPaymentAmount(payment.amount.toString());
    setIsEditPaymentDialogOpen(true);
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingPayment || !historyCreditor) {
      showError("Debes iniciar sesión para actualizar pagos.");
      return;
    }

    const oldAmount = editingPayment.amount;
    const newAmount = parseFloat(paymentAmount);

    if (isNaN(newAmount) || newAmount <= 0) {
      showError("El monto del pago debe ser un número positivo.");
      return;
    }

    const currentCreditor = creditors.find(d => d.id === historyCreditor.id);
    if (!currentCreditor) {
      showError("Acreedor no encontrado.");
      return;
    }

    let newCreditorBalance = currentCreditor.current_balance + oldAmount - newAmount;
    if (newCreditorBalance < 0) {
      showError("El pago excede el saldo pendiente.");
      return;
    }

    const { data: updatedPaymentData, error: paymentError } = await supabase
      .from('creditor_payments')
      .update({ amount: newAmount })
      .eq('id', editingPayment.id)
      .eq('user_id', user.id)
      .select();

    if (paymentError) {
      showError('Error al actualizar pago: ' + paymentError.message);
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
            payments: creditor.payments.map(p => p.id === editingPayment.id ? updatedPaymentData[0] : p),
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
        payments: prev.payments.map(p => p.id === editingPayment.id ? updatedPaymentData[0] : p),
      };
    });

    setPaymentAmount("");
    setEditingPayment(null);
    setIsEditPaymentDialogOpen(false);
    showSuccess("Pago actualizado exitosamente.");
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
      <h1 className="text-3xl font-bold">Gestión de Acreedores</h1>

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
                        onClick={() => handleOpenAddPaymentDialog(creditor.id)}
                        className="h-8 gap-1"
                      >
                        <DollarSign className="h-3.5 w-3.5" />
                        Pagar
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
                              **{creditor.name}** y todos sus pagos asociados.
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
          <Dialog open={isAddPaymentDialogOpen} onOpenChange={setIsAddPaymentDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Registrar Pago para {creditors.find(c => c.id === selectedCreditorId)?.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitPayment} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="paymentAmount" className="text-right">
                    Monto del Pago
                  </Label>
                  <Input
                    id="paymentAmount"
                    name="paymentAmount"
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={handlePaymentAmountChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Registrar Pago</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Historial de Pagos para {historyCreditor?.name}</DialogTitle>
              </DialogHeader>
              <div className="py-4 overflow-x-auto">
                {historyCreditor?.payments && historyCreditor.payments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyCreditor.payments.map((payment, index) => (
                        <TableRow key={payment.id || index}>
                          <TableCell>{payment.date}</TableCell>
                          <TableCell className="text-right">${payment.amount.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditPaymentDialog(payment)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span className="sr-only">Editar</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground">No hay historial de pagos para este acreedor.</p>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setIsHistoryDialogOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditPaymentDialogOpen} onOpenChange={setIsEditPaymentDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Editar Pago</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdatePayment} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editPaymentAmount" className="text-right">
                    Monto del Pago
                  </Label>
                  <Input
                    id="editPaymentAmount"
                    name="amount"
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={handlePaymentAmountChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Actualizar Pago</Button>
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