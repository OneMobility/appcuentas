"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Home, Users, DollarSign, CreditCard, AlertTriangle, Meh, RefreshCw, PiggyBank } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategoryContext } from "@/context/CategoryContext";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { format, isBefore, isSameDay, addDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { getUpcomingPaymentDueDate } from "@/utils/date-helpers";
import { Button } from "@/components/ui/button";
import GroupedPaymentDueDatesCard from "@/components/GroupedPaymentDueDatesCard";
import { cn } from "@/lib/utils";
import CreditCardsChart from "@/components/CreditCardsChart"; // Re-incluido

// Tasas de cambio de ejemplo (MXN como base)
const exchangeRates: { [key: string]: number } = {
  MXN: 1,    // Peso Mexicano
  USD: 19.0, // Dólar Estadounidense
  EUR: 20.5, // Euro
  COP: 0.0045, // Peso Colombiano
  BOB: 2.7,  // Boliviano Boliviano
};

interface CardTransaction {
  id: string;
  type: "charge" | "payment"; // Monto mensual si es a meses, o monto total si es pago único
  amount: number;
  description: string;
  date: string;
  card_id?: string;
  user_id?: string;
  installments_total_amount?: number;
  installments_count?: number;
  installment_number?: number;
  income_category_id?: string | null; // New
  expense_category_id?: string | null; // New
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

interface CashTransaction {
  id: string;
  type: "ingreso" | "egreso";
  amount: number;
  description: string;
  date: string;
  income_category_id?: string | null; // New
  expense_category_id?: string | null; // New
  user_id?: string;
}

interface DebtorData {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  user_id?: string;
}

interface CreditorData {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  user_id?: string;
}

interface MonthlySummary {
  name: string; // Month name
  ingresos: number;
  egresos: number;
}

const UNCATEGORIZED_ID = "uncategorized";
const UNCATEGORIZED_NAME = "Sin Categoría";
const UNCATEGORIZED_COLOR = "#CCCCCC"; // Un color neutral
const UNCATEGORIZED_ICON = "Tag"; // Icono por defecto

const Dashboard = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, getCategoryById, isLoadingCategories } = useCategoryContext();
  const [amountToConvert, setAmountToConvert] = useState<string>("");
  const [fromCurrency, setFromCurrency] = useState<string>("USD");
  const [toCurrency, setToCurrency] = useState<string>("MXN");

  const [cards, setCards] = useState<CardData[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [debtors, setDebtors] = useState<DebtorData[]>([]);
  const [creditors, setCreditors] = useState<CreditorData[]>([]);
  const [refreshKey, setRefreshKey] = useState(0); // Nuevo estado para forzar el refresco

  const fetchDashboardData = async () => {
    if (!user) {
      setCards([]);
      setCashTransactions([]);
      setDebtors([]);
      setCreditors([]);
      return;
    }

    try {
      // Fetch Cards with their transactions
      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select('*, card_transactions(*)')
        .eq('user_id', user.id);
      if (cardsError) throw cardsError;
      setCards(cardsData || []);
      console.log("Dyad Debug: Fetched cards data:", cardsData);

      // Fetch Cash Transactions
      const { data: cashTxData, error: cashTxError } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('user_id', user.id);
      if (cashTxError) throw cashTxError;
      setCashTransactions(cashTxData || []);
      console.log("Dyad Debug: Fetched cash transactions data:", cashTxData);

      // Fetch Debtors
      const { data: debtorsData, error: debtorsError } = await supabase
        .from('debtors')
        .select('*')
        .eq('user_id', user.id);
      if (debtorsError) throw debtorsError;
      setDebtors(debtorsData || []);
      console.log("Dyad Debug: Fetched debtors data:", debtorsData);

      // Fetch Creditors
      const { data: creditorsData, error: creditorError } = await supabase
        .from('creditors')
        .select('*')
        .eq('user_id', user.id);
      
      if (creditorError) {
        throw creditorError;
      }
      setCreditors(creditorsData || []); // Ensure it's always an array
      console.log("Dyad Debug: Fetched creditors data:", creditorsData);
    } catch (error: any) {
      console.error("Error al cargar datos del dashboard:", error); // Log the full error object
      showError('Error al cargar datos del dashboard: ' + (error?.message || 'Error desconocido'));
    }
  };

  useEffect(() => {
    if (user && !isLoadingCategories) {
      fetchDashboardData();
    }
  }, [user, isLoadingCategories, refreshKey]); // Añadir refreshKey a las dependencias

  const handleRefreshData = () => {
    setRefreshKey(prevKey => prevKey + 1); // Incrementar para forzar el re-fetch
    showSuccess("Datos del dashboard actualizados.");
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!isNaN(Number(value)) || value === "") {
      setAmountToConvert(value);
    }
  };

  const convertedAmount = useMemo(() => {
    const amount = parseFloat(amountToConvert);
    if (isNaN(amount) || !exchangeRates[fromCurrency] || !exchangeRates[toCurrency]) {
      return "0.00";
    }
    const amountInBase = amount * exchangeRates[fromCurrency];
    return (amountInBase / exchangeRates[toCurrency]).toFixed(2);
  }, [amountToConvert, fromCurrency, toCurrency]);

  const currencies = [
    { value: "MXN", label: "Peso Mexicano (MXN)" },
    { value: "USD", label: "Dólar Estadounidense (USD)" },
    { value: "EUR", label: "Euro (EUR)" },
    { value: "COP", label: "Peso Colombiano (COP)" },
    { value: "BOB", label: "Boliviano Boliviano (BOB)" },
  ];

  const totalCashBalance = useMemo(() => {
    return cashTransactions.reduce((sum, tx) => {
      return tx.type === "ingreso" ? sum + tx.amount : sum - tx.amount;
    }, 0);
  }, [cashTransactions]);

  const totalDebtorsBalance = useMemo(() => {
    return debtors.reduce((sum, debtor) => sum + debtor.current_balance, 0);
  }, [debtors]);

  const totalCreditorsBalance = useMemo(() => {
    return creditors.reduce((sum, creditor) => sum + creditor.current_balance, 0);
  }, [creditors]);

  // Nuevo cálculo para el saldo total de tarjetas de débito
  const totalDebitCardsBalance = useMemo(() => {
    return cards.filter(card => card.type === "debit").reduce((sum, card) => sum + card.current_balance, 0);
  }, [cards]);

  // Nuevo cálculo para la deuda total de tarjetas de crédito
  const totalCreditCardDebt = useMemo(() => {
    return cards.filter(card => card.type === "credit").reduce((sum, card) => sum + card.current_balance, 0);
  }, [cards]);

  // Nuevo cálculo para el balance total
  const totalOverallBalance = useMemo(() => {
    return totalCashBalance + totalDebtorsBalance + totalDebitCardsBalance - totalCreditorsBalance - totalCreditCardDebt;
  }, [totalCashBalance, totalDebtorsBalance, totalDebitCardsBalance, totalCreditorsBalance, totalCreditCardDebt]);


  // Data for Income Pie Chart (Cash + Debit Card Income)
  const totalIncomePieChartData = useMemo(() => {
    const dataMap = new Map<string, { id: string; name: string; value: number; color: string; icon: string }>();

    // Initialize with all known income categories
    incomeCategories.forEach(cat => dataMap.set(cat.id, { id: cat.id, name: cat.name, value: 0, color: cat.color, icon: cat.icon || "Tag" }));
    // Ensure "Sin Categoría" is always present
    dataMap.set(UNCATEGORIZED_ID, { id: UNCATEGORIZED_ID, name: UNCATEGORIZED_NAME, value: 0, color: UNCATEGORIZED_COLOR, icon: UNCATEGORIZED_ICON });

    const aggregateIncome = (tx: CashTransaction | CardTransaction) => {
      const categoryId = tx.income_category_id;
      if (categoryId) {
        const category = incomeCategories.find(cat => cat.id === categoryId);
        if (category) {
          const current = dataMap.get(category.id)!;
          dataMap.set(category.id, { ...current, value: current.value + tx.amount });
        } else {
          // Category ID exists but category object not found in incomeCategories
          const current = dataMap.get(UNCATEGORIZED_ID)!;
          dataMap.set(UNCATEGORIZED_ID, { ...current, value: current.value + tx.amount });
        }
      } else {
        // No category ID assigned
        const current = dataMap.get(UNCATEGORIZED_ID)!;
        dataMap.set(UNCATEGORIZED_ID, { ...current, value: current.value + tx.amount });
      }
    };

    // Aggregate cash income
    cashTransactions.filter(tx => tx.type === "ingreso").forEach(aggregateIncome);

    // Aggregate debit card income (payments to debit cards)
    cards.filter(card => card.type === "debit").forEach(card => {
      (card.transactions || []).filter(tx => tx.type === "payment").forEach(aggregateIncome);
    });

    const result = Array.from(dataMap.values()).filter(entry => entry.value > 0);
    console.log("Dyad Debug: Total Income Pie Chart Data:", result);
    return result;
  }, [cashTransactions, cards, incomeCategories]);

  // Data for Expense Pie Chart (Cash + Debit Card Expenses)
  const totalExpensePieChartData = useMemo(() => {
    const dataMap = new Map<string, { id: string; name: string; value: number; color: string; icon: string }>();

    // Always initialize "Sin Categoría" first
    dataMap.set(UNCATEGORIZED_ID, { id: UNCATEGORIZED_ID, name: UNCATEGORIZED_NAME, value: 0, color: UNCATEGORIZED_COLOR, icon: UNCATEGORIZED_ICON });

    // Then add all known expense categories
    expenseCategories.forEach(cat => dataMap.set(cat.id, { id: cat.id, name: cat.name, value: 0, color: cat.color, icon: cat.icon || "Tag" }));

    const aggregateExpense = (tx: CashTransaction | CardTransaction) => {
      const categoryId = tx.expense_category_id;
      if (categoryId) {
        const category = expenseCategories.find(cat => cat.id === categoryId);
        if (category) {
          const current = dataMap.get(category.id)!;
          dataMap.set(category.id, { ...current, value: current.value + tx.amount });
        } else {
          // Category ID exists but category object not found in expenseCategories
          const current = dataMap.get(UNCATEGORIZED_ID)!;
          dataMap.set(UNCATEGORIZED_ID, { ...current, value: current.value + tx.amount });
        }
      } else {
        // No category ID assigned
        const current = dataMap.get(UNCATEGORIZED_ID)!;
        dataMap.set(UNCATEGORIZED_ID, { ...current, value: current.value + tx.amount });
      }
    };

    // Aggregate cash expenses
    cashTransactions.filter(tx => tx.type === "egreso").forEach(aggregateExpense);

    // Aggregate debit card expenses (charges on debit cards)
    cards.filter(card => card.type === "debit").forEach(card => {
      (card.transactions || []).filter(tx => tx.type === "charge").forEach(aggregateExpense);
    });

    return Array.from(dataMap.values()).filter(entry => entry.value > 0);
  }, [cashTransactions, cards, expenseCategories]);

  // Data for Credit Card Expenses Pie Chart
  const creditCardExpensePieChartData = useMemo(() => {
    const dataMap = new Map<string, { id: string; name: string; value: number; color: string; icon: string }>();

    // Initialize with all known expense categories
    expenseCategories.forEach(cat => dataMap.set(cat.id, { id: cat.id, name: cat.name, value: 0, color: cat.color, icon: cat.icon || "Tag" }));
    // Ensure "Sin Categoría" is always present
    dataMap.set(UNCATEGORIZED_ID, { id: UNCATEGORIZED_ID, name: UNCATEGORIZED_NAME, value: 0, color: UNCATEGORIZED_COLOR, icon: UNCATEGORIZED_ICON });

    const aggregateCreditExpense = (tx: CardTransaction) => {
      const categoryId = tx.expense_category_id;
      if (categoryId && dataMap.has(categoryId)) {
        const current = dataMap.get(categoryId)!;
        dataMap.set(categoryId, { ...current, value: current.value + tx.amount });
      } else {
        const current = dataMap.get(UNCATEGORIZED_ID)!;
        dataMap.set(UNCATEGORIZED_ID, { ...current, value: current.value + tx.amount });
      }
    };

    // Aggregate credit card expenses (charges on credit cards)
    cards.filter(card => card.type === "credit").forEach(card => {
      (card.transactions || []).filter(tx => tx.type === "charge").forEach(aggregateCreditExpense);
    });

    return Array.from(dataMap.values()).filter(entry => entry.value > 0);
  }, [cards, expenseCategories]);


  const monthlySummaryData = useMemo(() => {
    const summaryMap = new Map<string, MonthlySummary>(); // Key: YYYY-MM

    cashTransactions.forEach(tx => {
      const monthKey = format(parseISO(tx.date), "yyyy-MM");
      const monthName = format(parseISO(tx.date), "MMMM", { locale: es });

      if (!summaryMap.has(monthKey)) {
        summaryMap.set(monthKey, { name: monthName, ingresos: 0, egresos: 0 });
      }
      const currentSummary = summaryMap.get(monthKey)!;
      if (tx.type === "ingreso") {
        currentSummary.ingresos += tx.amount;
      } else {
        currentSummary.egresos += tx.amount;
      }
    });

    // Sort by month key to ensure correct order
    return Array.from(summaryMap.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([, value]) => value);
  }, [cashTransactions]);

  const cardSummaryData = useMemo(() => {
    return cards
      .filter(card => card.type === "credit") // Filter for credit cards only
      .map(card => {
      const isCredit = card.type === "credit";
      const creditAvailable = isCredit && card.credit_limit !== undefined ? card.credit_limit - card.current_balance : 0;
      const upcomingPaymentDueDate = isCredit && card.cut_off_day !== undefined && card.days_to_pay_after_cut_off !== undefined
        ? getUpcomingPaymentDueDate(card.cut_off_day, card.days_to_pay_after_cut_off)
        : null;

      const totalSpent = (card.transactions || [])
        .filter(tx => tx.type === "charge")
        .reduce((sum, tx) => sum + (tx.amount), 0); // Simplified, assuming no installments here

      return {
        ...card,
        isCredit,
        creditAvailable,
        upcomingPaymentDueDate,
        totalSpent,
      };
    });
  }, [cards]);

  const cardStatusChartData = useMemo(() => {
    return cards.map(card => ({
      name: card.name,
      LimiteOInicial: card.type === "credit" ? card.credit_limit : card.initial_balance,
      SaldoActualODeuda: card.current_balance,
    }));
  }, [cards]);

  // NEW: Credit Card Available vs. Used Balance Chart
  const creditCardBalanceChartData = useMemo(() => {
    return cards
      .filter(card => card.type === "credit" && card.credit_limit !== undefined)
      .map(card => ({
        name: card.name,
        "Crédito Disponible": card.credit_limit! - card.current_balance,
        "Crédito Usado": card.current_balance,
        "Límite de Crédito": card.credit_limit!,
      }));
  }, [cards]);

  const cardHealthStatus = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoDaysFromNow = addDays(today, 2);

    let hasCriticalIssue = false;
    let hasWarningIssue = false;
    const criticalCards: string[] = [];
    const warningCards: string[] = [];

    for (const card of cards) {
      const isCredit = card.type === "credit";

      if (isCredit) {
        // Check if current balance is at or exceeds credit limit
        if (card.credit_limit !== undefined && card.current_balance >= card.credit_limit) {
          hasCriticalIssue = true;
          criticalCards.push(`${card.name} (límite alcanzado o excedido)`);
        }

        // Check for overdue payments
        if (card.cut_off_day !== undefined && card.days_to_pay_after_cut_off !== undefined) {
          const paymentDueDate = getUpcomingPaymentDueDate(card.cut_off_day, card.days_to_pay_after_cut_off, today);
          if (isBefore(paymentDueDate, today) && !isSameDay(paymentDueDate, today)) {
            hasCriticalIssue = true;
            criticalCards.push(`${card.name} (pago vencido el ${format(paymentDueDate, "dd/MM/yyyy", { locale: es })})`);
          } else if ((isBefore(paymentDueDate, twoDaysFromNow) || isSameDay(paymentDueDate, twoDaysFromNow)) && !isSameDay(paymentDueDate, today)) {
            // Upcoming payment within 2 days, but not today and not overdue
            hasWarningIssue = true;
            warningCards.push(`${card.name} (pago próximo el ${format(paymentDueDate, "dd/MM/yyyy", { locale: es })})`);
          }
        }
      } else { // Debit card
        // Check if debit card balance is negative
        if (card.current_balance < 0) {
          hasCriticalIssue = true;
          criticalCards.push(`${card.name} (saldo negativo)`);
        }
      }
    }

    if (hasCriticalIssue) {
      return { status: "critical", cards: criticalCards };
    } else if (hasWarningIssue) {
      return { status: "warning", cards: warningCards };
    } else {
      return { status: "all_good", cards: [] };
    }
  }, [cards]);

  const piggyBankImageSrc = cardHealthStatus.status === "critical"
    ? "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Fuego.png"
    : "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Conchinito%20feliz.png";

  const userFirstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'Usuario';

  // Calculate totals for the footer row
  const totalCreditLimit = useMemo(() => {
    return cardSummaryData.reduce((sum, card) => sum + (card.credit_limit || 0), 0);
  }, [cardSummaryData]);

  const totalCreditDebtSummary = useMemo(() => {
    return cardSummaryData.reduce((sum, card) => sum + card.current_balance, 0);
  }, [cardSummaryData]);

  const totalCreditAvailableSummary = useMemo(() => {
    return cardSummaryData.reduce((sum, card) => sum + card.creditAvailable, 0);
  }, [cardSummaryData]);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Hola, {userFirstName}</h1>
        <Button variant="outline" size="sm" onClick={handleRefreshData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar Datos
        </Button>
      </div>

      {cardHealthStatus.status === "critical" ? (
        <Card className="border-blue-600 bg-blue-50 text-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Estado de Tarjetas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pr-4 md:block md:pr-48">
            <img 
              src={piggyBankImageSrc} 
              alt="Conchinito en problemas" 
              className="h-[180px] w-[180px] mb-4 mx-auto md:absolute md:top-[54px] md:right-[4px] md:z-10"
            />
            <div className="text-lg font-bold text-center md:text-left">Oye, pon atención en tus saldos</div>
            <p className="text-xs text-blue-700 mt-1 text-center md:text-left">
              Hay problemas críticos con las siguientes tarjetas:
              <ul className="list-disc pl-5 mt-1">
                {cardHealthStatus.cards.map((msg, index) => (
                  <li key={index}>{msg}</li>
                ))}
              </ul>
            </p>
          </CardContent>
        </Card>
      ) : cardHealthStatus.status === "warning" ? (
        <Card className="border-orange-600 bg-orange-50 text-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Estado de Tarjetas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pr-4 md:block md:pr-48">
            <img 
              src={piggyBankImageSrc} 
              alt="Conchinito en advertencia" 
              className="h-[180px] w-[180px] mb-4 mx-auto md:absolute md:top-[54px] md:right-[4px] md:z-10"
            />
            <div className="text-lg font-bold text-center md:text-left">Atención: Algo no cuadra</div>
            <p className="text-xs text-orange-700 mt-1 text-center md:text-left">
              Revisa tus tarjetas, hay eventos próximos:
              <ul className="list-disc pl-5 mt-1">
                {cardHealthStatus.cards.map((msg, index) => (
                  <li key={index}>{msg}</li>
                ))}
              </ul>
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-600 bg-green-50 text-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Estado de Tarjetas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pr-4 md:block md:pr-48">
            <img 
              src={piggyBankImageSrc} 
              alt="Conchinito feliz" 
              className="h-[180px] w-[180px] mb-4 mx-auto md:absolute md:top-[54px] md:right-[4px] md:z-10"
            />
            <div className="text-lg font-bold text-center md:text-left">¡Todo está en orden aquí!</div>
            <p className="text-xs text-green-700 mt-1 text-center md:text-left">Tus tarjetas están al día y dentro de los límites.</p>
          </CardContent>
        </Card>
      )}

      {/* Tarjeta agrupada de cuenta regresiva para fechas de pago */}
      <GroupedPaymentDueDatesCard cards={cards} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Tarjetas Verdes */}
        <Card className={cn("border-l-4 border-green-600 bg-green-50 text-green-800")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">TU DINERITO</CardTitle>
            <Home className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCashBalance.toFixed(2)}</div>
            <p className="text-xs text-green-700">+20.1% desde el mes pasado</p> {/* Placeholder */}
          </CardContent>
        </Card>
        <Card className={cn("border-l-4 border-green-600 bg-green-50 text-green-800")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">QUIEN TE DEBE</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalDebtorsBalance.toFixed(2)}</div>
            <p className="text-xs text-green-700">-5.2% desde el mes pasado</p> {/* Placeholder */}
          </CardContent>
        </Card>
        <Card className={cn("border-l-4 border-green-600 bg-green-50 text-green-800")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">SALDO TARJETAS DÉBITO</CardTitle>
            <CreditCard className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalDebitCardsBalance.toFixed(2)}</div>
            <p className="text-xs text-green-700">Saldo total en tus tarjetas de débito.</p>
          </CardContent>
        </Card>

        {/* Tarjetas Amarillas */}
        <Card className={cn("border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">A QUIEN LE DEBES</CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCreditorsBalance.toFixed(2)}</div>
            <p className="text-xs text-yellow-700">+10.5% desde el mes pasado</p> {/* Placeholder */}
          </CardContent>
        </Card>
        <Card className={cn("border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">DEUDA TARJETAS CRÉDITO</CardTitle>
            <CreditCard className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCreditCardDebt.toFixed(2)}</div>
            <p className="text-xs text-yellow-700">Deuda total en tus tarjetas de crédito.</p>
          </CardContent>
        </Card>

        {/* Tarjeta Rosa */}
        <Card className={cn("border-l-4 border-pink-500 bg-pink-50 text-pink-800")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-pink-800">BALANCE TOTAL</CardTitle>
            <PiggyBank className="h-4 w-4 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalOverallBalance.toFixed(2)}</div>
            <p className="text-xs text-pink-700">Efectivo + Deudores + Débito - Acreedores - Crédito.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversor de Divisas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="amount-input">Monto</Label>
              <Input
                id="amount-input"
                type="number"
                step="0.01"
                value={amountToConvert}
                onChange={handleAmountChange}
                placeholder="0.00"
              />
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="from-currency">De</Label>
              <Select value={fromCurrency} onValueChange={setFromCurrency}>
                <SelectTrigger id="from-currency">
                  <SelectValue placeholder="Selecciona divisa" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="to-currency">A</Label>
              <Select value={toCurrency} onValueChange={setToCurrency}>
                <SelectTrigger id="to-currency">
                  <SelectValue placeholder="Selecciona divisa" />
                    </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label>Resultado</Label>
              <div className="text-lg font-bold">
                {convertedAmount} {toCurrency}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen de Créditos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarjeta</TableHead>
                  <TableHead>Límite</TableHead>
                  <TableHead>Deuda</TableHead>
                  <TableHead>Crédito Disponible</TableHead>
                  <TableHead>Próx. Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cardSummaryData.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full" style={{ backgroundColor: card.color }} />
                        <span>{card.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>${card.credit_limit?.toFixed(2) || "N/A"}</TableCell>
                    <TableCell>${card.current_balance.toFixed(2)}</TableCell>
                    <TableCell className={card.creditAvailable < 0 ? "text-red-600" : ""}>
                      ${card.creditAvailable.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {card.upcomingPaymentDueDate
                        ? format(card.upcomingPaymentDueDate, "dd/MM/yyyy", { locale: es })
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="text-right font-bold">Totales</TableCell>
                  <TableCell className="font-bold">${totalCreditLimit.toFixed(2)}</TableCell>
                  <TableCell className="font-bold">${totalCreditDebtSummary.toFixed(2)}</TableCell>
                  <TableCell className={cn("font-bold", totalCreditAvailableSummary < 0 && "text-red-600")}>
                    ${totalCreditAvailableSummary.toFixed(2)}
                  </TableCell>
                  <TableCell></TableCell> {/* Empty cell for "Próx. Pago" */}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gráfico de Créditos</CardTitle>
        </CardHeader>
        <CardContent>
          <CreditCardsChart cards={cards} />
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;