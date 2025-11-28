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
import { DollarSign, History, Trash2, Edit, CalendarIcon, ArrowLeft, FileText, FileDown, Heart, AlertTriangle } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, addMonths, parseISO, isWithinInterval, isBefore, isAfter, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import ColorPicker from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getUpcomingPaymentDueDate, getLastClosedStatementDetails, getInstallmentFirstPaymentDueDate, getCurrentActiveBillingCycle } from "@/utils/date-helpers"; // Importar la nueva función
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import LoadingSpinner from "@/components/LoadingSpinner";
import PaymentDueDateCard from "@/components/PaymentDueDateCard";
import CutOffDateCard from "@/components/CutOffDateCard";
import { useCategoryContext } from "@/context/CategoryContext";
import { toast } from "sonner";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";

interface CardTransaction {
  id: string;
  type: "charge" | "payment";
  amount: number; // Monto por cuota si es a meses, o monto total si es pago único
  description: string;
  date: string;
  card_id?: string;
  user_id?: string;
  installments_total_amount?: number; // Monto total del cargo original si es a meses
  installments_count?: number; // Número total de meses si es a meses
  installment_number?: number; // Número de cuota actual (1, 2, 3...)
  income_category_id?: string | null;
  expense_category_id?: string | null;
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
  days_to_pay_after_cut_off?: number;
  color: string;
  transactions: CardTransaction[];
  user_id?: string;
}

const CardDetailsPage: React.FC = () => {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { incomeCategories, expenseCategories, getCategoryById, isLoadingCategories } = useCategoryContext();
  const [card, setCard] = useState<CardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [isEditTransactionDialogOpen, setIsEditTransactionDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<CardTransaction | null>(null);
  const [newTransaction, setNewTransaction] = useState({
    type: "charge" as "charge" | "payment",
    amount: "", // Este será el monto TOTAL para cargos a meses
    description: "",
    date: undefined as Date | undefined,
    installments_count: undefined as number | undefined,
    selectedCategoryId: "", // Single field for selected category ID
    selectedCategoryType: "" as "income" | "expense" | "", // To track which type of category is selected
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "charge" | "payment">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isOverdue, setIsOverdue] = useState(false); // New state for overdue notification

  useEffect(() => {
    const fetchCardDetails = async () => {
      if (!user || !cardId || isLoadingCategories) {
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
        console.error("Error fetching card details:", error);
        showError('Error al cargar detalles de la tarjeta: ' + error.message);
        navigate('/cards');
      } else {
        const formattedCard = {
          ...(data as CardData),
          transactions: (data as any).card_transactions || []
        };
        setCard(formattedCard);
      }
      setIsLoading(false);
    };

    fetchCardDetails();
  }, [cardId, user, navigate, isLoadingCategories]);

  // Use this memoized data instead of calculating it in multiple places.
  const cardCalculatedData = useMemo(() => {
    if (!card || !card.cut_off_day || !card.days_to_pay_after_cut_off) {
      return null;
    }
  
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const {
      statementStartDate: lastStatementStartDate,
      statementEndDate: lastStatementEndDate,
      statementPaymentDueDate: lastStatementPaymentDueDate,
    } = getLastClosedStatementDetails(
      card.cut_off_day,
      card.days_to_pay_after_cut_off,
      today
    );

    const {
      currentCycleStartDate,
      currentCycleEndDate,
    } = getCurrentActiveBillingCycle(card.cut_off_day, today);

    // Filter and calculate for pendingPaymentDebt
    const {
      totalCharges: statementTotalCharges,
      totalPayments: statementTotalPayments,
    } = (card.transactions || []).reduce(
      (acc, tx) => {
        const txDateParsed = parseISO(tx.date);
        // For installments, the 'date' is the installment due date.
        // For single charges, the 'date' is the transaction date.
        if (tx.type === "charge") {
          if (
            isWithinInterval(txDateParsed, {
              start: lastStatementStartDate,
              end: lastStatementEndDate,
            })
          ) {
            acc.totalCharges += tx.amount;
          }
        } else if (tx.type === "payment") {
          // Payments applied on or before the due date, to the previous period
          if (
            isWithinInterval(txDateParsed, {
              start: lastStatementStartDate,
              end: lastStatementPaymentDueDate,
            })
          ) {
            acc.totalPayments += tx.amount;
          }
        }
        return acc;
      },
      { totalCharges: 0, totalPayments: 0 }
    );
    const pendingPaymentDebt = Math.max(
      0,
      statementTotalCharges - statementTotalPayments
    );
     // Filter and calculate the currentCycleDebt
     const {
      totalCharges: currentCycleTotalCharges,
      totalPayments: currentCycleTotalPayments,
    } = (card.transactions || []).reduce(
      (acc, tx) => {
        const txDateParsed = parseISO(tx.date);
  
        if (tx.type === "charge") {
          if (
            isWithinInterval(txDateParsed, {
              start: currentCycleStartDate,
              end: currentCycleEndDate,
            })
          ) {
            acc.totalCharges += tx.amount;
          }
        } else if (tx.type === "payment") {
          if (
            isWithinInterval(txDateParsed, {
              start: currentCycleStartDate,
              end: currentCycleEndDate,
            })
          ) {
            acc.totalPayments += tx.amount;
          }
        }
        return acc;
      },
      { totalCharges: 0, totalPayments: 0 }
    );
    const currentCycleDebt = Math.max(
      0,
      currentCycleTotalCharges - currentCycleTotalPayments
    );
     // Recalculate credit available/used
     const creditUsed = card.type === "credit" ? card.current_balance : 0;
     const creditAvailable =
       card.type === "credit" && card.credit_limit !== undefined
         ? card.credit_limit - card.current_balance
         : 0;

    return {
      currentCycleDebt,
      pendingPaymentDebt,
      creditUsed,
      creditAvailable,
      lastStatementStartDate,
      lastStatementEndDate,
      lastStatementPaymentDueDate,
      currentCycleStartDate,
      currentCycleEndDate,
    };
  }, [card]);


  // Effect to calculate if payment is overdue
  useEffect(() => {
    if (cardCalculatedData && card && card.type === "credit") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // If today is strictly after the payment due date AND there's still a positive net statement balance
      if (isAfter(today, cardCalculatedData.lastStatementPaymentDueDate) && cardCalculatedData.pendingPaymentDebt > 0) {
        setIsOverdue(true);
      } else {
        setIsOverdue(false);
      }
    } else {
      setIsOverdue(false);
    }
  }, [card, cardCalculatedData]); // Recalculate when card data changes

  const handleTransactionInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewTransaction((prev) => ({ ...prev, [name]: value }));
  };

  const handleTransactionTypeChange = (value: "charge" | "payment") => {
    setNewTransaction((prev) => ({ ...prev, type: value, installments_count: undefined, selectedCategoryId: "", selectedCategoryType: "" }));
  };

  const handleTransactionDateChange = (date: Date | undefined) => {
    setNewTransaction((prev) => ({ ...prev, date: date }));
  };

  const handleInstallmentsChange = (value: string) => {
    setNewTransaction((prev) => ({ ...prev, installments_count: parseInt(value) || undefined }));
  };

  const handleCategorySelectChange = (value: string) => {
    const category = [...incomeCategories, ...expenseCategories].find(cat => cat.id === value);
    if (category) {
      setNewTransaction((prev) => ({
        ...prev,
        selectedCategoryId: value,
        selectedCategoryType: incomeCategories.some(c => c.id === value) ? "income" : "expense",
      }));
    } else {
      setNewTransaction((prev) => ({ ...prev, selectedCategoryId: value, selectedCategoryType: "" }));
    }
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !card) {
      showError("Debes iniciar sesión o la tarjeta no está cargada.");
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

    let incomeCategoryIdToInsert: string | null = null;
    let expenseCategoryIdToInsert: string | null = null;

    if (newTransaction.selectedCategoryId) {
      if (newTransaction.selectedCategoryType === "income") {
        incomeCategoryIdToInsert = newTransaction.selectedCategoryId;
      } else if (newTransaction.selectedCategoryType === "expense") {
        expenseCategoryIdToInsert = newTransaction.selectedCategoryId;
      }
    } else if (newTransaction.type === "charge" || (newTransaction.type === "payment" && card.type === "debit")) {
      showError("Por favor, selecciona una categoría.");
      return;
    }

    let newCardBalance = card.current_balance;
    const transactionsToInsert: Omit<CardTransaction, 'id'>[] = [];

    if (card.type === "credit" && newTransaction.type === "charge" && newTransaction.installments_count && newTransaction.installments_count > 1) {
      // Logic for installment charges on credit cards
      const amountPerInstallment = totalAmount / newTransaction.installments_count;
      
      // Update card balance with the total amount immediately
      newCardBalance += totalAmount;

      // Check if credit limit is exceeded
      if (card.credit_limit !== undefined && newCardBalance > card.credit_limit) {
        toast.info(`Tu tarjeta de crédito ha excedido su límite. Saldo actual: $${newCardBalance.toFixed(2)}`, {
          style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
          duration: 10000
        });
      }

      // Determine the first installment's due date using the new helper function
      const firstPaymentDueDate = getInstallmentFirstPaymentDueDate(
        newTransaction.date,
        card.cut_off_day!,
        card.days_to_pay_after_cut_off!
      );

      for (let i = 0; i < newTransaction.installments_count; i++) {
        const installmentDate = addMonths(firstPaymentDueDate, i);
        transactionsToInsert.push({
          user_id: user.id,
          card_id: card.id,
          type: "charge",
          amount: amountPerInstallment,
          description: `${newTransaction.description} (Cuota ${i + 1}/${newTransaction.installments_count})`,
          date: format(installmentDate, "yyyy-MM-dd"),
          installments_total_amount: totalAmount,
          installments_count: newTransaction.installments_count,
          installment_number: i + 1,
          expense_category_id: expenseCategoryIdToInsert,
        });
      }
    } else {
      // Logic for single charges or payments
      if (card.type === "debit") {
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
          if (card.credit_limit !== undefined && newCardBalance > card.credit_limit) {
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
            toast.info(`Has sobrepagado tu tarjeta ${card.name}. Tu saldo actual es de $${newCardBalance.toFixed(2)} (a tu favor).`, {
              style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
              duration: 10000
            });
          }
        }
      }
      transactionsToInsert.push({
        user_id: user.id,
        card_id: card.id,
        type: newTransaction.type,
        amount: totalAmount,
        description: newTransaction.description,
        date: format(newTransaction.date, "yyyy-MM-dd"),
        installments_total_amount: undefined,
        installments_count: undefined,
        installment_number: undefined,
        income_category_id: incomeCategoryIdToInsert,
        expense_category_id: expenseCategoryIdToInsert,
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
        .eq('id', card.id)
        .eq('user_id', user.id)
        .select();

      if (cardError) throw cardError;

      // Re-fetch all transactions for the card to ensure consistency
      const { data: updatedTransactions, error: fetchTxError } = await supabase
        .from('card_transactions')
        .select('*')
        .eq('card_id', card.id)
        .eq('user_id', user.id);
      if (fetchTxError) throw fetchTxError;

      setCard((prevCard) => {
        if (!prevCard) return null;
        return {
          ...prevCard,
          current_balance: newCardBalance,
          transactions: updatedTransactions || [],
        };
      });
      setNewTransaction({ type: "charge", amount: "", description: "", date: undefined, installments_count: undefined, selectedCategoryId: "", selectedCategoryType: "" });
      setIsAddTransactionDialogOpen(false);
      showSuccess("Transacción(es) registrada(s) exitosamente.");
    } catch (error: any) {
      showError('Error al registrar transacción: ' + error.message);
      console.error("Supabase transaction error:", error);
    }
  };

  const handleOpenEditTransactionDialog = (transaction: CardTransaction) => {
    setEditingTransaction(transaction);
    const categoryId = transaction.income_category_id || transaction.expense_category_id || "";
    const categoryType = transaction.income_category_id ? "income" : (transaction.expense_category_id ? "expense" : "");

    setNewTransaction({
      type: transaction.type,
      amount: (transaction.installments_total_amount || transaction.amount).toString(), // Mostrar monto total para edición
      description: transaction.description.replace(/\s\(Cuota\s\d+\/\d+\)/, ''), // Limpiar descripción de cuota
      date: new Date(transaction.date),
      installments_count: transaction.installments_count,
      selectedCategoryId: categoryId,
      selectedCategoryType: categoryType as "income" | "expense" | "",
    });
    setIsEditTransactionDialogOpen(true);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingTransaction || !card) {
      showError("No se ha seleccionado una transacción o tarjeta para actualizar.");
      return;
    }

    const oldTransaction = editingTransaction;
    const newTotalAmount = parseFloat(newTransaction.amount);
    const newType = newTransaction.type;
    const newInstallmentsCount = newTransaction.installments_count;

    if (isNaN(newTotalAmount) || newTotalAmount <= 0) {
      showError("El monto de la transacción debe ser un número positivo.");
      return;
    }
    if (!newTransaction.date) {
      showError("Por favor, selecciona una fecha para la transacción.");
      return;
    }

    let newIncomeCategoryId: string | null = null;
    let newExpenseCategoryId: string | null = null;

    if (newTransaction.selectedCategoryId) {
      if (newTransaction.selectedCategoryType === "income") {
        newIncomeCategoryId = newTransaction.selectedCategoryId;
      } else if (newTransaction.selectedCategoryType === "expense") {
        newExpenseCategoryId = newTransaction.selectedCategoryId;
      }
    } else if (newType === "charge" || (newType === "payment" && card.type === "debit")) {
      showError("Por favor, selecciona una categoría.");
      return;
    }

    let newCardBalance = card.current_balance;

    // Revertir el impacto de la transacción antigua en el saldo
    const oldEffectiveAmount = oldTransaction.installments_total_amount || oldTransaction.amount;
    newCardBalance = oldTransaction.type === "charge" ? newCardBalance - oldEffectiveAmount : newCardBalance + oldEffectiveAmount;

    // Eliminar todas las cuotas antiguas si la transacción editada era a meses
    if (oldTransaction.installments_count && oldTransaction.installments_count > 1) {
      const { error: deleteOldInstallmentsError } = await supabase
        .from('card_transactions')
        .delete()
        .eq('installments_total_amount', oldTransaction.installments_total_amount)
        .eq('card_id', card.id)
        .eq('user_id', user.id); // Corrected user.id
      if (deleteOldInstallmentsError) throw deleteOldInstallmentsError;
    } else {
      // Si era una transacción única, simplemente eliminarla
      const { error: deleteOldTransactionError } = await supabase
        .from('card_transactions')
        .delete()
        .eq('id', oldTransaction.id)
        .eq('user_id', user.id);
      if (deleteOldTransactionError) throw deleteOldTransactionError;
    }

    const transactionsToInsert: Omit<CardTransaction, 'id'>[] = [];

    if (card.type === "credit" && newType === "charge" && newInstallmentsCount && newInstallmentsCount > 1) {
      // Logic for new installment charges on credit cards
      const amountPerInstallment = newTotalAmount / newInstallmentsCount;
      
      // Apply new total amount to card balance
      newCardBalance += newTotalAmount;

      if (card.credit_limit !== undefined && newCardBalance > card.credit_limit) {
        toast.info(`¡Atención! El saldo actual de tu tarjeta ${card.name} excede su límite de crédito.`, {
          style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
          duration: 10000
        });
      }

      // Determine the first installment's due date using the new helper function
      const firstPaymentDueDate = getInstallmentFirstPaymentDueDate(
        newTransaction.date,
        card.cut_off_day!,
        card.days_to_pay_after_cut_off!
      );

      for (let i = 0; i < newInstallmentsCount; i++) {
        const installmentDate = addMonths(firstPaymentDueDate, i);
        transactionsToInsert.push({
          user_id: user.id,
          card_id: card.id,
          type: "charge",
          amount: amountPerInstallment,
          description: `${newTransaction.description} (Cuota ${i + 1}/${newInstallmentsCount})`,
          date: format(installmentDate, "yyyy-MM-dd"),
          installments_total_amount: newTotalAmount,
          installments_count: newInstallmentsCount,
          installment_number: i + 1,
          expense_category_id: newExpenseCategoryId,
        });
      }
    } else {
      // Logic for new single charges or payments
      if (card.type === "debit") {
        if (newType === "charge") {
          if (newCardBalance < newTotalAmount) {
            showError("Saldo insuficiente en la tarjeta de débito.");
            return;
          }
          newCardBalance -= newTotalAmount;
        } else { // payment to debit card
          newCardBalance += newTotalAmount;
        }
      } else { // Credit card (single charge or payment)
        if (newType === "charge") {
          newCardBalance += newTotalAmount;
          if (card.credit_limit !== undefined && newCardBalance > card.credit_limit) {
            toast.info(`¡Atención! El saldo actual de tu tarjeta ${card.name} excede su límite de crédito.`, {
              style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
              duration: 10000
            });
          }
        } else { // Payment to credit card
          if (newCardBalance < newTotalAmount) {
            showError("El pago excede la deuda pendiente.");
            return;
          }
          newCardBalance -= newTotalAmount;
          if (newCardBalance < 0) {
            toast.info(`Has sobrepagado tu tarjeta ${card.name}. Tu saldo actual es de $${newCardBalance.toFixed(2)} (a tu favor).`, {
              style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
              duration: 10000
            });
          }
        }
      }
      transactionsToInsert.push({
        user_id: user.id,
        card_id: card.id,
        type: newType,
        amount: newTotalAmount,
        description: newTransaction.description,
        date: format(newTransaction.date, "yyyy-MM-dd"),
        installments_total_amount: undefined,
        installments_count: undefined,
        installment_number: undefined,
        income_category_id: newIncomeCategoryId,
        expense_category_id: newExpenseCategoryId,
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
        .eq('id', card.id)
        .eq('user_id', user.id)
        .select();

      if (cardError) throw cardError;

      // Re-fetch all transactions for the card to ensure consistency
      const { data: updatedTransactions, error: fetchTxError } = await supabase
        .from('card_transactions')
        .select('*')
        .eq('card_id', card.id)
        .eq('user_id', user.id);
      if (fetchTxError) throw fetchTxError;

      setCard((prevCard) => {
        if (!prevCard) return null;
        return {
          ...prevCard,
          current_balance: newCardBalance,
          transactions: updatedTransactions || [],
        };
      });

      setNewTransaction({ type: "charge", amount: "", description: "", date: undefined, installments_count: undefined, selectedCategoryId: "", selectedCategoryType: "" });
      setEditingTransaction(null);
      setIsEditTransactionDialogOpen(false);
      showSuccess("Transacción(es) actualizada(s) exitosamente.");
    } catch (error: any) {
      showError('Error al actualizar transacción: ' + error.message);
      console.error("Supabase transaction update error:", error);
    }
  };

  const handleDeleteCardTransaction = async (transaction: CardTransaction) => {
    if (!user || !card) {
      showError("Debes iniciar sesión o la tarjeta no está cargada.");
      return;
    }

    let newCardBalance = card.current_balance;
    const effectiveAmount = transaction.installments_total_amount || transaction.amount;

    // Revertir el impacto de la transacción eliminada en el saldo
    newCardBalance = transaction.type === "charge" ? newCardBalance - effectiveAmount : newCardBalance + effectiveAmount;

    try {
      if (transaction.installments_count && transaction.installments_count > 1) {
        // Si es una cuota, eliminar todas las cuotas de la misma compra
        const { error: deleteInstallmentsError } = await supabase
          .from('card_transactions')
          .delete()
          .eq('installments_total_amount', transaction.installments_total_amount)
          .eq('card_id', card.id)
          .eq('user_id', user.id);
        if (deleteInstallmentsError) throw deleteInstallmentsError;
      } else {
        // Si es una transacción única, eliminar solo esa
        const { error: deleteTransactionError } = await supabase
          .from('card_transactions')
          .delete()
          .eq('id', transaction.id)
          .eq('user_id', user.id);
        if (deleteTransactionError) throw deleteTransactionError;
      }

      const { error: cardError } = await supabase
        .from('cards')
        .update({ current_balance: newCardBalance })
        .eq('id', card.id)
        .eq('user_id', user.id);
      if (cardError) throw cardError;

      // Re-fetch all transactions for the card to ensure consistency
      const { data: updatedTransactions, error: fetchTxError } = await supabase
        .from('card_transactions')
        .select('*')
        .eq('card_id', card.id)
        .eq('user_id', user.id);
      if (fetchTxError) throw fetchTxError;

      setCard((prevCard) => {
        if (!prevCard) return null;
        return {
          ...prevCard,
          current_balance: newCardBalance,
          transactions: updatedTransactions || [],
        };
      });

      showSuccess("Transacción(es) eliminada(s) exitosamente.");
    } catch (error: any) {
      showError('Error al eliminar transacción: ' + error.message);
      console.error("Supabase transaction delete error:", error);
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!card) return [];
    return (card.transactions || []).filter((tx) => {
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      
      const categoryId = tx.income_category_id || tx.expense_category_id;
      const category = getCategoryById(categoryId);
      const categoryName = category?.name || "";
      const matchesCategory = filterCategory === "all" || categoryId === filterCategory || categoryName.toLowerCase().includes(filterCategory.toLowerCase());
      
      const txDate = parseISO(tx.date);
      const matchesDate = !dateRange?.from || (txDate >= dateRange.from && (!dateRange.to || txDate <= dateRange.to));

      return matchesSearch && matchesType && matchesCategory && matchesDate;
    }).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [card, searchTerm, filterType, filterCategory, dateRange, getCategoryById]);

  const handleExportCardTransactions = (formatType: 'csv' | 'pdf') => {
    if (!card) {
      showError("No hay tarjeta seleccionada para exportar.");
      return;
    }

    const dataToExport = filteredTransactions.map(tx => {
      const category = getCategoryById(tx.income_category_id || tx.expense_category_id);
      return {
        Fecha: format(parseISO(tx.date), "dd/MM/yyyy", { locale: es }),
        Tipo: tx.type === "charge" ? "Cargo" : "Pago",
        Categoria: category?.name || "N/A",
        Descripcion: tx.description,
        Monto: `${tx.type === "charge" ? "-" : "+"}${tx.amount.toFixed(2)}`,
        Cuotas: tx.installments_count && tx.installment_number && tx.installments_count > 1
          ? `${tx.installment_number}/${tx.installments_count}`
          : "Pago único",
      };
    });

    const filename = `estado_cuenta_${card.name.replace(/\s/g, '_')}_${format(new Date(), "yyyyMMdd_HHmmss")}`;
    const title = `Estado de Cuenta: ${card.name} (${card.bank_name})`;
    const headers = ["Fecha", "Tipo", "Categoría", "Descripción", "Monto", "Cuotas"];
    const pdfData = dataToExport.map(row => Object.values(row));

    if (formatType === 'csv') {
      exportToCsv(`${filename}.csv`, dataToExport);
      showSuccess("Estado de cuenta exportado a CSV.");
    } else {
      exportToPdf(`${filename}.pdf`, title, headers, pdfData);
      showSuccess("Estado de cuenta exportado a PDF.");
    }
  };

  if (isLoading || isLoadingCategories) {
    return <LoadingSpinner />;
  }

  if (!card || !cardCalculatedData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
        <h2 className="text-2xl font-bold mb-4">Tarjeta no encontrada</h2>
        <Button onClick={() => navigate('/cards')}>Volver a Mis Tarjetas</Button>
      </div>
    );
  }

  const isCredit = card.type === "credit";
  const { creditAvailable, creditUsed, currentCycleDebt, pendingPaymentDebt } = cardCalculatedData;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cards')}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-3xl font-bold">Detalles de la Tarjeta: {card.name}</h1>
      </div>

      {/* Overdue Payment Notification */}
      {isOverdue && (
        <Card className="border-l-4 border-red-600 bg-red-50 text-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">¡ATENCIÓN!</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">Tienes adeudos con la entidad financiera.</div>
            <p className="text-xs text-red-700 mt-1">
              El pago para el ciclo anterior de tu tarjeta {card.name} está vencido.
              Tu saldo actual es de ${card.current_balance.toFixed(2)}.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tarjetas de notificación */}
      {isCredit && (
        <div className="grid gap-4 md:grid-cols-2">
          <PaymentDueDateCard card={card} />
          <CutOffDateCard card={card} />
        </div>
      )}

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
                  Crédito Utilizado: ${creditUsed.toFixed(2)}
                </p>
                <p className="text-sm opacity-80 mt-1">
                  Deuda del Ciclo Actual: ${currentCycleDebt.toFixed(2)}
                </p>
                <p className="text-sm opacity-80 mt-1">
                  Deuda Pendiente de Pago: ${pendingPaymentDebt.toFixed(2)}
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
                  {/* Conditionally render category selector based on transaction type and card type */}
                  {(newTransaction.type === "charge" || (newTransaction.type === "payment" && card.type === "debit")) && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="category_id" className="text-right">
                        Categoría
                      </Label>
                      <Select value={newTransaction.selectedCategoryId} onValueChange={handleCategorySelectChange}>
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Selecciona categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {newTransaction.type === "charge" ? (
                            expenseCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                <div className="flex items-center gap-2">
                                  <DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-4 w-4" />
                                  {cat.name}
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            incomeCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                <div className="flex items-center gap-2">
                                  <DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-4 w-4" />
                                  {cat.name}
                                </div>
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
            <Select value={filterCategory} onValueChange={(value: string) => setFilterCategory(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Categorías</SelectItem>
                {/* Show all categories for filtering */}
                {[...incomeCategories, ...expenseCategories].map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-4 w-4" />
                      {cat.name} ({cat.is_fixed ? "Fija" : "Personal"})
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "col-span-3 justify-start text-left font-normal",
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
                    <TableHead className="w-12"></TableHead> {/* Nueva columna para el icono, más ancha */}
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => {
                    const isPaymentToCreditCard = card.type === "credit" && transaction.type === "payment";
                    const category = getCategoryById(transaction.income_category_id || transaction.expense_category_id);

                    let deleteDescription = `Esta acción no se puede deshacer. Esto eliminará permanentemente la transacción de ${transaction.type === "charge" ? "cargo" : "pago"} por $${transaction.amount.toFixed(2)}: "${transaction.description}".`;

                    if (card.type === "credit") {
                      if (transaction.type === "payment") {
                        deleteDescription = `Esta acción no se puede deshacer. Esto eliminará permanentemente el pago de $${transaction.amount.toFixed(2)}: "${transaction.description}" y aumentará la deuda de tu tarjeta de crédito.`;
                      } else { // charge on credit card
                        deleteDescription = `Esta acción no se puede deshacer. Esto eliminará permanentemente el cargo de $${transaction.amount.toFixed(2)}: "${transaction.description}" y reducirá la deuda de tu tarjeta de crédito.`;
                      }
                    } else { // debit card
                      if (transaction.type === "payment") {
                        deleteDescription = `Esta acción no se puede deshacer. Esto eliminará permanentemente el ingreso de $${transaction.amount.toFixed(2)}: "${transaction.description}" y reducirá el saldo de tu tarjeta de débito.`;
                      } else { // charge on debit card
                        deleteDescription = `Esta acción no se puede deshacer. Esto eliminará permanentemente el egreso de $${transaction.amount.toFixed(2)}: "${transaction.description}" y aumentará el saldo de tu tarjeta de débito.`;
                      }
                    }

                    return (
                      <TableRow 
                        key={transaction.id}
                        className={cn(isPaymentToCreditCard && "bg-pink-50 text-pink-800")}
                      >
                        <TableCell className="w-12 flex items-center justify-center"> {/* Celda para el icono */}
                          {isPaymentToCreditCard && (
                            <img
                              src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Love%20Cochinito%20Card.png"
                              alt="Cochinito Love"
                              className="h-20 w-20"
                              onError={(e) => {
                                console.error("Error al cargar la imagen del cochinito:", e.currentTarget.src);
                                e.currentTarget.style.display = 'none'; // Ocultar la imagen si falla
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell>{format(parseISO(transaction.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                        <TableCell className={cn(
                          transaction.type === "charge" ? "text-red-600" : "text-green-600",
                          isPaymentToCreditCard && "text-pink-800 font-medium"
                        )}>
                          {transaction.type === "charge" ? "Cargo" : "Pago"}
                          {transaction.installments_count && transaction.installment_number && transaction.installments_count > 1 &&
                            ` (${transaction.installment_number}/${transaction.installments_count})`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <DynamicLucideIcon iconName={category?.icon || "Tag"} className="h-4 w-4" />
                            {category?.name || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell className="text-right">${transaction.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditTransactionDialog(transaction)}
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
                                  {deleteDescription}
                                  {transaction.installments_count && transaction.installments_count > 1 && (
                                    <p className="mt-2 text-sm text-red-500">
                                      Nota: Esta es una cuota de una transacción a meses. Eliminarla eliminará TODAS las cuotas de esta compra y ajustará el saldo de la tarjeta.
                                    </p>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteCardTransaction(transaction)}>
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
                {/* Conditionally render category selector for edit dialog */}
                {(newTransaction.type === "charge" || (newTransaction.type === "payment" && card.type === "debit")) && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="editCategory" className="text-right">
                      Categoría
                    </Label>
                    <Select value={newTransaction.selectedCategoryId} onValueChange={handleCategorySelectChange}>
                      <SelectTrigger id="editCategory" className="col-span-3">
                        <SelectValue placeholder="Selecciona categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {newTransaction.type === "charge" ? (
                          expenseCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-4 w-4" />
                                {cat.name}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          incomeCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-4 w-4" />
                                {cat.name}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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