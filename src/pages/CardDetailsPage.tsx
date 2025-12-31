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
import { DollarSign, History, Trash2, Edit, CalendarIcon, ArrowLeft, FileText, FileDown, Heart, AlertTriangle, Scale } from "lucide-react"; // Added Scale icon
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, isWithinInterval, isBefore, isAfter, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import ColorPicker from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getUpcomingPaymentDueDate, getRelevantStatementForPayment, getCurrentActiveBillingCycle } from "@/utils/date-helpers";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import LoadingSpinner from "@/components/LoadingSpinner";
import PaymentDueDateCard from "@/components/PaymentDueDateCard";
import CutOffDateCard from "@/components/CutOffDateCard";
import { useCategoryContext } from "@/context/CategoryContext";
import { toast } from "sonner";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { evaluateExpression } from "@/utils/math-helpers"; // Importar la nueva función
import CardReconciliationDialog from "@/components/CardReconciliationDialog"; // Import the new component

interface CardTransaction {
  id: string;
  type: "charge" | "payment";
  amount: number;
  description: string;
  date: string;
  created_at: string; // Add created_at
  card_id?: string;
  user_id?: string;
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
  const [isReconciliationDialogOpen, setIsReconciliationDialogOpen] = useState(false); // New state for reconciliation dialog
  const [editingTransaction, setEditingTransaction] = useState<CardTransaction | null>(null);
  const [newTransaction, setNewTransaction] = useState({
    type: "charge" as "charge" | "payment",
    amount: "",
    description: "",
    date: undefined as Date | undefined,
    selectedCategoryId: "",
    selectedCategoryType: "" as "income" | "expense" | "",
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "charge" | "payment">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isOverdue, setIsOverdue] = useState(false);

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

  useEffect(() => {
    fetchCardDetails();
  }, [cardId, user, navigate, isLoadingCategories]);

  // Effect to calculate if payment is overdue
  useEffect(() => {
    if (card && card.type === "credit" && card.cut_off_day !== undefined && card.days_to_pay_after_cut_off !== undefined) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { statementStartDate, statementEndDate, statementPaymentDueDate } = getRelevantStatementForPayment(
        card.cut_off_day,
        card.days_to_pay_after_cut_off,
        today
      );

      const statementCharges = (card.transactions || [])
        .filter(tx => tx.type === "charge")
        .filter(tx => {
          const txDateParsed = parseISO(tx.date);
          return isWithinInterval(txDateParsed, { start: statementStartDate, end: statementEndDate });
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      const paymentsForDueCycle = (card.transactions || [])
        .filter(tx => tx.type === "payment")
        .filter(tx => {
          const txDate = parseISO(tx.date);
          return isWithinInterval(txDate, { start: statementStartDate, end: statementPaymentDueDate });
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      const netStatementBalance = statementCharges - paymentsForDueCycle;

      if (isAfter(today, statementPaymentDueDate) && netStatementBalance > 0) {
        setIsOverdue(true);
      } else {
        setIsOverdue(false);
      }
    } else {
      setIsOverdue(false);
    }
  }, [card]);

  const handleTransactionInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewTransaction((prev) => ({ ...prev, [name]: value }));
  };

  const handleTransactionTypeChange = (value: "charge" | "payment") => {
    setNewTransaction((prev) => ({ ...prev, type: value, selectedCategoryId: "", selectedCategoryType: "" }));
  };

  const handleTransactionDateChange = (date: Date | undefined) => {
    setNewTransaction((prev) => ({ ...prev, date: date }));
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

    let totalAmount: number;
    if (newTransaction.amount.startsWith('=')) {
      const expression = newTransaction.amount.substring(1);
      const result = evaluateExpression(expression);
      if (result !== null) {
        totalAmount = parseFloat(result.toFixed(2));
      } else {
        showError("Expresión matemática inválida para el monto.");
        return;
      }
    } else {
      totalAmount = parseFloat(newTransaction.amount);
    }

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
    const transactionsToInsert: Omit<CardTransaction, 'id' | 'created_at'>[] = [];

    if (card.type === "debit") {
      if (newTransaction.type === "charge") {
        if (newCardBalance < totalAmount) {
          showError("Saldo insuficiente en la tarjeta de débito.");
          return;
        }
        newCardBalance -= totalAmount;
      } else {
        newCardBalance += totalAmount;
      }
    } else { // Credit card
      if (newTransaction.type === "charge") {
        newCardBalance += totalAmount; // Charges increase debt
        if (card.credit_limit !== undefined && newCardBalance > card.credit_limit) {
          toast.info(`Tu tarjeta de crédito ha excedido su límite. Saldo actual: $${newCardBalance.toFixed(2)}`, {
            style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
            duration: 10000
          });
        }
      } else {
        // Payments decrease debt
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
      income_category_id: incomeCategoryIdToInsert,
      expense_category_id: expenseCategoryIdToInsert,
    });

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
      setNewTransaction({ type: "charge", amount: "", description: "", date: undefined, selectedCategoryId: "", selectedCategoryType: "" });
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
      amount: transaction.amount.toString(),
      description: transaction.description,
      date: new Date(transaction.date),
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
    
    let newTotalAmount: number;
    if (newTransaction.amount.startsWith('=')) {
      const expression = newTransaction.amount.substring(1);
      const result = evaluateExpression(expression);
      if (result !== null) {
        newTotalAmount = parseFloat(result.toFixed(2));
      } else {
        showError("Expresión matemática inválida para el monto.");
        return;
      }
    } else {
      newTotalAmount = parseFloat(newTransaction.amount);
    }

    const newType = newTransaction.type;

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

    // Revert old transaction's impact on balance
    newCardBalance = oldTransaction.type === "charge" ? newCardBalance - oldTransaction.amount : newCardBalance + oldTransaction.amount;

    // Delete old transaction
    const { error: deleteOldTransactionError } = await supabase
      .from('card_transactions')
      .delete()
      .eq('id', oldTransaction.id)
      .eq('user_id', user.id);
    if (deleteOldTransactionError) throw deleteOldTransactionError;

    // Apply new transaction's impact on balance
    if (card.type === "debit") {
      if (newType === "charge") {
        if (newCardBalance < newTotalAmount) {
          showError("Saldo insuficiente en la tarjeta de débito.");
          return;
        }
        newCardBalance -= newTotalAmount;
      } else {
        newCardBalance += newTotalAmount;
      }
    } else { // Credit card
      if (newType === "charge") {
        newCardBalance += newTotalAmount; // Charges increase debt
        if (card.credit_limit !== undefined && newCardBalance > card.credit_limit) {
          toast.info(`¡Atención! El saldo actual de tu tarjeta ${card.name} excede su límite de crédito.`, {
            style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
            duration: 10000
          });
        }
      } else {
        // Payments decrease debt
        newCardBalance -= newTotalAmount;
        if (newCardBalance < 0) {
          toast.info(`Has sobrepagado tu tarjeta ${card.name}. Tu saldo actual es de $${newCardBalance.toFixed(2)} (a tu favor).`, {
            style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
            duration: 10000
          });
        }
      }
    }

    const transactionsToInsert: Omit<CardTransaction, 'id' | 'created_at'>[] = [];
    transactionsToInsert.push({
      user_id: user.id,
      card_id: card.id,
      type: newType,
      amount: newTotalAmount,
      description: newTransaction.description,
      date: format(newTransaction.date, "yyyy-MM-dd"),
      income_category_id: newIncomeCategoryId,
      expense_category_id: newExpenseCategoryId,
    });

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

      setNewTransaction({ type: "charge", amount: "", description: "", date: undefined, selectedCategoryId: "", selectedCategoryType: "" });
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
    const effectiveAmount = transaction.amount;

    newCardBalance = transaction.type === "charge" ? newCardBalance - effectiveAmount : newCardBalance + effectiveAmount;

    try {
      const { error: deleteTransactionError } = await supabase
        .from('card_transactions')
        .delete()
        .eq('id', transaction.id)
        .eq('user_id', user.id);
      if (deleteTransactionError) throw deleteTransactionError;

      const { error: cardError } = await supabase
        .from('cards')
        .update({ current_balance: newCardBalance })
        .eq('id', card.id)
        .eq('user_id', user.id);
      if (cardError) throw cardError;

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

      showSuccess("Transacción eliminada exitosamente.");
    } catch (error: any) {
      showError('Error al eliminar transacción: ' + error.message);
      console.error("Supabase transaction delete error:", error);
    }
  };

  const transactionsWithRunningBalance = useMemo(() => {
    if (!card) return [];

    // Sort transactions by date and then by created_at for consistent balance calculation
    const chronologicalTransactions = [...(card.transactions || [])].sort((a, b) => {
      const dateA = parseISO(a.date).getTime();
      const dateB = parseISO(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    let currentRunningBalance: number;

    if (card.type === "credit") {
      // For credit cards, running balance is (credit_limit - current_debt)
      currentRunningBalance = card.credit_limit !== undefined ? card.credit_limit : 0;
    } else {
      // For debit cards, running balance is the actual balance
      currentRunningBalance = card.initial_balance;
    }

    const transactionsWithBalance = chronologicalTransactions.map(tx => {
      if (card.type === "credit") {
        // For credit cards, charges decrease available credit, payments increase available credit
        currentRunningBalance = tx.type === "charge" ? currentRunningBalance - tx.amount : currentRunningBalance + tx.amount;
      } else {
        // For debit cards, charges decrease balance, payments increase balance
        currentRunningBalance = tx.type === "charge" ? currentRunningBalance - tx.amount : currentRunningBalance + tx.amount;
      }
      return { ...tx, running_balance: currentRunningBalance };
    });

    // Reverse to show most recent first in the UI
    return transactionsWithBalance.reverse();
  }, [card]);

  const filteredTransactions = useMemo(() => {
    return transactionsWithRunningBalance.filter((tx) => {
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      
      const categoryId = tx.income_category_id || tx.expense_category_id;
      const category = getCategoryById(categoryId);
      const categoryName = category?.name || "";
      const matchesCategory = filterCategory === "all" || categoryId === filterCategory || categoryName.toLowerCase().includes(filterCategory.toLowerCase());
      
      const txDate = parseISO(tx.date);
      const matchesDate = !dateRange?.from || (txDate >= dateRange.from && (!dateRange.to || txDate <= dateRange.to));

      return matchesSearch && matchesType && matchesCategory && matchesDate;
    });
  }, [transactionsWithRunningBalance, searchTerm, filterType, filterCategory, dateRange, getCategoryById]);


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
        Saldo: tx.running_balance?.toFixed(2) || "N/A",
      };
    });

    const filename = `estado_cuenta_${card.name.replace(/\s/g, '_')}_${format(new Date(), "yyyyMMdd_HHmmss")}`;
    const title = `Estado de Cuenta: ${card.name} (${card.bank_name})`;
    const headers = ["Fecha", "Tipo", "Categoría", "Descripción", "Monto", "Saldo"];
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
  const creditUsed = isCredit ? card.current_balance : 0;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cards')}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-3xl font-bold">Detalles de la Tarjeta: {card.name}</h1>
      </div>

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
                    type="text" // Cambiado a text para permitir '='
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
            <Button size="sm" className="h-8 gap-1" onClick={() => setIsReconciliationDialogOpen(true)}>
              <Scale className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Cuadre
              </span>
            </Button>
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
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
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
                      } else {
                        deleteDescription = `Esta acción no se puede deshacer. Esto eliminará permanentemente el cargo de $${transaction.amount.toFixed(2)}: "${transaction.description}" y reducirá la deuda de tu tarjeta de crédito.`;
                      }
                    } else {
                      if (transaction.type === "payment") {
                        deleteDescription = `Esta acción no se puede deshacer. Esto eliminará permanentemente el ingreso de $${transaction.amount.toFixed(2)}: "${transaction.description}" y reducirá el saldo de tu tarjeta de débito.`;
                      } else {
                        deleteDescription = `Esta acción no se puede deshacer. Esto eliminará permanentemente el egreso de $${transaction.amount.toFixed(2)}: "${transaction.description}" y aumentará el saldo de tu tarjeta de débito.`;
                      }
                    }

                    return (
                      <TableRow 
                        key={transaction.id}
                        className={cn(isPaymentToCreditCard && "bg-pink-50 text-pink-800")}
                      >
                        <TableCell className="w-12 flex items-center justify-center">
                          {isPaymentToCreditCard && (
                            <img
                              src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Love%20Cochinito%20Card.png"
                              alt="Cochinito Love"
                              className="h-20 w-20"
                              onError={(e) => {
                                console.error("Error al cargar la imagen del cochinito:", e.currentTarget.src);
                                e.currentTarget.style.display = 'none';
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
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <DynamicLucideIcon iconName={category?.icon || "Tag"} className="h-4 w-4" />
                            {category?.name || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell className="text-right">${transaction.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${transaction.running_balance?.toFixed(2) || "N/A"}</TableCell>
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
                    type="text" // Cambiado a text para permitir '='
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
      {card && (
        <CardReconciliationDialog
          isOpen={isReconciliationDialogOpen}
          onClose={() => setIsReconciliationDialogOpen(false)}
          card={card}
          onReconciliationSuccess={fetchCardDetails} // Refresh data after reconciliation
        />
      )}
    </div>
  );
};

export default CardDetailsPage;