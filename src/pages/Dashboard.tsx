"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Home, Users, DollarSign, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategoryContext } from "@/context/CategoryContext";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError } from "@/utils/toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Tasas de cambio de ejemplo (MXN como base)
const exchangeRates: { [key: string]: number } = {
  MXN: 1,    // Peso Mexicano
  USD: 19.0, // Dólar Estadounidense
  EUR: 20.5, // Euro
  COP: 0.0045, // Peso Colombiano
  BOB: 2.7,  // Boliviano Boliviano
};

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
  user_id?: string;
}

interface CashTransaction {
  id: string;
  type: "ingreso" | "egreso";
  amount: number;
  description: string;
  date: string;
  category_id: string;
  category_type: "income" | "expense";
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

interface MonthlySummary {
  name: string; // Month name
  ingresos: number;
  egresos: number;
}

const Dashboard = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, isLoadingCategories } = useCategoryContext();
  const [amountToConvert, setAmountToConvert] = useState<string>("");
  const [fromCurrency, setFromCurrency] = useState<string>("USD");
  const [toCurrency, setToCurrency] = useState<string>("MXN");

  const [cards, setCards] = useState<CardData[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [debtors, setDebtors] = useState<DebtorData[]>([]);
  const [creditors, setCreditors] = useState<CreditorData[]>([]);
  const [cardTransactions, setCardTransactions] = useState<CardTransaction[]>([]);

  const fetchDashboardData = async () => {
    if (!user) {
      setCards([]);
      setCashTransactions([]);
      setDebtors([]);
      setCreditors([]);
      setCardTransactions([]);
      return;
    }

    try {
      // Fetch Cards
      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select('*')
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
      const { data: creditorsData, error: creditorsError } = await supabase
        .from('creditors')
        .select('*')
        .eq('user_id', user.id);
      if (creditorsError) throw creditorsError;
      setCreditors(creditorsData || []);

      // Fetch Card Transactions
      const { data: cardTxData, error: cardTxError } = await supabase
        .from('card_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });
      if (cardTxError) throw cardTxError;
      setCardTransactions(cardTxData || []);

    } catch (error: any) {
      showError('Error al cargar datos del dashboard: ' + error.message);
    }
  };

  useEffect(() => {
    if (user && !isLoadingCategories) {
      fetchDashboardData();
    }
  }, [user, isLoadingCategories]);

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

  const totalCardsBalance = useMemo(() => {
    return cards.reduce((sum, card) => {
      return sum + (card.type === "credit" ? -card.current_balance : card.current_balance);
    }, 0);
  }, [cards]);

  const incomeCategoryData = useMemo(() => {
    const dataMap = new Map<string, { name: string; value: number; color: string }>();
    incomeCategories.forEach(cat => dataMap.set(cat.id, { name: cat.name, value: 0, color: cat.color }));

    cashTransactions.filter(tx => tx.type === "ingreso").forEach(tx => {
      const current = dataMap.get(tx.category_id);
      if (current) {
        dataMap.set(tx.category_id, { ...current, value: current.value + tx.amount });
      }
    });
    return Array.from(dataMap.values()).filter(entry => entry.value > 0);
  }, [cashTransactions, incomeCategories]);

  const expenseCategoryData = useMemo(() => {
    const dataMap = new Map<string, { name: string; value: number; color: string }>();
    expenseCategories.forEach(cat => dataMap.set(cat.id, { name: cat.name, value: 0, color: cat.color }));

    cashTransactions.filter(tx => tx.type === "egreso").forEach(tx => {
      const current = dataMap.get(tx.category_id);
      if (current) {
        dataMap.set(tx.category_id, { ...current, value: current.value + tx.amount });
      }
    });
    return Array.from(dataMap.values()).filter(entry => entry.value > 0);
  }, [cashTransactions, expenseCategories]);

  const monthlySummaryData = useMemo(() => {
    const summaryMap = new Map<string, MonthlySummary>(); // Key: YYYY-MM

    cashTransactions.forEach(tx => {
      const monthKey = format(new Date(tx.date), "yyyy-MM");
      const monthName = format(new Date(tx.date), "MMMM", { locale: es }); // Full month name

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
    if (!cards.length || !cardTransactions.length) return [];

    const monthlyDataMap = new Map<string, { [key: string]: any }>(); // Key: YYYY-MM

    cardTransactions.forEach(tx => {
      if (tx.type === "charge") {
        const monthKey = format(new Date(tx.date), "yyyy-MM");
        const monthName = format(new Date(tx.date), "MMM", { locale: es }); // Short month name

        if (!monthlyDataMap.has(monthKey)) {
          monthlyDataMap.set(monthKey, { name: monthName });
        }

        const currentMonthData = monthlyDataMap.get(monthKey)!;
        const cardName = cards.find(c => c.id === tx.card_id)?.name || `Tarjeta ${tx.card_id?.substring(0, 4)}`;

        currentMonthData[cardName] = (currentMonthData[cardName] || 0) + tx.amount;
        monthlyDataMap.set(monthKey, currentMonthData);
      }
    });

    // Sort by month key to ensure chronological order
    return Array.from(monthlyDataMap.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([, value]) => value);
  }, [cards, cardTransactions]);

  const uniqueCardNames = useMemo(() => {
    const names = new Set<string>();
    cards.forEach(card => names.add(card.name));
    return Array.from(names);
  }, [cards]);

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Efectivo</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCashBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">+20.1% desde el mes pasado</p> {/* Placeholder */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deuda de Deudores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalDebtorsBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">-5.2% desde el mes pasado</p> {/* Placeholder */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deuda a Acreedores</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCreditorsBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">+10.5% desde el mes pasado</p> {/* Placeholder */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Tarjetas</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCardsBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">+1.8% desde el mes pasado</p> {/* Placeholder */}
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
                <Bar dataKey="ingresos" fill="#8884d8" name="Ingresos" />
                <Bar dataKey="egresos" fill="#82ca9d" name="Egresos" />
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
                    fill={cards.find(c => c.name === cardName)?.color || `#${Math.floor(Math.random()*16777215).toString(16)}`} // Fallback a color aleatorio
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
    </div>
  );
};

export default Dashboard;