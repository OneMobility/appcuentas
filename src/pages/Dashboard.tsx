"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUpcomingPaymentDueDate } from "@/utils/date-helpers";
import { Button } from "@/components/ui/button";
import GroupedPaymentDueDatesCard from "@/components/GroupedPaymentDueDatesCard";
import { cn } from "@/lib/utils";

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

      // Fetch Cash Transactions
      const { data: cashTxData, error: cashTxError } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('user_id', user.id);
      if (cashTxError) throw cashTxError;
      setCashTransactions(cashTxData || []);

      // Fetch Debtors
      const { data: debtorsData, error: debtorsError } = await supabase
        .from('debtors')
        .select('*')
        .eq('user_id', user.id);
      if (debtorsError) throw debtorsError;
      setDebtors(debtorsData || []);

      // Fetch Creditors
      const { data: creditorsData, error: creditorError } = await supabase
        .from('creditors')
        .select('*')
        .eq('user_id', user.id);
      
      if (creditorError) {
        throw creditorError;
      }
      setCreditors(creditorsData || []); // Ensure it's always an array
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


  const incomeCategoryData = useMemo(() => {
    const dataMap = new Map<string, { name: string; value: number; color: string }>();
    incomeCategories.forEach(cat => dataMap.set(cat.id, { name: cat.name, value: 0, color: cat.color }));

    cashTransactions.filter(tx => tx.type === "ingreso").forEach(tx => {
      const categoryId = tx.income_category_id;
      if (categoryId) {
        const current = dataMap.get(categoryId);
        if (current) {
          dataMap.set(categoryId, { ...current, value: current.value + tx.amount });
        }
      }
    });
    return Array.from(dataMap.values()).filter(entry => entry.value > 0);
  }, [cashTransactions, incomeCategories]);

  const expenseCategoryData = useMemo(() => {
    const dataMap = new Map<string, { name: string; value: number; color: string }>();
    expenseCategories.forEach(cat => dataMap.set(cat.id, { name: cat.name, value: 0, color: cat.color }));

    cashTransactions.filter(tx => tx.type === "egreso").forEach(tx => {
      const categoryId = tx.expense_category_id;
      if (categoryId) {
        const current = dataMap.get(categoryId);
        if (current) {
          dataMap.set(categoryId, { ...current, value: current.value + tx.amount });
        }
      }
    });
    return Array.from(dataMap.values()).filter(entry => entry.value > 0);
  }, [cashTransactions, expenseCategories]);

  // NEW: Card Income Category Data
  const cardIncomeCategoryData = useMemo(() => {
    const dataMap = new Map<string, { name: string; value: number; color: string }>();
    incomeCategories.forEach(cat => dataMap.set(cat.id, { name: cat.name, value: 0, color: cat.color }));

    cards.forEach(card => {
      (card.transactions || [])
        .filter(tx => tx.type === "payment") // Payments to cards are considered income for the card
        .forEach(tx => {
          const categoryId = tx.income_category_id;
          if (categoryId) {
            const current = dataMap.get(categoryId);
            if (current) {
              dataMap.set(categoryId, { ...current, value: current.value + tx.amount });
            }
          }
        });
    });
    return Array.from(dataMap.values()).filter(entry => entry.value > 0);
  }, [cards, incomeCategories]);

  // NEW: Card Expense Category Data
  const cardExpenseCategoryData = useMemo(() => {
    const dataMap = new Map<string, { name: string; value: number; color: string }>();
    expenseCategories.forEach(cat => dataMap.set(cat.id, { name: cat.name, value: 0, color: cat.color }));

    cards.forEach(card => {
      (card.transactions || [])
        .filter(tx => tx.type === "charge") // Charges on cards are considered expenses
        .forEach(tx => {
          const categoryId = tx.expense_category_id;
          if (categoryId) {
            const current = dataMap.get(categoryId);
            if (current) {
              dataMap.set(categoryId, { ...current, value: current.value + tx.amount });
            }
          }
        });
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

  const monthlyCardSpendingData = useMemo(() => {
    if (!cards.length) return [];

    const monthlyDataMap = new Map<string, { [key: string]: any }>(); // Key: YYYY-MM

    cards.forEach(card => {
      (card.transactions || []).forEach(tx => {
        if (tx.type === "charge") {
          const monthKey = format(parseISO(tx.date), "yyyy-MM");
          const monthName = format(parseISO(tx.date), "MMM", { locale: es });

          if (!monthlyDataMap.has(monthKey)) {
            monthlyDataMap.set(monthKey, { name: monthName });
          }

          const currentMonthData = monthlyDataMap.get(monthKey)!;
          const cardName = card.name;
          currentMonthData[cardName] = (currentMonthData[cardName] || 0) + (tx.installments_total_amount || tx.amount);
          monthlyDataMap.set(monthKey, currentMonthData);
        }
      });
    });

    return Array.from(monthlyDataMap.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([, value]) => value);
  }, [cards]);

  const uniqueCardNames = useMemo(() => {
    const names = new Set<string>();
    cards.forEach(card => names.add(card.name));
    return Array.from(names);
  }, [cards]);

  const cardSummaryData = useMemo(() => {
    return cards.map(card => {
      const isCredit = card.type === "credit";
      const creditAvailable = isCredit && card.credit_limit !== undefined ? card.credit_limit - card.current_balance : 0;
      const upcomingPaymentDueDate = isCredit && card.cut_off_day !== undefined && card.days_to_pay_after_cut_off !== undefined
        ? getUpcomingPaymentDueDate(card.cut_off_day, card.days_to_pay_after_cut_off)
        : null;

      const totalSpent = (card.transactions || [])
        .filter(tx => tx.type === "charge")
        .reduce((sum, tx) => sum + (tx.installments_total_amount || tx.amount), 0);

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
          <CardTitle>Resumen Detallado de Tarjetas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarjeta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Límite / Saldo Inicial</TableHead>
                  <TableHead>Deuda Actual / Saldo Disponible</TableHead>
                  <TableHead>Crédito Disponible</TableHead>
                  <TableHead>Total Gastado (Histórico)</TableHead>
                  <TableHead>Próx. Pago (Crédito)</TableHead>
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
                    <TableCell>{card.isCredit ? "Crédito" : "Débito"}</TableCell>
                    <TableCell>${(card.isCredit ? card.credit_limit : card.initial_balance)?.toFixed(2) || "N/A"}</TableCell>
                    <TableCell>${card.current_balance.toFixed(2)}</TableCell>
                    <TableCell className={card.isCredit && card.creditAvailable < 0 ? "text-red-600" : ""}>
                      {card.isCredit ? `$${card.creditAvailable.toFixed(2)}` : "N/A"}
                    </TableCell>
                    <TableCell>${card.totalSpent.toFixed(2)}</TableCell>
                    <TableCell>
                      {card.isCredit && card.upcomingPaymentDueDate
                        ? format(card.upcomingPaymentDueDate, "dd/MM/yyyy", { locale: es })
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estado Actual de Tarjetas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cardStatusChartData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="LimiteOInicial" fill="#87CEEB" name="Límite / Saldo Inicial" />
                <Bar dataKey="SaldoActualODeuda" fill="#FFB6C1" name="Saldo Actual / Deuda" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen de Ingresos y Egresos (Efectivo)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlySummaryData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="ingresos" fill="#87CEEB" name="Ingresos" />
                <Bar dataKey="egresos" fill="#FFB6C1" name="Egresos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gastos Mensuales por Tarjeta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyCardSpendingData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                {uniqueCardNames.map((cardName, index) => (
                  <Bar
                    key={cardName}
                    dataKey={cardName}
                    fill={cards.find(c => c.name === cardName)?.color || `#${Math.floor(Math.random()*16777215).toString(16)}`}
                    name={cardName}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos por Categoría (Efectivo)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={incomeCategoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {incomeCategoryData.map((entry, index) => (
                      <Cell key={`cell-income-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Egresos por Categoría (Efectivo)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {expenseCategoryData.map((entry, index) => (
                      <Cell key={`cell-expense-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NEW: Card Income and Expense Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos por Categoría (Tarjetas)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {cardIncomeCategoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cardIncomeCategoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {cardIncomeCategoryData.map((entry, index) => (
                        <Cell key={`cell-card-income-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No hay datos de ingresos por tarjeta para mostrar.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Egresos por Categoría (Tarjetas)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {cardExpenseCategoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cardExpenseCategoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {cardExpenseCategoryData.map((entry, index) => (
                        <Cell key={`cell-card-expense-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No hay datos de egresos por tarjeta para mostrar.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;