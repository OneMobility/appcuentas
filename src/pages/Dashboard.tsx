"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Home, Users, DollarSign, RefreshCw, PiggyBank, CheckCircle2, CalendarIcon, AlertCircle } from "lucide-react";
import { useCategoryContext } from "@/context/CategoryContext";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { format, isBefore, isSameDay, addDays, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUpcomingPaymentDueDate, isPaymentDoneForCurrentStatement, getLocalDateString } from "@/utils/date-helpers";
import { Button } from "@/components/ui/button";
import GroupedPaymentDueDatesCard from "@/components/GroupedPaymentDueDatesCard";
import { cn } from "@/lib/utils";
import CreditCardsChart from "@/components/CreditCardsChart";
import CategoryPieChart from "@/components/CategoryPieChart";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface CardData {
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
  user_id?: string;
}

const Dashboard = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, getCategoryById, isLoadingCategories } = useCategoryContext();

  const [viewMode, setViewMode] = useState<"global" | "month">("global");
  const [cards, setCards] = useState<CardData[]>([]);
  const [cashTransactions, setCashTransactions] = useState<any[]>([]);
  const [cardTransactions, setCardTransactions] = useState<any[]>([]);
  const [debtors, setDebtors] = useState<any[]>([]);
  const [creditors, setCreditors] = useState<any[]>([]);
  const [debtorTransactions, setDebtorTransactions] = useState<any[]>([]);
  const [creditorTransactions, setCreditorTransactions] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedCardForPayment, setSelectedCardForPayment] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [manualPayments, setManualPayments] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem('oinkash_manual_payments');
    if (saved) {
      try { setManualPayments(JSON.parse(saved)); } catch (e) { setManualPayments({}); }
    }
  }, [refreshKey]);

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      const [cardsRes, cashRes, cardTxRes, debtorsRes, creditorsRes, debtorTxRes, creditorTxRes] = await Promise.all([
        supabase.from('cards').select('*').eq('user_id', user.id),
        supabase.from('cash_transactions').select('*').eq('user_id', user.id),
        supabase.from('card_transactions').select('*').eq('user_id', user.id),
        supabase.from('debtors').select('*').eq('user_id', user.id),
        supabase.from('creditors').select('*').eq('user_id', user.id),
        supabase.from('debtor_transactions').select('*').eq('user_id', user.id),
        supabase.from('creditor_transactions').select('*').eq('user_id', user.id)
      ]);
      setCards(cardsRes.data || []);
      setCashTransactions(cashRes.data || []);
      setCardTransactions(cardTxRes.data || []);
      setDebtors(debtorsRes.data || []);
      setCreditors(creditorsRes.data || []);
      setDebtorTransactions(debtorTxRes.data || []);
      setCreditorTransactions(creditorTxRes.data || []);
    } catch (error: any) {
      showError('Error al cargar datos');
    }
  };

  useEffect(() => {
    if (user && !isLoadingCategories) fetchDashboardData();
  }, [user, isLoadingCategories, refreshKey]);

  const categoryMetrics = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    const incomeMap: Record<string, number> = {};
    const expenseMap: Record<string, number> = {};

    const processTx = (tx: any, isCash: boolean) => {
      const date = parseISO(tx.date);
      if (!isWithinInterval(date, { start, end })) return;

      const catId = isCash 
        ? (tx.type === "ingreso" ? tx.income_category_id : tx.expense_category_id)
        : (tx.type === "payment" ? tx.income_category_id : tx.expense_category_id);
      
      if (!catId) return;

      const isIncome = isCash ? tx.type === "ingreso" : tx.type === "payment";
      const target = isIncome ? incomeMap : expenseMap;
      target[catId] = (target[catId] || 0) + tx.amount;
    };

    cashTransactions.forEach(t => processTx(t, true));
    cardTransactions.forEach(t => processTx(t, false));

    const formatData = (map: Record<string, number>, categories: any[]) => {
      return Object.entries(map).map(([id, val]) => {
        const cat = categories.find(c => c.id === id);
        return { name: cat?.name || "Otros", value: val, color: cat?.color || "#cbd5e1" };
      }).sort((a, b) => b.value - a.value);
    };

    return {
      income: formatData(incomeMap, incomeCategories),
      expenses: formatData(expenseMap, expenseCategories)
    };
  }, [cashTransactions, cardTransactions, incomeCategories, expenseCategories]);

  const totals = useMemo(() => {
    // Cálculos Globales
    const cash = cashTransactions.reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0);
    const debt = debtors.reduce((s, d) => s + d.current_balance, 0);
    const cred = creditors.reduce((s, c) => s + c.current_balance, 0);
    const debitCards = cards.filter(c => c.type === "debit").reduce((s, c) => s + c.current_balance, 0);
    const creditDebt = cards.filter(c => c.type === "credit").reduce((s, c) => s + c.current_balance, 0);
    const globalTotal = cash + debt + debitCards - cred - creditDebt;

    // Cálculos del Mes Actual
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    const monthlyCashFlow = cashTransactions
      .filter(t => {
        const d = parseISO(t.date);
        return isWithinInterval(d, { start, end });
      })
      .reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0);

    const debitCardIds = cards.filter(c => c.type === "debit").map(c => c.id);
    const monthlyDebitFlow = cardTransactions
      .filter(t => {
        const d = parseISO(t.date);
        return debitCardIds.includes(t.card_id) && isWithinInterval(d, { start, end });
      })
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const monthlyCash = monthlyCashFlow(cashTransactions, start, end);
    const monthlyDebit = monthlyDebitFlow(cardTransactions, cards, start, end);

    const monthlyCharges = debtors.reduce((sum, d) => {
      const debtorTxs = d.debtor_transactions || [];
      const monthCharges = debtorTxs
        .filter((t: any) => t.type === "charge" && isWithinInterval(parseISO(t.date), { start, end }))
        .reduce((s: number, t: any) => s + t.amount, 0);
      return sum + monthCharges;
    }, 0);

    const monthlyDebten = debtorTransactions
      .filter(t => {
        const d = parseISO(t.date);
        return t.type === "charge" && isWithinInterval(d, { start, end });
      })
      .reduce((s, t) => s + t.amount, 0);

    const monthlyCredDebes = creditorTransactions
      .filter(t => {
        const d = parseISO(t.date);
        return t.type === "charge" && isWithinInterval(d, { start, end });
      })
      .reduce((s, t) => s + t.amount, 0);

    const creditCardIds = cards.filter(c => c.type === "credit").map(c => c.id);
    const monthlyCreditCharges = cardTransactions
      .filter(t => {
        const d = parseISO(t.date);
        return creditCardIds.includes(t.card_id) && t.type === "charge" && isWithinInterval(d, { start, end });
      })
      .reduce((s, t) => s + t.amount, 0);

    const monthlyDebes = monthlyCredDebes + monthlyCreditCharges;
    const monthlyTotal = (monthlyCashFlow + monthlyDebitFlow) + monthlyDebten - monthlyDebes;

    if (viewMode === "month") {
      return {
        cash: monthlyCashFlow + monthlyDebitFlow,
        debt: monthlyDebten,
        cred: monthlyDebes,
        total: monthlyTotal
      };
    }

    return {
      cash: cash + debitCards,
      debt,
      cred: cred + creditDebt,
      total: globalTotal
    };
  }, [cashTransactions, debtors, creditors, cards, cardTransactions, debtorTransactions, creditorTransactions, viewMode]);

  // Funciones auxiliares para flujos mensuales
  function monthlyCashFlow(txs: any[], start: Date, end: Date) {
    return txs
      .filter(t => isWithinInterval(parseISO(t.date), { start, end }))
      .reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0);
  }

  function monthlyDebitFlow(txs: any[], cardsList: any[], start: Date, end: Date) {
    const debitIds = cardsList.filter(c => c.type === "debit").map(c => c.id);
    return txs
      .filter(t => debitIds.includes(t.card_id) && isWithinInterval(parseISO(t.date), { start, end }))
      .reduce((s, t) => t.type === "payment" ? s + t.amount : s - t.amount, 0);
  }

  const handleMarkAsPaid = () => {
    if (!selectedCardForPayment) return;
    const updatedPayments = { ...manualPayments, [selectedCardForPayment]: getLocalDateString(paymentDate) };
    localStorage.setItem('oinkash_manual_payments', JSON.stringify(updatedPayments));
    setManualPayments(updatedPayments);
    showSuccess("Pago marcado.");
    setIsPaymentDialogOpen(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <h1 className="text-xl md:text-3xl font-bold tracking-tight">Hola, {user?.user_metadata?.first_name || 'Usuario'}</h1>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-full max-w-[260px]">
            <TabsList className="grid w-full grid-cols-2 rounded-xl h-9">
              <TabsTrigger value="global" className="rounded-lg text-xs font-bold">Global</TabsTrigger>
              <TabsTrigger value="month" className="rounded-lg text-xs font-bold">Del Mes</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="icon" onClick={() => setRefreshKey(k => k + 1)} className="rounded-full h-9 w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="px-1">
        <GroupedPaymentDueDatesCard cards={cards} />
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 px-1">
        {[
          { label: "TU DINERITO", val: totals.cash, icon: Home, color: "text-green-600", bg: "bg-green-50" },
          { label: "TE DEBEN", val: totals.debt, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "DEBES", val: totals.cred, icon: DollarSign, color: "text-red-600", bg: "bg-red-50" },
          { label: "BALANCE", val: totals.total, icon: PiggyBank, color: "text-pink-600", bg: "bg-pink-50" },
        ].map((item, i) => (
          <Card key={i} className={cn("border-none shadow-sm", item.bg)}>
            <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider opacity-70">{item.label}</CardTitle>
              <item.icon className={cn("h-3.5 w-3.5", item.color)} />
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="text-base md:text-xl font-bold">${item.val.toFixed(2)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 mx-1">
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-bold">Gastos por Categoría (Mes)</CardTitle></CardHeader>
          <CardContent className="p-0"><CategoryPieChart data={categoryMetrics.expenses} title="Egresos" /></CardContent>
        </Card>
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-bold">Gastos por Categoría (Mes)</CardTitle></CardHeader>
          <CardContent><CategoryPieChart data={categoryMetrics.income} title="Ingresos" /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mx-1">
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-bold">Gastos por Categoría (Mes)</CardTitle></CardHeader>
          <CardContent className="p-0"><CategoryPieChart data={categoryMetrics.expenses} title="Egresos" /></CardContent>
        </Card>
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-bold">Gastos por Categoría (Mes)</CardTitle></CardHeader>
          <CardContent className="p-0"><CategoryPieChart data={categoryMetrics.income} title="Ingresos" /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mx-1">
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-bold">Gastos por Categoría (Mes)</CardTitle></CardHeader>
          <CardContent className="p-0"><CategoryPieChart data={categoryMetrics.expenses} title="Egresos" /></CardContent>
        </Card>
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-bold">Gastos por Categoría (Mes)</CardTitle></CardHeader>
          <CardContent className="p-0"><CategoryPieChart data={categoryMetrics.income} title="Ingresos" /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mx-1">
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-bold">Gastos por Categoría (Mes)</CardTitle></CardHeader>
          <CardContent className="p-0"><CategoryPieChart data={categoryMetrics.expenses} title="Egresos" /></CardContent>
        </Card>
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-bold">Gastos por Categoría (Mes)</CardTitle></CardHeader>
          <CardContent className="p-0"><CategoryPieChart data={categoryMetrics.income} title="Ingresos" /></CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm mx-1">
        <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
          <CardTitle className="text-base md:text-lg">Uso de Tarjetas de Crédito</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs text-primary font-bold" onClick={() => setIsPaymentDialogOpen(true)}>Marcar Pago</Button>
        </CardHeader>
        <CardContent className="p-2 md:p-4"><CreditCardsChart cards={cards} /></CardContent>
      </Card>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle>Confirmar Pago</DialogTitle>
            <DialogDescription>Marca una tarjeta como pagada para este ciclo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tarjeta</Label>
              <Select value={selectedCardForPayment} onValueChange={setSelectedCardForPayment}>
                <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {cards.filter(c => c.type === "credit" && c.current_balance > 0).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Fecha de Pago</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal rounded-xl h-10">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? format(paymentDate, "dd/MM/yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar mode="single" selected={paymentDate} onSelect={(d) => d && setPaymentDate(d)} locale={es} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleMarkAsPaid} disabled={!selectedCardForPayment} className="w-full rounded-xl font-bold h-11">Confirmar Pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;