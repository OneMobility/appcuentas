"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Home, Users, DollarSign, CreditCard, Smile, AlertTriangle, Meh, RefreshCw } from "lucide-react"; // Importar RefreshCw
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategoryContext } from "@/context/CategoryContext";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError } from "@/utils/toast";
import { format, isBefore, isSameDay, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUpcomingPaymentDueDate } from "@/utils/date-helpers";
import { Button } from "@/components/ui/button"; // Importar Button

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
      const { data: creditorsData, error: creditorsError } = await supabase
        .from('creditors')
        .select('*')
        .eq('user_id', user.id);
      if (creditorsError) throw creditorsError;
      setCreditors(creditorsData || []);

    } catch (error: any) {
      showError('Error al cargar datos del dashboard: ' + error.message);
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
    if (!cards.length) return [];

    const monthlyDataMap = new Map<string, { [key: string]: any }>(); // Key: YYYY-MM

    cards.forEach(card => {
      (card.transactions || []).forEach(tx => {
        if (tx.type === "charge") {
          const monthKey = format(new Date(tx.date), "yyyy-MM");
          const monthName = format(new Date(tx.date), "MMM", { locale: es });

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
    return cards.map(card => {
      const isCredit = card.type === "credit";
      return {
        name: card.name,
        LimiteOInicial: isCredit ? (card.credit_limit || 0) : card.initial_balance,
        SaldoActualODeuda: card.current_balance,
        color: card.color,
        type: card.type,
      };
    });
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
        // Check if current balance exceeds credit limit
        if (card.credit_limit !== undefined && card.current_balance > card.credit_limit) {
          hasCriticalIssue = true;
          criticalCards.push(`${card.name} (límite excedido)`);
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

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={handleRefreshData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar Datos
        </Button>
      </div>

      {cardHealthStatus.status === "critical" ? (
        <Card className="border-blue-600 bg-blue-50 text-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Estado de Tarjetas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">Oye, pon atención en tus saldos</div>
            <p className="text-xs text-blue-700">
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
            <Meh className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">Atención: Algo no cuadra</div>
            <p className="text-xs text-orange-700">
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
            <Smile className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">¡Todo está en orden aquí!</div>
            <p className="text-xs text-green-700">Tus tarjetas están al día y dentro de los límites.</p>
          </CardContent>
        </Card>
      )}

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
                <Bar dataKey="LimiteOInicial" fill="#8884d8" name="Límite / Saldo Inicial" />
                <Bar dataKey="SaldoActualODeuda" fill="#82ca9d" name="Saldo Actual / Deuda" />
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
    </div>
  );
};

export default Dashboard;