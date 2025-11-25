"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PlusCircle, DollarSign, History, CalendarIcon, Trash2, Edit } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import CardDisplay from "@/components/CardDisplay";
import ColorPicker from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface CardTransaction {
  id: string;
  type: "charge" | "payment";
  amount: number; // Monto mensual si es a meses, o monto total si es pago único
  description: string;
  date: string;
  card_id?: string;
  user_id?: string;
  installments_total_amount?: number; // Monto total del cargo original si es a meses
  installments_count?: number; // Número total de meses si es a meses
  installment_number?: number; // Número de cuota actual (1, 2, 3...)
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
  payment_due_day?: number;
  color: string;
  transactions: CardTransaction[];
  user_id?: string;
}

const Cards = () => {
  const { user } = useSession();
  const [cards, setCards] = useState<CardData[]>([]);
  const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);
  const [isEditCardDialogOpen, setIsEditCardDialogOpen] = useState(false);
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditTransactionDialogOpen, setIsEditTransactionDialogOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [detailedCard, setDetailedCard] = useState<CardData | null>(null);
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<CardTransaction | null>(null);
  const [newCard, setNewCard] = useState({
    name: "",
    bank_name: "",
    last_four_digits: "",
    expiration_date: "",
    type: "debit" as "credit" | "debit",
    initial_balance: "",
    credit_limit: "",
    cut_off_day: undefined as number | undefined,
    payment_due_day: undefined as number | undefined,
    color: "#3B82F6",
  });
  const [newTransaction, setNewTransaction] = useState({
    type: "charge" as "charge" | "payment",
    amount: "",
    description: "",
    date: undefined as Date | undefined,
    installments_count: undefined as number | undefined, // Nuevo campo para meses
  });

  const [searchTerm, setSearchTerm] = useState("");

  const fetchCards = async () => {
    if (!user) {
      setCards([]);
      return;
    }

    const { data, error } = await supabase
      .from('cards')
      .select('*, card_transactions(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      showError('Error al cargar tarjetas: ' + error.message);
    } else {
      setCards(data || []);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCards();
    }
  }, [user]);

  const totalCardsBalance = cards.reduce((sum, card) => {
    return sum + (card.type === "credit" ? -card.current_balance : card.current_balance);
  }, 0);

  const handleNewCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewCard((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewCardTypeChange = (value: "credit" | "debit") => {
    setNewCard((prev) => ({ ...prev, type: value, credit_limit: "", cut_off_day: undefined, payment_due_day: undefined }));
  };

  const handleNewCardDayChange = (field: "cut_off_day" | "payment_due_day", date: Date | undefined) => {
    setNewCard((prev) => ({ ...prev, [field]: date ? date.getDate() : undefined }));
  };

  const handleNewCardColorSelect = (color: string) => {
    setNewCard((prev) => ({ ...prev, color }));
  };

  const handleSubmitNewCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("Debes iniciar sesión para añadir tarjetas.");
      return;
    }

    const initialBalance = parseFloat(newCard.initial_balance);
    if (isNaN(initialBalance) || initialBalance < 0) {
      showError("El saldo inicial debe ser un número positivo o cero.");
      return;
    }
    if (!newCard.bank_name.trim()) {
      showError("El nombre del banco no puede estar vacío.");
      return;
    }
    if (!/^\d{4}$/.test(newCard.last_four_digits)) {
      showError("Los últimos 4 dígitos deben ser exactamente 4 números.");
      return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(newCard.expiration_date)) {
      showError("La fecha de expiración debe tener el formato MM/AA (ej. 12/25).");
      return;
    }

    let creditLimit: number | undefined = undefined;
    let cutOffDay: number | undefined = undefined;
    let paymentDueDay: number | undefined = undefined;

    if (newCard.type === "credit") {
      creditLimit = parseFloat(newCard.credit_limit);
      if (isNaN(creditLimit) || creditLimit <= 0) {
        showError("El límite de crédito debe ser un número positivo.");
        return;
      }
      if (newCard.cut_off_day === undefined) {
        showError("Por favor, selecciona el día de corte para la tarjeta de crédito.");
        return;
      }
      if (newCard.payment_due_day === undefined) {
        showError("Por favor, selecciona el día límite de pago para la tarjeta de crédito.");
        return;
      }
      cutOffDay = newCard.cut_off_day;
      paymentDueDay = newCard.payment_due_day;
    }

    const { data, error } = await supabase
      .from('cards')
      .insert({
        user_id: user.id,
        name: newCard.name.trim() || `${newCard.bank_name} ${newCard.type === "credit" ? "Crédito" : "Débito"}`,
        bank_name: newCard.bank_name.trim(),
        last_four_digits: newCard.last_four_digits,
        expiration_date: newCard.expiration_date,
        type: newCard.type,
        initial_balance: initialBalance,
        current_balance: initialBalance,
        credit_limit: newCard.type === "credit" ? creditLimit : undefined,
        cut_off_day: newCard.type === "credit" ? cutOffDay : undefined,
        payment_due_day: newCard.type === "credit" ? paymentDueDay : undefined,
        color: newCard.color,
      })
      .select();

    if (error) {
      showError('Error al registrar tarjeta: ' + error.message);
    } else {
      setCards((prev) => [...prev, { ...data[0], transactions: [] }]);
      setNewCard({ name: "", bank_name: "", last_four_digits: "", expiration_date: "", type: "debit", initial_balance: "", credit_limit: "", cut_off_day: undefined, payment_due_day: undefined, color: "#3B82F6" });
      setIsAddCardDialogOpen(false);
      showSuccess("Tarjeta registrada exitosamente.");
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!user) {
      showError("Debes iniciar sesión para eliminar tarjetas.");
      return;
    }

    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('id', cardId)
      .eq('user_id', user.id);

    if (error) {
      showError('Error al eliminar tarjeta: ' + error.message);
    } else {
      setCards((prev) => prev.filter((card) => card.id !== cardId));
      showSuccess("Tarjeta eliminada exitosamente.");
    }
  };

  const handleOpenAddTransactionDialog = (cardId: string) => {
    setSelectedCardId(cardId);
    setNewTransaction({ type: "charge", amount: "", description: "", date: undefined, installments_count: undefined });
    setIsAddTransactionDialogOpen(true);
  };

  const handleOpenDetailsDialog = (card: CardData) => {
    setDetailedCard(card);
    setIsDetailsDialogOpen(true);
  };

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
    if (!user) {
      showError("Debes iniciar sesión para registrar transacciones.");
      return;
    }
    if (!selectedCardId) { // Explicit check for selectedCardId
      showError("No se ha seleccionado una tarjeta para la transacción.");
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

    const currentCard = cards.find(c => c.id === selectedCardId);
    if (!currentCard) {
      showError("Tarjeta no encontrada o eliminada.");
      return;
    }

    let newBalance = currentCard.current_balance;
    let transactionAmountToStore = amount;
    let installmentsTotalAmount: number | undefined = undefined;
    let installmentsCount: number | undefined = undefined;

    if (newTransaction.type === "charge" && newTransaction.installments_count && newTransaction.installments_count > 1) {
      installmentsTotalAmount = amount;
      installmentsCount = newTransaction.installments_count;
      transactionAmountToStore = amount / installmentsCount; // Monto mensual
    }

    if (currentCard.type === "debit") {
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
        if (currentCard.credit_limit !== undefined && newBalance + transactionAmountToStore > currentCard.credit_limit) {
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
        card_id: selectedCardId,
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
      .eq('id', selectedCardId)
      .eq('user_id', user.id)
      .select();

    if (cardError) {
      showError('Error al actualizar saldo de la tarjeta: ' + cardError.message);
      return;
    }

    setCards((prevCards) =>
      prevCards.map((card) => {
        if (card.id === selectedCardId) {
          return {
            ...card,
            current_balance: newBalance,
            transactions: [...card.transactions, transactionData[0]],
          };
        }
        return card;
      })
    );
    setNewTransaction({ type: "charge", amount: "", description: "", date: undefined, installments_count: undefined });
    setSelectedCardId(null);
    setIsAddTransactionDialogOpen(false);
    showSuccess("Transacción registrada exitosamente.");
  };

  const handleOpenEditTransactionDialog = (transaction: CardTransaction, cardId: string) => {
    setEditingTransaction(transaction);
    setSelectedCardId(cardId);
    setNewTransaction({
      type: transaction.type,
      amount: (transaction.installments_total_amount || transaction.amount).toString(), // Mostrar monto total si es a meses
      description: transaction.description,
      date: new Date(transaction.date),
      installments_count: transaction.installments_count,
    });
    setIsEditTransactionDialogOpen(true);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("Debes iniciar sesión para actualizar transacciones.");
      return;
    }
    if (!editingTransaction || !selectedCardId) { // Explicit check for editingTransaction and selectedCardId
      showError("No se ha seleccionado una transacción o tarjeta para actualizar.");
      return;
    }

    const oldAmount = editingTransaction.amount;
    const oldType = editingTransaction.type;
    const oldInstallmentsTotalAmount = editingTransaction.installments_total_amount;
    const oldInstallmentsCount = editingTransaction.installments_count;

    const newAmountTotal = parseFloat(newTransaction.amount); // Nuevo monto total si es a meses, o monto único
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
      newInstallmentNumber = editingTransaction.installment_number || 1; // Mantener el número de cuota actual
    }

    const currentCard = cards.find(c => c.id === selectedCardId);
    if (!currentCard) {
      showError("Tarjeta no encontrada.");
      return;
    }

    let newCardBalance = currentCard.current_balance;

    // Revertir el impacto de la transacción antigua en el saldo
    const oldEffectiveAmount = oldInstallmentsTotalAmount ? oldInstallmentsTotalAmount / (oldInstallmentsCount || 1) : oldAmount;
    newCardBalance = oldType === "charge" ? newCardBalance - oldEffectiveAmount : newCardBalance + oldEffectiveAmount;

    // Aplicar el impacto de la nueva transacción en el saldo
    const newEffectiveAmount = newInstallmentsTotalAmount ? newInstallmentsTotalAmount / (newInstallmentsCount || 1) : newAmountTotal;

    if (currentCard.type === "debit") {
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
        if (currentCard.credit_limit !== undefined && newCardBalance + newEffectiveAmount > currentCard.credit_limit) {
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
      .eq('id', selectedCardId)
      .eq('user_id', user.id)
      .select();

    if (cardError) {
      showError('Error al actualizar saldo de la tarjeta: ' + cardError.message);
      return;
    }

    setCards((prevCards) =>
      prevCards.map((card) => {
        if (card.id === selectedCardId) {
          return {
            ...card,
            current_balance: newCardBalance,
            transactions: card.transactions.map(t => t.id === editingTransaction.id ? updatedTransactionData[0] : t),
          };
        }
        return card;
      })
    );

    setDetailedCard((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        current_balance: newCardBalance,
        transactions: prev.transactions.map(t => t.id === editingTransaction.id ? updatedTransactionData[0] : t),
      };
    });

    setNewTransaction({ type: "charge", amount: "", description: "", date: undefined, installments_count: undefined });
    setEditingTransaction(null);
    setSelectedCardId(null);
    setIsEditTransactionDialogOpen(false);
    showSuccess("Transacción actualizada exitosamente.");
  };

  const handleOpenEditCardDialog = (card: CardData) => {
    setEditingCard(card);
    setNewCard({
      name: card.name,
      bank_name: card.bank_name,
      last_four_digits: card.last_four_digits,
      expiration_date: card.expiration_date,
      type: card.type,
      initial_balance: card.initial_balance.toString(),
      credit_limit: card.credit_limit?.toString() || "",
      cut_off_day: card.cut_off_day,
      payment_due_day: card.payment_due_day,
      color: card.color,
    });
    setIsEditCardDialogOpen(true);
  };

  const handleUpdateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingCard) {
      showError("Debes iniciar sesión para actualizar la tarjeta.");
      return;
    }

    const initialBalance = parseFloat(newCard.initial_balance);
    if (isNaN(initialBalance) || initialBalance < 0) {
      showError("El saldo inicial debe ser un número positivo o cero.");
      return;
    }
    if (!newCard.bank_name.trim()) {
      showError("El nombre del banco no puede estar vacío.");
      return;
    }
    if (!/^\d{4}$/.test(newCard.last_four_digits)) {
      showError("Los últimos 4 dígitos deben ser exactamente 4 números.");
      return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(newCard.expiration_date)) {
      showError("La fecha de expiración debe tener el formato MM/AA (ej. 12/25).");
      return;
    }

    let creditLimit: number | undefined = undefined;
    let cutOffDay: number | undefined = undefined;
    let paymentDueDay: number | undefined = undefined;

    if (newCard.type === "credit") {
      creditLimit = parseFloat(newCard.credit_limit);
      if (isNaN(creditLimit) || creditLimit <= 0) {
        showError("El límite de crédito debe ser un número positivo.");
        return;
      }
      if (newCard.cut_off_day === undefined) {
        showError("Por favor, selecciona el día de corte para la tarjeta de crédito.");
        return;
      }
      if (newCard.payment_due_day === undefined) {
        showError("Por favor, selecciona el día límite de pago para la tarjeta de crédito.");
        return;
      }
      cutOffDay = newCard.cut_off_day;
      paymentDueDay = newCard.payment_due_day;
    }

    const { data, error } = await supabase
      .from('cards')
      .update({
        name: newCard.name.trim() || `${newCard.bank_name} ${newCard.type === "credit" ? "Crédito" : "Débito"}`,
        bank_name: newCard.bank_name.trim(),
        last_four_digits: newCard.last_four_digits,
        expiration_date: newCard.expiration_date,
        type: newCard.type,
        initial_balance: initialBalance,
        current_balance: parseFloat(newCard.initial_balance),
        credit_limit: newCard.type === "credit" ? creditLimit : null,
        cut_off_day: newCard.type === "credit" ? cutOffDay : null,
        payment_due_day: newCard.type === "credit" ? paymentDueDay : null,
        color: newCard.color,
      })
      .eq('id', editingCard.id)
      .eq('user_id', user.id)
      .select();

    if (error) {
      showError('Error al actualizar tarjeta: ' + error.message);
    } else {
      setCards((prev) =>
        prev.map((card) => (card.id === editingCard.id ? { ...data[0], transactions: card.transactions } : card))
      );
      setEditingCard(null);
      setNewCard({ name: "", bank_name: "", last_four_digits: "", expiration_date: "", type: "debit", initial_balance: "", credit_limit: "", cut_off_day: undefined, payment_due_day: undefined, color: "#3B82F6" });
      setIsEditCardDialogOpen(false);
      showSuccess("Tarjeta actualizada exitosamente.");
    }
  };

  const filteredCards = cards.filter((card) =>
    card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.bank_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.last_four_digits.includes(searchTerm)
  );

  // Obtener la tarjeta actual para el diálogo de transacción, si selectedCardId está definido
  const currentCardForDialog = selectedCardId ? cards.find(c => c.id === selectedCardId) : null;

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Gestión de Tarjetas</h1>

      <Card>
        <CardHeader>
          <CardTitle>Saldo Total de Tarjetas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">${totalCardsBalance.toFixed(2)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mis Tarjetas</CardTitle>
          <Dialog open={isAddCardDialogOpen} onOpenChange={setIsAddCardDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1">
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Añadir Tarjeta
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Añadir Nueva Tarjeta</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitNewCard} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Nombre (Opcional)
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={newCard.name}
                    onChange={handleNewCardChange}
                    className="col-span-3"
                    placeholder="Ej. Visa Principal"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="bank_name" className="text-right">
                    Banco
                  </Label>
                  <Input
                    id="bank_name"
                    name="bank_name"
                    value={newCard.bank_name}
                    onChange={handleNewCardChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="last_four_digits" className="text-right">
                    Últimos 4 Dígitos
                  </Label>
                  <Input
                    id="last_four_digits"
                    name="last_four_digits"
                    value={newCard.last_four_digits}
                    onChange={handleNewCardChange}
                    maxLength={4}
                    pattern="\d{4}"
                    inputMode="numeric"
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="expiration_date" className="text-right">
                    Fecha de Expiración (MM/AA)
                  </Label>
                  <Input
                    id="expiration_date"
                    name="expiration_date"
                    value={newCard.expiration_date}
                    onChange={handleNewCardChange}
                    maxLength={5}
                    placeholder="MM/AA"
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">
                    Tipo
                  </Label>
                  <Select value={newCard.type} onValueChange={handleNewCardTypeChange}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Débito</SelectItem>
                      <SelectItem value="credit">Crédito</SelectItem>
                    </SelectContent>
                  </Select>
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
                    value={newCard.initial_balance}
                    onChange={handleNewCardChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="cardColor" className="text-right">
                    Color de Tarjeta
                  </Label>
                  <div className="col-span-3">
                    <ColorPicker selectedColor={newCard.color} onSelectColor={handleNewCardColorSelect} />
                  </div>
                </div>
                {newCard.type === "credit" && (
                  <>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="credit_limit" className="text-right">
                        Límite de Crédito
                      </Label>
                      <Input
                        id="credit_limit"
                        name="credit_limit"
                        type="number"
                        step="0.01"
                        value={newCard.credit_limit}
                        onChange={handleNewCardChange}
                        className="col-span-3"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="cut_off_day" className="text-right">
                        Día de Corte
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "col-span-3 justify-start text-left font-normal",
                              !newCard.cut_off_day && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newCard.cut_off_day ? `Día ${newCard.cut_off_day} de cada mes` : <span>Selecciona un día</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={newCard.cut_off_day ? new Date(new Date().setDate(newCard.cut_off_day)) : undefined}
                            onSelect={(date) => handleNewCardDayChange("cut_off_day", date)}
                            initialFocus
                            captionLayout="dropdown-buttons"
                            fromYear={1900}
                            toYear={2100}
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="payment_due_day" className="text-right">
                        Día Límite de Pago
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "col-span-3 justify-start text-left font-normal",
                              !newCard.payment_due_day && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newCard.payment_due_day ? `Día ${newCard.payment_due_day} de cada mes` : <span>Selecciona un día</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={newCard.payment_due_day ? new Date(new Date().setDate(newCard.payment_due_day)) : undefined}
                            onSelect={(date) => handleNewCardDayChange("payment_due_day", date)}
                            initialFocus
                            captionLayout="dropdown-buttons"
                            fromYear={1900}
                            toYear={2100}
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </>
                )}
                <DialogFooter>
                  <Button type="submit">Guardar Tarjeta</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Buscar tarjeta por nombre, banco o últimos 4 dígitos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCards.map((card) => (
              <CardDisplay
                key={card.id}
                card={card}
                onAddTransaction={handleOpenAddTransactionDialog}
                onViewDetails={handleOpenDetailsDialog}
                onDeleteCard={handleDeleteCard}
                onEditCard={handleOpenEditCardDialog}
              />
            ))}
          </div>

          <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Registrar Transacción para {currentCardForDialog?.name}</DialogTitle>
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
                {newTransaction.type === "charge" && currentCardForDialog?.type === "credit" && (
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

          <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Detalles de la Tarjeta: {detailedCard?.name}</DialogTitle>
              </DialogHeader>
              <div className="py-4 grid gap-4">
                {detailedCard && (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Banco:</p>
                        <p className="font-medium">{detailedCard.bank_name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tipo:</p>
                        <p className="font-medium">{detailedCard.type === "credit" ? "Crédito" : "Débito"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Últimos 4 Dígitos:</p>
                        <p className="font-medium">**** {detailedCard.last_four_digits}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Fecha de Expiración:</p>
                        <p className="font-medium">{detailedCard.expiration_date}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Saldo Actual:</p>
                        <p className="font-medium">${detailedCard.current_balance.toFixed(2)}</p>
                      </div>
                      {detailedCard.type === "credit" && (
                        <>
                          <div>
                            <p className="text-muted-foreground">Límite de Crédito:</p>
                            <p className="font-medium">${detailedCard.credit_limit?.toFixed(2) || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Crédito Disponible:</p>
                            <p className="font-medium">${(detailedCard.credit_limit !== undefined ? detailedCard.credit_limit - detailedCard.current_balance : 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Día de Corte:</p>
                            <p className="font-medium">{detailedCard.cut_off_day ? `Día ${detailedCard.cut_off_day} de cada mes` : "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Día Límite de Pago:</p>
                            <p className="font-medium">{detailedCard.payment_due_day ? `Día ${detailedCard.payment_due_day} de cada mes` : "N/A"}</p>
                          </div>
                        </>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold mt-4">Historial de Transacciones</h3>
                    <div className="overflow-x-auto">
                      {detailedCard.transactions && detailedCard.transactions.length > 0 ? (
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
                            {detailedCard.transactions.map((transaction) => (
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
                                    onClick={() => handleOpenEditTransactionDialog(transaction, detailedCard.id)}
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
                        <p className="text-center text-muted-foreground">No hay historial de transacciones para esta tarjeta.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setIsDetailsDialogOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditTransactionDialogOpen} onOpenChange={setIsEditTransactionDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Editar Transacción para {detailedCard?.name}</DialogTitle>
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
                {newTransaction.type === "charge" && currentCardForDialog?.type === "credit" && (
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

          <Dialog open={isEditCardDialogOpen} onOpenChange={setIsEditCardDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Editar Tarjeta: {editingCard?.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateCard} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editCardName" className="text-right">
                    Nombre (Opcional)
                  </Label>
                  <Input
                    id="editCardName"
                    name="name"
                    value={newCard.name}
                    onChange={handleNewCardChange}
                    className="col-span-3"
                    placeholder="Ej. Visa Principal"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editCardBankName" className="text-right">
                    Banco
                  </Label>
                  <Input
                    id="editCardBankName"
                    name="bank_name"
                    value={newCard.bank_name}
                    onChange={handleNewCardChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editCardLastFourDigits" className="text-right">
                    Últimos 4 Dígitos
                  </Label>
                  <Input
                    id="editCardLastFourDigits"
                    name="last_four_digits"
                    value={newCard.last_four_digits}
                    onChange={handleNewCardChange}
                    maxLength={4}
                    pattern="\d{4}"
                    inputMode="numeric"
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editCardExpirationDate" className="text-right">
                    Fecha de Expiración (MM/AA)
                  </Label>
                  <Input
                    id="editCardExpirationDate"
                    name="expiration_date"
                    value={newCard.expiration_date}
                    onChange={handleNewCardChange}
                    maxLength={5}
                    placeholder="MM/AA"
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editCardType" className="text-right">
                    Tipo
                  </Label>
                  <Select value={newCard.type} onValueChange={handleNewCardTypeChange}>
                    <SelectTrigger id="editCardType" className="col-span-3">
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Débito</SelectItem>
                      <SelectItem value="credit">Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editCardInitialBalance" className="text-right">
                    Saldo Inicial
                  </Label>
                  <Input
                    id="editCardInitialBalance"
                    name="initial_balance"
                    type="number"
                    step="0.01"
                    value={newCard.initial_balance}
                    onChange={handleNewCardChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editCardColor" className="text-right">
                    Color de Tarjeta
                  </Label>
                  <div className="col-span-3">
                    <ColorPicker selectedColor={newCard.color} onSelectColor={handleNewCardColorSelect} />
                  </div>
                </div>
                {newCard.type === "credit" && (
                  <>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="editCreditLimit" className="text-right">
                        Límite de Crédito
                      </Label>
                      <Input
                        id="editCreditLimit"
                        name="credit_limit"
                        type="number"
                        step="0.01"
                        value={newCard.credit_limit}
                        onChange={handleNewCardChange}
                        className="col-span-3"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="editCutOffDay" className="text-right">
                        Día de Corte
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "col-span-3 justify-start text-left font-normal",
                              !newCard.cut_off_day && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newCard.cut_off_day ? `Día ${newCard.cut_off_day} de cada mes` : <span>Selecciona un día</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={newCard.cut_off_day ? new Date(new Date().setDate(newCard.cut_off_day)) : undefined}
                            onSelect={(date) => handleNewCardDayChange("cut_off_day", date)}
                            initialFocus
                            captionLayout="dropdown-buttons"
                            fromYear={1900}
                            toYear={2100}
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="editPaymentDueDay" className="text-right">
                        Día Límite de Pago
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "col-span-3 justify-start text-left font-normal",
                              !newCard.payment_due_day && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newCard.payment_due_day ? `Día ${newCard.payment_due_day} de cada mes` : <span>Selecciona un día</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={newCard.payment_due_day ? new Date(new Date().setDate(newCard.payment_due_day)) : undefined}
                            onSelect={(date) => handleNewCardDayChange("payment_due_day", date)}
                            initialFocus
                            captionLayout="dropdown-buttons"
                            fromYear={1900}
                            toYear={2100}
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </>
                )}
                <DialogFooter>
                  <Button type="submit">Actualizar Tarjeta</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default Cards;