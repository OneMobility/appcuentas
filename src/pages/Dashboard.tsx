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

  const [cards, setCards] = useState<CardData[]>([]);
  const [cashTransactions, setCashTransactions] = useState<any[]>([]);
  const [cardTransactions, setCardTransactions] = useState<any[]>([]);
  const [debtors, setDebtors] = useState<any[]>([]);
  const [creditors, setCreditors] = useState<any[]>([]);
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
      const [cardsRes, cashRes, cardTxRes, debtorsRes, creditorsRes] = await Promise.all([
        supabase.from('cards').select('*').eq('user_id', user.id),
        supabase.from('cash_transactions').select('*').eq('user_id', user.id),
        supabase.from('card_transactions').select('*').eq('user_id', user.id),
        supabase.from('debtors').select('*').eq('user_id', user.id),
        supabase.from('creditors').select('*').eq('user_id', user.id)
      ]);
      setCards(cardsRes.data || []);
      setCashTransactions(cashRes.data || []);
      setCardTransactions(cardTxRes.data || []);
      setDebtors(debtorsRes.data || []);
      setCreditors(creditorsRes.data || []);
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
    const cash = cashTransactions.reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0);
    const debt = debtors.reduce((s, d) => s + d.current_balance, 0);
    const cred = creditors.reduce((s, c) => s + c.current_balance, 0);
    const debitCards = cards.filter(c => c.type === "debit").reduce((s, c) => s + c.current_balance, 0);
    const creditDebt = cards.filter(c => c.type === "credit").reduce((s, c) => s + c.current_balance, 0);
    return { cash, debt, cred, debitCards, creditDebt, total: cash + debt + debitCards - cred - creditDebt };
  }, [cashTransactions, debtors, creditors, cards]);

  const totalCreditDebtMonth = useMemo(() => {
    const today = new Date();
    return cards
      .filter(c => c.type === "credit")
      .reduce((sum, card) => {
        const period = card.cut_off_day 
          ? getStatementPeriod(card.cut_off_day, today)
          : { start: startOfMonth(today), end: endOfMonth(today) };

        const periodTxs = (cardTransactions || []).filter((tx: any) => 
          tx.card_id === card.id && isWithinInterval(parseISO(tx.date), period)
        );

        const charges = periodTxs.filter((tx: any) => tx.type === "charge").reduce((s: number, tx: any) => s + tx.amount, 0);
        
        // Los pagos válidos para este periodo son los realizados desde el inicio del periodo
        // hasta la fecha límite de pago de este periodo (corte actual + días para pagar)
        const paymentDueDate = card.days_to_pay_after_cut_off !== undefined
          ? addDays(period.end, card.days_to_pay_after_cut_off)
          : period.end;

        const payments = (cardTransactions || [])
          .filter((tx: any) => {
            const txDate = parseISO(tx.date);
            return tx.card_id === card.id &&
                   tx.type === "payment" && 
                   txDate >= period.start && 
                   txDate <= paymentDueDate;
          })
          .reduce((s: number, tx: any) => s + tx.amount, 0);
        
        return sum + Math.max(0, charges - payments);
      }, 0);
  }, [cards, cardTransactions]);

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
      <div className="flex items-center gap-3 px-1">
        <img src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Logo%20App.png" alt="Logo" className="h-8 w-8" />
        <h1 className="text-xl md:text-3xl font-bold tracking-tight">Hola, {user?.user_metadata?.first_name || 'Usuario'}</h1>
        <Button variant="outline" size="icon" onClick={() => setRefreshKey(k => k + 1)} className="rounded-full h-8 w-8 md:h-10 md:w-10 ml-auto">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-1">
        <GroupedPaymentDueDatesCard cards={cards} />
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 px-1">
        {[
          { name: "Lo que tienes", amount: totals.cash, icon: Home, color: "text-green-600" },
          { name: "Te deben", amount: totals.debt, icon: Users, color: "text-yellow-600" },
          { name: "Debes", amount: totals.cred, icon: DollarSign, color: "text-red-600" },
          { name: "Deuda Crédito (Mes)", amount: totalCreditDebtMonth, icon: CalendarIcon, color: "text-orange-600" },
        ].map((item, idx) => (
          <Card key={idx} className="shadow-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.name}</CardTitle>
              <item.icon className={cn("h-4 w-4", item.color)} />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg md:text-2xl font-bold">${item.amount.toFixed(2)}</div>
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
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-bold">Ingresos por Categoría (Mes)</CardTitle></CardHeader>
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
              <Label>Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal rounded-xl h-10">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(paymentDate, "PPP", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={paymentDate} onSelect={(d) => d && setPaymentDate(d)} locale={es} /></PopoverContent>
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