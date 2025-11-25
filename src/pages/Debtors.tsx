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
  debtor_id?: string;
  user_id?: string;
}

interface Debtor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  payments: Payment[];
  user_id?: string;
}

const Debtors = () => {
  const { user } = useSession();
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [isAddDebtorDialogOpen, setIsAddDebtorDialogOpen] = useState(false);
  const [isAddPaymentDialogOpen, setIsAddPaymentDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isEditPaymentDialogOpen, setIsEditPaymentDialogOpen] = useState(false);
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
  const [historyDebtor, setHistoryDebtor] = useState<Debtor | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [newDebtor, setNewDebtor] = useState({ name: "", initial_balance: "" });
  const [paymentAmount, setPaymentAmount] = useState("");

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");

  const fetchDebtors = async () => {
    if (!user) {
      setDebtors([]);
      return;
    }

    const { data, error } = await supabase
      .from('debtors')
      .select('*, debtor_payments(*)')
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
      setDebtors((prev) => [...prev, { ...data[0], payments: [] }]);
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

  const handleOpenAddPaymentDialog = (debtorId: string) => {
    setSelectedDebtorId(debtorId);
    setIsAddPaymentDialogOpen(true);
  };

  const handleOpenHistoryDialog = (debtor: Debtor) => {
    setHistoryDebtor(debtor);
    setIsHistoryDialogOpen(true);
  };

  const handlePaymentAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPaymentAmount(e.target.value);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDebtorId) {
      showError("Debes iniciar sesión para registrar abonos.");
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      showError("El monto del abono debe ser un número positivo.");
      return;
    }

    const currentDebtor = debtors.find(d => d.id === selectedDebtorId);
    if (!currentDebtor) {
      showError("Deudor no encontrado.");
      return;
    }

    const newBalance = currentDebtor.current_balance - amount;
    if (newBalance < 0) {
      showError("El abono excede el saldo pendiente.");
      return;
    }

    const { data: paymentData, error: paymentError } = await supabase
      .from('debtor_payments')
      .insert({
        user_id: user.id,
        debtor_id: selectedDebtorId,
        amount,
        date: new Date().toISOString().split('T')[0],
      })
      .select();

    if (paymentError) {
      showError('Error al registrar abono: ' + paymentError.message);
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
            payments: [...debtor.payments, paymentData[0]],
          };
        }
        return debtor;
      })
    );
    setPaymentAmount("");
    setSelectedDebtorId(null);
    setIsAddPaymentDialogOpen(false);
    showSuccess("Abono registrado exitosamente.");
  };

  const handleOpenEditPaymentDialog = (payment: Payment) => {
    setEditingPayment(payment);
    setPaymentAmount(payment.amount.toString());
    setIsEditPaymentDialogOpen(true);
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingPayment || !historyDebtor) {
      showError("Debes iniciar sesión para actualizar pagos.");
      return;
    }

    const oldAmount = editingPayment.amount;
    const newAmount = parseFloat(paymentAmount);

    if (isNaN(newAmount) || newAmount <= 0) {
      showError("El monto del abono debe ser un número positivo.");
      return;
    }

    const currentDebtor = debtors.find(d => d.id === historyDebtor.id);
    if (!currentDebtor) {
      showError("Deudor no encontrado.");
      return;
    }

    let newDebtorBalance = currentDebtor.current_balance + oldAmount - newAmount;
    if (newDebtorBalance < 0) {
      showError("El abono excede el saldo pendiente.");
      return;
    }

    const { data: updatedPaymentData, error: paymentError } = await supabase
      .from('debtor_payments')
      .update({ amount: newAmount })
      .eq('id', editingPayment.id)
      .eq('user_id', user.id)
      .select();

    if (paymentError) {
      showError('Error al actualizar abono: ' + paymentError.message);
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
            payments: debtor.payments.map(p => p.id === editingPayment.id ? updatedPaymentData[0] : p),
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
        payments: prev.payments.map(p => p.id === editingPayment.id ? updatedPaymentData[0] : p),
      };
    });

    setPaymentAmount("");
    setEditingPayment(null);
    setIsEditPaymentDialogOpen(false);
    showSuccess("Abono actualizado exitosamente.");
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
      <h1 className="text-3xl font-bold">Gestión de Deudores</h1>

      <Card>
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
                        onClick={() => handleOpenAddPaymentDialog(debtor.id)}
                        className="h-8 gap-1"
                      >
                        <DollarSign className="h-3.5 w-3.5" />
                        Abonar
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
                              **{debtor.name}** y todos sus abonos asociados.
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
          <Dialog open={isAddPaymentDialogOpen} onOpenChange={setIsAddPaymentDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Registrar Abono para {debtors.find(d => d.id === selectedDebtorId)?.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitPayment} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="paymentAmount" className="text-right">
                    Monto del Abono
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
                  <Button type="submit">Registrar Abono</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Historial de Abonos para {historyDebtor?.name}</DialogTitle>
              </DialogHeader>
              <div className="py-4 overflow-x-auto">
                {historyDebtor?.payments && historyDebtor.payments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyDebtor.payments.map((payment, index) => (
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
                  <p className="text-center text-muted-foreground">No hay historial de abonos para este deudor.</p>
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
                <DialogTitle>Editar Abono</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdatePayment} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editPaymentAmount" className="text-right">
                    Monto del Abono
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
                  <Button type="submit">Actualizar Abono</Button>
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