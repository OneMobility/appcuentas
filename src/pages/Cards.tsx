"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PlusCircle, DollarSign, History, Trash2, Edit, CalendarIcon, ArrowRightLeft, FileText, FileDown, PiggyBank, Wallet, Banknote } from "lucide-react"; // Importar PiggyBank, Wallet, Banknote
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, addMonths, parseISO } from "date-fns"; // Importar parseISO
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import CardDisplay from "@/components/CardDisplay";
import ColorPicker from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getUpcomingPaymentDueDate, getUpcomingCutOffDate, getBillingCycleDates, getInstallmentFirstPaymentDueDate } from "@/utils/date-helpers"; // Importar las nuevas funciones
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import CardTransferDialog from "@/components/CardTransferDialog"; // Importar el nuevo componente
import { useCategoryContext } from "@/context/CategoryContext"; // Importar useCategoryContext
import { toast } from "sonner"; // Importar toast de sonner

interface CardTransaction {
  id: string;
  type: "charge" | "payment"; // Monto mensual si es a meses, o monto total si es pago único
  amount: number;
  description: string;
  date: string;
  card_id?: string;
  user_id?: string;
  installments_total_amount?: number; // Monto total del cargo original si es a meses
  installments_count?: number; // Número total de meses si es a meses
  installment_number?: number; // Número de cuota actual (1, 2, 3...)
  category_id?: string; // Añadido
  category_type?: "income" | "expense"; // Añadido
}

interface CardData {
  id: string;
  name: string;
  bank_name: string;
  last_four_digits: string;
  expiration_date: string;
  type: "credit" | "debit";
  initial_balance: number;
  current_balance: number; // Deuda total para crédito, saldo para débito
  credit_limit?: number;
  cut_off_day?: number;
  days_to_pay_after_cut_off?: number; // Nuevo campo
  color: string;
  transactions: CardTransaction[];
  user_id?: string;
}

const Cards = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, isLoadingCategories } = useCategoryContext(); // Usar el contexto de categorías
  const [cards, setCards] = useState<CardData[]>([]);
  const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);
  const [isEditCardDialogOpen, setIsEditCardDialogOpen] = useState(false);
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false); // Nuevo estado para el diálogo de transferencia
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [newCard, setNewCard] = useState({
    name: "",
    bank_name: "",
    last_four_digits: "",
    expiration_date: "",
    type: "debit" as "credit" | "debit",
    initial_balance: "",
    credit_limit: "",
    cut_off_day: undefined as number | undefined,
    days_to_pay_after_cut_off: undefined as number | undefined, // Nuevo campo
    color: "#3B82F6",
  });
  const [newTransaction, setNewTransaction] = useState({
    type: "charge" as "charge" | "payment",
    amount: "", // Este será el monto TOTAL para cargos a meses
    description: "",
    date: undefined as Date | undefined,
    installments_count: undefined as number | undefined, // Nuevo campo para meses
    category_id: "", // Añadido
  });

  const [searchTerm, setSearchTerm] = useState("");

  const fetchCards = async () => {
    if (!user || isLoadingCategories) { // Esperar a que carguen las categorías
      setCards([]);
      return;
    }

    const { data, error } = await supabase
      .from('cards')
      .select('*, card_transactions(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching cards:", error); // Log the error
      showError('Error al cargar tarjetas: ' + error.message);
    } else {
      // Asegurar que transactions sea siempre un array
      const formattedCards = (data || []).map(card => ({
        ...card,
        transactions: card.card_transactions || [] // Usar card_transactions de Supabase, por defecto array vacío
      }));
      setCards(formattedCards);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCards();
    }
  }, [user, isLoadingCategories]); // Añadir isLoadingCategories a las dependencias

  // Nuevos cálculos para las tarjetas de resumen
  const totalCreditAvailable = useMemo(() => {
    return cards
      .filter(c => c.type === "credit" && c.credit_limit !== undefined)
      .reduce((sum, c) => sum + (c.credit_limit! - c.current_balance), 0);
  }, [cards]);

  const totalCreditDebt = useMemo(() => {
    return cards
      .filter(c => c.type === "credit")
      .reduce((sum, c) => sum + c.current_balance, 0);
  }, [cards]);

  const totalDebitCardsBalance = useMemo(() => {
    return cards
      .filter(c => c.type === "debit")
      .reduce((sum, c) => sum + c.current_balance, 0);
  }, [cards]);


  const handleNewCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewCard((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewCardTypeChange = (value: "credit" | "debit") => {
    setNewCard((prev) => ({ ...prev, type: value, credit_limit: "", cut_off_day: undefined, days_to_pay_after_cut_off: undefined })); // Resetear días de pago
  };

  const handleNewCardDayChange = (field: "cut_off_day", date: Date | undefined) => { // Solo para cut_off_day
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
    let daysToPayAfterCutOff: number | undefined = undefined;

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
      if (newCard.days_to_pay_after_cut_off === undefined || newCard.days_to_pay_after_cut_off < 0) {
        showError("Por favor, ingresa los días para pagar después del corte.");
        return;
      }
      cutOffDay = newCard.cut_off_day;
      daysToPayAfterCutOff = newCard.days_to_pay_after_cut_off;
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
        days_to_pay_after_cut_off: newCard.type === "credit" ? daysToPayAfterCutOff : undefined, // Guardar nuevo campo
        color: newCard.color,
      })
      .select();

    if (error) {
      showError('Error al registrar tarjeta: ' + error.message);
    } else {
      setCards((prev) => [...prev, { ...data[0], transactions: [] }]);
      setNewCard({ name: "", bank_name: "", last_four_digits: "", expiration_date: "", type: "debit", initial_balance: "", credit_limit: "", cut_off_day: undefined, days_to_pay_after_cut_off: undefined, color: "#3B82F6" });
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
    setNewTransaction({ type: "charge", amount: "", description: "", date: new Date(), installments_count: undefined, category_id: "" }); // Default to current date
    setIsAddTransactionDialogOpen(true);
  };

  const handleTransactionInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewTransaction((prev) => ({ ...prev, [name]: value }));
  };

  const handleTransactionTypeChange = (value: "charge" | "payment") => {
    setNewTransaction((prev) => ({ ...prev, type: value, installments_count: undefined, category_id: "" }));
  };

  const handleTransactionDateChange = (date: Date | undefined) => {
    setNewTransaction((prev) => ({ ...prev, date: date }));
  };

  const handleInstallmentsChange = (value: string) => {
    setNewTransaction((prev) => ({ ...prev, installments_count: parseInt(value) || undefined }));
  };

  const handleCategorySelectChange = (value: string) => {
    setNewTransaction((prev) => ({ ...prev, category_id: value }));
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("Debes iniciar sesión para registrar transacciones.");
      return;
    }
    if (!selectedCardId) {
      showError("No se ha seleccionado una tarjeta para la transacción.");
      return;
    }

    const totalAmount = parseFloat(newTransaction.amount); // Monto total ingresado por el usuario
    if (isNaN(totalAmount) || totalAmount <= 0) {
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

    let categoryId: string | undefined = undefined;
    let categoryType: "income" | "expense" | undefined = undefined;

    if (newTransaction.type === "charge") {
      if (!newTransaction.category_id) {
        showError("Por favor, selecciona una categoría para el cargo.");
        return;
      }
      categoryId = newTransaction.category_id;
      categoryType = "expense";
    } else if (newTransaction.type === "payment" && currentCard.type === "debit") {
      if (!newTransaction.category_id) {
        showError("Por favor, selecciona una categoría para el ingreso.");
        return;
      }
      categoryId = newTransaction.category_id;
      categoryType = "income";
    }

    let newCardBalance = currentCard.current_balance;
    const transactionsToInsert: Omit<CardTransaction, 'id'>[] = [];

    if (currentCard.type === "credit" && newTransaction.type === "charge" && newTransaction.installments_count && newTransaction.installments_count > 1) {
      // Logic for installment charges on credit cards
      const amountPerInstallment = totalAmount / newTransaction.installments_count;
      
      // Update card balance with the total amount immediately
      newCardBalance += totalAmount;

      // Check if credit limit is exceeded
      if (currentCard.credit_limit !== undefined && newCardBalance > currentCard.credit_limit) {
        toast.info(`Tu tarjeta de crédito ha excedido su límite. Saldo actual: $${newCardBalance.toFixed(2)}`, {
          style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
          duration: 10000
        });
      }

      // Determine the first installment's due date using the new helper function
      const firstPaymentDueDate = getInstallmentFirstPaymentDueDate(
        newTransaction.date,
        currentCard.cut_off_day!,
        currentCard.days_to_pay_after_cut_off!
      );

      for (let i = 0; i < newTransaction.installments_count; i++) {
        const installmentDate = addMonths(firstPaymentDueDate, i);
        transactionsToInsert.push({
          user_id: user.id,
          card_id: selectedCardId,
          type: "charge",
          amount: amountPerInstallment,
          description: `${newTransaction.description} (Cuota ${i + 1}/${newTransaction.installments_count})`,
          date: format(installmentDate, "yyyy-MM-dd"),
          installments_total_amount: totalAmount,
          installments_count: newTransaction.installments_count,
          installment_number: i + 1,
          category_id: categoryId,
          category_type: categoryType,
        });
      }
    } else {
      // Logic for single charges or payments
      if (currentCard.type === "debit") {
        if (newTransaction.type === "charge") {
          if (newCardBalance < totalAmount) {
            showError("Saldo insuficiente en la tarjeta de débito.");
            return;
          }
          newCardBalance -= totalAmount;
        } else { // payment to debit card
          newCardBalance += totalAmount;
        }
      } else { // Credit card (single charge or payment)
        if (newTransaction.type === "charge") {
          newCardBalance += totalAmount;
          if (currentCard.credit_limit !== undefined && newCardBalance > currentCard.credit_limit) {
            toast.info(`Tu tarjeta de crédito ha excedido su límite. Saldo actual: $${newCardBalance.toFixed(2)}`, {
              style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
              duration: 10000
            });
          }
        } else { // Payment to credit card
          if (newCardBalance < totalAmount) {
            showError("El pago excede la deuda pendiente.");
            return;
          }
          newCardBalance -= totalAmount;
          if (newCardBalance < 0) {
            toast.info(`Has sobrepagado tu tarjeta ${currentCard.name}. Tu saldo actual es de $${newCardBalance.toFixed(2)} (a tu favor).`, {
              style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
              duration: 10000
            });
          }
        }
      }
      transactionsToInsert.push({
        user_id: user.id,
        card_id: selectedCardId,
        type: newTransaction.type,
        amount: totalAmount,
        description: newTransaction.description,
        date: format(newTransaction.date, "yyyy-MM-dd"),
        installments_total_amount: undefined,
        installments_count: undefined,
        installment_number: undefined,
        category_id: categoryId,
        category_type: categoryType,
      });
    }

    try {
      const { data: insertedTransactions, error: transactionError } = await supabase
        .from('card_transactions')
        .insert(transactionsToInsert)
        .select();

      if (transactionError) throw transactionError;

      const { data: cardData, error: cardError } = await supabase
        .from('cards')
        .update({ current_balance: newCardBalance })
        .eq('id', selectedCardId)
        .eq('user.id', user.id)
        .select();

      if (cardError) throw cardError;

      setCards((prevCards) =>
        prevCards.map((card) => {
          if (card.id === selectedCardId) {
            return {
              ...card,
              current_balance: newCardBalance,
              transactions: [...(card.transactions || []), ...insertedTransactions],
            };
          }
          return card;
        })
      );
      setNewTransaction({ type: "charge", amount: "", description: "", date: undefined, installments_count: undefined, category_id: "" });
      setSelectedCardId(null);
      setIsAddTransactionDialogOpen(false);
      showSuccess("Transacción(es) registrada(s) exitosamente.");

      // Check for active no-spend challenge if this is a charge
      if (newTransaction.type === "charge" && categoryId) {
        const { data: activeChallenge, error: challengeError } = await supabase
          .from('challenges')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (challengeError && challengeError.code !== 'PGRST116') {
          console.error("Error fetching active challenge:", challengeError.message);
        } else if (activeChallenge && activeChallenge.challenge_template_id.startsWith("no-spend")) {
          const endDate = new Date(activeChallenge.end_date);
          endDate.setHours(23, 59, 59, 999);
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (today >= new Date(activeChallenge.start_date) && today <= endDate) {
            if (activeChallenge.forbidden_category_ids.includes(categoryId)) {
              const { error: updateChallengeError } = await supabase
                .from('challenges')
                .update({ status: 'failed' })
                .eq('id', activeChallenge.id)
                .eq('user_id', user.id);

              if (updateChallengeError) {
                showError('Error al actualizar el reto de cero gastos: ' + updateChallengeError.message);
              } else {
                showError(`¡Reto '${activeChallenge.name}' fallido! Registraste un gasto en una categoría prohibida.`);
              }
            }
          }
        }
      }
    } catch (error: any) {
      showError('Error al registrar transacción: ' + error.message);
      console.error("Supabase transaction error:", error);
    }
  };

  const handleOpenEditCardDialog = (card: CardData) => {
    setEditingCard(card);
    setNewCard({
      name: card.name,
      bank_name: card.bank_name,
      last_four_digits: card.last_four_digits,
      expiration_date: card.expiration_date,
      type: card.type,
      initial_balance: card.initial_balance.toString(), // Usar initial_balance para edición
      credit_limit: card.credit_limit?.toString() || "",
      cut_off_day: card.cut_off_day,
      days_to_pay_after_cut_off: card.days_to_pay_after_cut_off, // Cargar nuevo campo
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
    let daysToPayAfterCutOff: number | undefined = undefined;

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
      if (newCard.days_to_pay_after_cut_off === undefined || newCard.days_to_pay_after_cut_off < 0) {
        showError("Por favor, ingresa los días para pagar después del corte.");
        return;
      }
      cutOffDay = newCard.cut_off_day;
      daysToPayAfterCutOff = newCard.days_to_pay_after_cut_off;
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
        current_balance: parseFloat(newCard.initial_balance), // Al editar, el current_balance se resetea al initial_balance
        credit_limit: newCard.type === "credit" ? creditLimit : null,
        cut_off_day: newCard.type === "credit" ? cutOffDay : null,
        days_to_pay_after_cut_off: newCard.type === "credit" ? daysToPayAfterCutOff : null, // Actualizar nuevo campo
        color: newCard.color,
      })
      .eq('id', editingCard.id)
      .eq('user_id', user.id)
      .select();

    if (error) {
      showError('Error al actualizar tarjeta: ' + error.message);
    } else {
      setCards((prev) =>
        prev.map((card) => (card.id === editingCard.id ? { ...data[0], transactions: card.transactions || [] } : card)) // Asegurar que transactions sea un array
      );
      setEditingCard(null);
      setNewCard({ name: "", bank_name: "", last_four_digits: "", expiration_date: "", type: "debit", initial_balance: "", credit_limit: "", cut_off_day: undefined, days_to_pay_after_cut_off: undefined, color: "#3B82F6" });
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
      <h1 className="text-3xl font-bold">Tus Tarjetas</h1>

      {/* Nuevas tarjetas de resumen */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-l-4 border-purple-500 bg-purple-50 text-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Crédito Disponible</CardTitle>
            <Wallet className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCreditAvailable.toFixed(2)}</div>
            <p className="text-xs text-purple-700">Total disponible en tus tarjetas de crédito.</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-pink-500 bg-pink-50 text-pink-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-pink-800">Deuda Total de Crédito</CardTitle>
            <PiggyBank className="h-4 w-4 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCreditDebt.toFixed(2)}</div>
            <p className="text-xs text-pink-700">Suma de todas tus deudas de tarjetas de crédito.</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">Saldo Tarjetas Débito</CardTitle>
            <Banknote className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalDebitCardsBalance.toFixed(2)}</div>
            <p className="text-xs text-yellow-700">Saldo total en tus tarjetas de débito.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mis Tarjetas</CardTitle>
          <div className="flex gap-2">
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
                        <Label htmlFor="days_to_pay_after_cut_off" className="text-right">
                          Días para pagar después del corte
                        </Label>
                        <Input
                          id="days_to_pay_after_cut_off"
                          name="days_to_pay_after_cut_off"
                          type="number"
                          min="0"
                          value={newCard.days_to_pay_after_cut_off?.toString() || ""}
                          onChange={handleNewCardChange}
                          className="col-span-3"
                          required
                        />
                      </div>
                    </>
                  )}
                  <DialogFooter>
                    <Button type="submit">Guardar Tarjeta</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button size="sm" className="h-8 gap-1" onClick={() => setIsTransferDialogOpen(true)}>
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Transferir
              </span>
            </Button>
          </div>
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
                onDeleteCard={handleDeleteCard}
                onEditCard={handleOpenEditCardDialog}
              />
            ))}
          </div>

          <CardTransferDialog
            isOpen={isTransferDialogOpen}
            onClose={() => setIsTransferDialogOpen(false)}
            cards={cards}
            onTransferSuccess={fetchCards} // Refresh cards after successful transfer
          />

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
                {/* Conditionally render category selector based on transaction type and card type */}
                {(newTransaction.type === "charge" || (newTransaction.type === "payment" && currentCardForDialog?.type === "debit")) && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="category_id" className="text-right">
                      Categoría
                    </Label>
                    <Select value={newTransaction.category_id} onValueChange={handleCategorySelectChange}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Selecciona categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {newTransaction.type === "charge" ? (
                          expenseCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))
                        ) : (
                          incomeCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
                      <Label htmlFor="editDaysToPayAfterCutOff" className="text-right">
                        Días para pagar después del corte
                      </Label>
                      <Input
                        id="editDaysToPayAfterCutOff"
                        name="days_to_pay_after_cut_off"
                        type="number"
                        min="0"
                        value={newCard.days_to_pay_after_cut_off?.toString() || ""}
                        onChange={handleNewCardChange}
                        className="col-span-3"
                        required
                      />
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