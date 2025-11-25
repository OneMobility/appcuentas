"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DollarSign, History, Trash2, Edit, CalendarIcon, ArrowLeft, FileText, FileDown } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import ColorPicker from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getUpcomingPaymentDueDate } from "@/utils/date-helpers";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import LoadingSpinner from "@/components/LoadingSpinner";

interface CardTransaction {
  id: string;
  type: "charge" | "payment";
  amount: number;
  description: string;
  date: string;
  card_id?: string;
  user_id?: string;
  installments_total_amount?: number;
  installments_count?: number;
  installment_number?: number;
}

interface CardData {
  id: string;
  name: string;
  bank_name: string;
  last_four_digits: string;
  expiration_date: string;
  type: "credit" | "debit";
  initial_balance: number;
  current_balance: number;
  credit_limit?: number;
  cut_off_day?: number;
  days_to_pay_after_cut_off?: number;
  color: string;
  transactions: CardTransaction[];
  user_id?: string;
}

const CardDetailsPage: React.FC = () => {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const [card, setCard] = useState<CardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [isEditTransactionDialogOpen, setIsEditTransactionDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<CardTransaction | null>(null);
  const [newTransaction, setNewTransaction] = useState({
    type: "charge" as "charge" | "payment",
    amount: "",
    description: "",
    date: undefined as Date | undefined,
    installments_count: undefined as number | undefined,
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "charge" | "payment">("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    const fetchCardDetails = async () => {
      if (!user || !cardId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from('cards')
        .select('*, card_transactions(*)')
        .eq('id', cardId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        showError('Error al cargar detalles de la tarjeta: ' + error.message);
        navigate('/cards'); // Redirigir si la tarjeta no se encuentra o hay un error
      } else {
        setCard(data as CardData);
      }
      setIsLoading(false);
    };

    fetchCardDetails();
  }, [cardId, user, navigate]);

  const handleTransactionInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewTransaction((prev) => ({ ...prev, [name]: value }));
  };

  const handleTransactionTypeChange = (value: "charge" | "payment") => {
    setNewTransaction((prev) => ({ ...prev, type: value, installments_count: undefined }));
  };

  const handleTransactionDateChange = (date: Date | undefined) => {
    setNewTransaction((prev) => ({ ...prev, date: date }));
  };

  const handleInstallmentsChange = (value: string) => {
    setNewTransaction((prev) => ({ ...prev, installments_count: parseInt(value) || undefined }));
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !card) {
      showError("Debes iniciar sesión o la tarjeta no está cargada.");
      return;
    }

    const amount = parseFloat(newTransaction.amount);
    if (isNaN(amount) || amount <= 0) {
      showError("El monto de la transacción debe ser un número positivo.");
      return;
    }
    if (!newTransaction.date) {
      showError("Por favor, selecciona una fecha para la transacción.");
      return;
    }

    let newBalance = card.current_balance;
    let transactionAmountToStore = amount;
    let installmentsTotalAmount: number | undefined = undefined;
    let installmentsCount: number | undefined = undefined;

    if (newTransaction.type === "charge" && newTransaction.installments_count && newTransaction.installments_count > 1) {
      installmentsTotalAmount = amount;
      installmentsCount = newTransaction.installments_count;
      transactionAmountToStore = amount / installmentsCount; // Monto mensual
    }

    if (card.type === "debit") {
      if (newTransaction.type === "charge") {
        if (newBalance < transactionAmountToStore) {
          showError("Saldo insuficiente en la tarjeta de débito.");
          return;
        }
        newBalance -= transactionAmountToStore;
      } else {
        newBalance += transactionAmountToStore;
      }
    } else { // Credit card
      if (newTransaction.type === "charge") {
        if (card.credit_limit !== undefined && newBalance + transactionAmountToStore > card.credit_limit) {
          showError("El cargo excede el límite de crédito disponible.");
          return;
        }
        newBalance += transactionAmountToStore;
      } else { // Payment
        if (newBalance < transactionAmountToStore) {
          showError("El pago excede la deuda pendiente.");
          return;
        }
        newBalance -= transactionAmountToStore;
      }
    }

    const { data: transactionData, error: transactionError } = await supabase
      .from('card_transactions')
      .insert({
        user_id: user.id,
        card_id: card.id,
        type: newTransaction.type,
        amount: transactionAmountToStore,
        description: newTransaction.description,
        date: format(newTransaction.date, "yyyy-MM-dd"),
        installments_total_amount: installmentsTotalAmount,
        installments_count: installmentsCount,
        installment_number: installmentsCount ? 1 : undefined, // Siempre la primera cuota al registrar
      })
      .select();

    if (transactionError) {
      showError('Error al registrar transacción: ' + transactionError.message);
      return;
    }

    const { data: cardData, error: cardError } = await supabase
      .from('cards')
      .update({ current_balance: newBalance })
      .eq('id', card.id)
      .eq('user_id', user.id)
      .select();

    if (cardError) {
      showError('Error al actualizar saldo de la tarjeta: ' + cardError.message);
      return;
    }

    setCard((prevCard) => {
      if (!prevCard) return null;
      return {
        ...prevCard,
        current_balance: newBalance,
        transactions: [...prevCard.transactions, transactionData[0]],
      };
    });
    setNewTransaction({ type: "charge", amount: "", description: "", date: undefined, installments_count: undefined });
    setIsAddTransactionDialogOpen(false);
    showSuccess("Transacción registrada exitosamente.");
  };

  const handleOpenEditTransactionDialog = (transaction: CardTransaction) => {
    setEditingTransaction(transaction);
    setNewTransaction({
      type: transaction.type,
      amount: (transaction.installments_total_amount || transaction.amount).toString(),
      description: transaction.description,
      date: new Date(transaction.date),
      installments_count: transaction.installments_count,
    });
    setIsEditTransactionDialogOpen(true);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingTransaction || !card) {
      showError("No se ha seleccionado una transacción o tarjeta para actualizar.");
      return;
    }

    const oldAmount = editingTransaction.amount;
    const oldType = editingTransaction.type;
    const oldInstallmentsTotalAmount = editingTransaction.installments_total_amount;
    const oldInstallmentsCount = editingTransaction.installments_count;

    const newAmountTotal = parseFloat(newTransaction.amount);
    const newType = newTransaction.type;
    const newInstallmentsCount = newTransaction.installments_count;

    if (isNaN(newAmountTotal) || newAmountTotal <= 0) {
      showError("El monto de la transacción debe ser un número positivo.");
      return;
    }
    if (!newTransaction.date) {
      showError("Por favor, selecciona una fecha para la transacción.");
      return;
    }

    let newAmountPerInstallment = newAmountTotal;
    let newInstallmentsTotalAmount: number | undefined = undefined;
    let newInstallmentNumber: number | undefined = undefined;

    if (newType === "charge" && newInstallmentsCount && newInstallmentsCount > 1) {
      newInstallmentsTotalAmount = newAmountTotal;
      newAmountPerInstallment = newAmountTotal / newInstallmentsCount;
      newInstallmentNumber = editingTransaction.installment_number || 1;
    }

    let newCardBalance = card.current_balance;

    // Revertir el impacto de la transacción antigua en el saldo
    const oldEffectiveAmount = oldInstallmentsTotalAmount ? oldInstallmentsTotalAmount / (oldInstallmentsCount || 1) : oldAmount;
    newCardBalance = oldType === "charge" ? newCardBalance - oldEffectiveAmount : newCardBalance + oldEffectiveAmount;

    // Aplicar el impacto de la nueva transacción en el saldo
    const newEffectiveAmount = newInstallmentsTotalAmount ? newInstallmentsTotalAmount / (newInstallmentsCount || 1) : newAmountTotal;

    if (card.type === "debit") {
      if (newType === "charge") {
        if (newCardBalance < newEffectiveAmount) {
          showError("Saldo insuficiente en la tarjeta de débito.");
          return;
        }
        newCardBalance -= newEffectiveAmount;
      } else {
        newCardBalance += newEffectiveAmount;
      }
    } else { // Credit card
      if (newType === "charge") {
        if (card.credit_limit !== undefined && newCardBalance + newEffectiveAmount > card.credit_limit) {
          showError("El cargo excede el límite de crédito disponible.");
          return;
        }
        newCardBalance += newEffectiveAmount;
      } else { // Payment
        if (newCardBalance < newEffectiveAmount) {
          showError("El pago excede la deuda pendiente.");
          return;
        }
        newCardBalance -= newEffectiveAmount;
      }
    }

    const { data: updatedTransactionData, error: transactionError } = await supabase
      .from('card_transactions')
      .update({
        type: newType,
        amount: newAmountPerInstallment,
        description: newTransaction.description,
        date: format(newTransaction.date, "yyyy-MM-dd"),
        installments_total_amount: newInstallmentsTotalAmount,
        installments_count: newInstallmentsCount,
        installment_number: newInstallmentNumber,
      })
      .eq('id', editingTransaction.id)
      .eq('user_id', user.id)
      .select();

    if (transactionError) {
      showError('Error al actualizar transacción: ' + transactionError.message);
      return;
    }

    const { data: cardData, error: cardError } = await supabase
      .from('cards')
      .update({ current_balance: newCardBalance })
      .eq('id', card.id)
      .eq('user_id', user.id)
      .select();

    if (cardError) {
      showError('Error al actualizar saldo de la tarjeta: ' + cardError.message);
      return;
    }

    setCard((prevCard) => {
      if (!prevCard) return null;
      return {
        ...prevCard,
        current_balance: newCardBalance,
        transactions: prevCard.transactions.map(t => t.id === editingTransaction.id ? updatedTransactionData[0] : t),
      };
    });

    setNewTransaction({ type: "charge", amount: "", description: "", date: undefined, installments_count: undefined });
    setEditingTransaction(null);
    setIsEditTransactionDialogOpen(false);
    showSuccess("Transacción actualizada exitosamente.");
  };

  const filteredTransactions = useMemo(() => {
    if (!card) return [];
    // Asegurarse de que card.transactions sea un array antes de llamar a filter
    return (card.transactions || []).filter((tx) => {
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      
      const txDate = new Date(tx.date);
      const matchesDate = !dateRange?.from || (txDate >= dateRange.from && (!dateRange.to || txDate <= dateRange.to));

      return matchesSearch && matchesType && matchesDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Ordenar por fecha descendente
  }, [card, searchTerm, filterType, dateRange]);

  const handleExportCardTransactions = (formatType: 'csv' | 'pdf') => {
    if (!card) {
      showError("No hay tarjeta seleccionada para exportar.");
      return;
    }

    const dataToExport = filteredTransactions.map(tx => ({
      Fecha: format(new Date(tx.date), "dd/MM/yyyy", { locale: es }),
      Tipo: tx.type === "charge" ? "Cargo" : "Pago",
      Descripcion: tx.description,
      Monto: `${tx.type === "charge" ? "-" : "+"}${tx.amount.toFixed(2)}`,
      Cuotas: tx.installments_count && tx.installment_number && tx.installments_count > 1
        ? `${tx.installment_number}/${tx.installments_count}`
        : "Pago único",
    }));

    const filename = `estado_cuenta_${card.name.replace(/\s/g, '_')}_${format(new Date(), "yyyyMMdd_HHmmss")}`;
    const title = `Estado de Cuenta: ${card.name} (${card.bank_name})`;
    const headers = ["Fecha", "Tipo", "Descripción", "Monto", "Cuotas"];
    const pdfData = dataToExport.map(row => Object.values(row));

    if (formatType === 'csv') {
      exportToCsv(`${filename}.csv`, dataToExport);
      showSuccess("Estado de cuenta exportado a CSV.");
    } else {
      exportToPdf(`${filename}.pdf`, title, headers, pdfData);
      showSuccess("Estado de cuenta exportado a PDF.");
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
        <h2 className="text-2xl font-bold mb-4">Tarjeta no encontrada</h2>
        <Button onClick={() => navigate('/cards')}>Volver a Mis Tarjetas</Button>
      </div>
    );
  }

  const isCredit = card.type === "credit";
  const creditAvailable = isCredit && card.credit_limit !== undefined ? card.credit_limit - card.current_balance : 0;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cards')}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-3xl font-bold">Detalles de la Tarjeta: {card.name}</h1>
      </div>

      <Card className="p-6" style={{ backgroundColor: card.color, color: 'white' }}>
        <CardHeader className="p-0 mb-4 relative z-10">
          <CardTitle className="text-xl font-bold flex items-center justify-between">
            <span>{card.bank_name}</span>
            <span className="text-sm font-normal opacity-80">{isCredit ? "CRÉDITO" : "DÉBITO"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 relative z-10">
          <div className="mb-4">
            {isCredit ? (
              <>
                <p className="text-sm opacity-80">Crédito Disponible</p>
                <p className="text-3xl font-extrabold">
                  ${creditAvailable.toFixed(2)}
                </p>
                <p className="text-sm opacity-80 mt-1">
                  Deuda Pendiente: ${card.current_balance.toFixed(2)}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm opacity-80">Saldo Disponible</p>
                <p className="text-3xl font-extrabold">
                  ${card.current_balance.toFixed(2)}
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm mb-4">
            <div>
              <p className="opacity-80">Número</p>
              <p className="font-semibold">**** {card.last_four_digits}</p>
            </div>
            <div className="text-right">
              <p className="opacity-80">Expira</p>
              <p className="font-semibold">{card.expiration_date}</p>
            </div>
          </div>

          {isCredit && (
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <div>
                <p className="opacity-80">Límite de Crédito</p>
                <p className="font-semibold">${card.credit_limit?.toFixed(2) || "N/A"}</p>
              </div>
              <div>
                <p className="opacity-80">Día de Corte</p>
                <p className="font-semibold">{card.cut_off_day ? `Día ${card.cut_off_day}` : "N/A"}</p>
              </div>
              <div>
                <p className="opacity-80">Días para pagar después del corte</p>
                <p className="font-semibold">{card.days_to_pay_after_cut_off !== undefined ? `${card.days_to_pay_after_cut_off} días` : "N/A"}</p>
              </div>
              {card.cut_off_day !== undefined && card.days_to_pay_after_cut_off !== undefined && (
                <div>
                  <p className="opacity-80">Fecha Límite de Pago (Estimada)</p>
                  <p className="font-semibold">
                    {format(getUpcomingPaymentDueDate(card.cut_off_day, card.days_to_pay_after_cut_off), "dd 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Historial de Transacciones</CardTitle>
          <div className="flex gap-2">
            <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Nueva Transacción
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Registrar Transacción para {card.name}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmitTransaction} className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="transactionType" className="text-right">
                      Tipo
                    </Label>
                    <Select value={newTransaction.type} onValueChange={handleTransactionTypeChange}>
                      <SelectTrigger className="col-span-3">
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
                  {newTransaction.type === "charge" && card.type === "credit" && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="installments_count" className="text-right">
                        Meses
                      </Label>
                      <Select
                        value={newTransaction.installments_count?.toString() || ""}
                        onValueChange={handleInstallmentsChange}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Pago único" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Pago único</SelectItem>
                          <SelectItem value="3">3 meses</SelectItem>
                          <SelectItem value="6">6 meses</SelectItem>
                          <SelectItem value="9">9 meses</SelectItem>
                          <SelectItem value="12">12 meses</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="transactionDate" className="text-right">
                      Fecha
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "col-span-3 justify-start text-left font-normal",
                            !newTransaction.date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newTransaction.date ? format(newTransaction.date, "dd/MM/yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newTransaction.date}
                          onSelect={handleTransactionDateChange}
                          initialFocus
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Registrar Transacción</Button>
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
                <DropdownMenuItem onClick={() => handleExportCardTransactions('csv')}>
                  <FileText className="mr-2 h-4 w-4" /> Exportar a CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCardTransactions('pdf')}>
                  <FileText className="mr-2 h-4 w-4" /> Exportar a PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <Input
              placeholder="Buscar por descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={filterType} onValueChange={(value: "all" | "charge" | "payment") => setFilterType(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="charge">Cargo</SelectItem>
                <SelectItem value="payment">Pago</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[300px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yyyy", { locale: es })} -{" "}
                        {format(dateRange.to, "dd/MM/yyyy", { locale: es })}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy", { locale: es })
                    )
                  ) : (
                    <span>Filtrar por fecha</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="overflow-x-auto">
            {filteredTransactions.length > 0 ? (
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
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{format(new Date(transaction.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                      <TableCell className={transaction.type === "charge" ? "text-red-600" : "text-green-600"}>
                        {transaction.type === "charge" ? "Cargo" : "Pago"}
                        {transaction.installments_count && transaction.installment_number && transaction.installments_count > 1 &&
                          ` (${transaction.installment_number}/${transaction.installments_count})`}
                      </TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell className="text-right">${transaction.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditTransactionDialog(transaction)}
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
              <p className="text-center text-muted-foreground">No hay transacciones para esta tarjeta con los filtros aplicados.</p>
            )}
          </div>
          <Dialog open={isEditTransactionDialogOpen} onOpenChange={setIsEditTransactionDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Editar Transacción para {card.name}</DialogTitle>
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
                {newTransaction.type === "charge" && card.type === "credit" && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="editInstallmentsCount" className="text-right">
                      Meses
                    </Label>
                    <Select
                      value={newTransaction.installments_count?.toString() || ""}
                      onValueChange={handleInstallmentsChange}
                    >
                      <SelectTrigger id="editInstallmentsCount" className="col-span-3">
                        <SelectValue placeholder="Pago único" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Pago único</SelectItem>
                        <SelectItem value="3">3 meses</SelectItem>
                        <SelectItem value="6">6 meses</SelectItem>
                        <SelectItem value="9">9 meses</SelectItem>
                        <SelectItem value="12">12 meses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editTransactionDate" className="text-right">
                    Fecha
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "col-span-3 justify-start text-left font-normal",
                          !newTransaction.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newTransaction.date ? format(newTransaction.date, "dd/MM/yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newTransaction.date}
                        onSelect={handleTransactionDateChange}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
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

export default CardDetailsPage;