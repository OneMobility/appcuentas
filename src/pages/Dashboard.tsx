"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Home, Users, DollarSign, RefreshCw, PiggyBank, CalendarIcon, ArrowRightLeft, Coins, Sparkles, Heart, Star, Wallet, CreditCard } from "lucide-react";
import { useCategoryContext } from "@/context/CategoryContext";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { getLocalDateString } from "@/utils/date-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import GroupedPaymentDueDatesCard from "@/components/GroupedPaymentDueDatesCard";
import { cn } from "@/lib/utils";
import CreditCardsChart from "@/components/CreditCardsChart";
import CategoryPieChart from "@/components/CategoryPieChart";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchUsdToMxnRate } from "@/utils/currency-helper";
import FinancialHealthCard from "@/components/FinancialHealthCard";
import SmartTipsCard from "@/components/SmartTipsCard";

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
  const { incomeCategories, expenseCategories, isLoadingCategories } = useCategoryContext();

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

  const [exchangeRate, setExchangeRate] = useState<number>(20.00);
  const [usdInput, setUsdInput] = useState<string>("1");
  const [mxnInput, setMxnInput] = useState<string>("20.00");

  useEffect(() => {
    const saved = localStorage.getItem('oinkash_manual_payments');
    if (saved) {
      try { setManualPayments(JSON.parse(saved)); } catch (e) { setManualPayments({}); }
    }
  }, [refreshKey]);

  useEffect(() => {
    const loadRate = async () => {
      const r = await fetchUsdToMxnRate();
      setExchangeRate(r);
      setMxnInput(r.toFixed(2));
    };
    loadRate();
  }, [refreshKey]);

  const fetchDashboardData = async () => {
    if (!user) return;
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
  };

  useEffect(() => {
    if (user && !isLoadingCategories) fetchDashboardData();
  }, [user, isLoadingCategories, refreshKey]);

  const totals = useMemo(() => {
    const cash = cashTransactions.reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0);
    const debt = debtors.reduce((s, d) => s + d.current_balance, 0);
    const cred = creditors.reduce((s, c) => s + c.current_balance, 0);
    const debitCards = cards.filter(c => c.type === "debit").reduce((s, c) => s + c.current_balance, 0);
    const creditDebt = cards.filter(c => c.type === "credit").reduce((s, c) => s + c.current_balance, 0);
    return { cash, debt, cred, debitCards, creditDebt, total: cash + debt + debitCards - cred - creditDebt };
  }, [cashTransactions, debtors, creditors, cards]);

  const categoryMetrics = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    const process = (txs: any[], isCash: boolean, type: string) => {
      return txs.filter(tx => {
        const d = parseISO(tx.date);
        return isWithinInterval(d, { start, end }) && (isCash ? tx.type === type : (type === "ingreso" ? tx.type === "payment" : tx.type === "charge"));
      }).reduce((acc: Record<string, number>, tx) => {
        const id = isCash ? (tx.type === "ingreso" ? tx.income_category_id : tx.expense_category_id) : (tx.type === "payment" ? tx.income_category_id : tx.expense_category_id);
        if (id) acc[id] = (acc[id] || 0) + tx.amount;
        return acc;
      }, {});
    };

    const formatData = (map: Record<string, number>, cats: any[]) => Object.entries(map).map(([id, v]) => {
      const c = cats.find(x => x.id === id);
      return { name: c?.name || "Otro", value: v, color: c?.color || "#eee" };
    }).sort((a, b) => b.value - a.value);

    return {
      expenses: formatData(process([...cashTransactions, ...cardTransactions], true, "egreso"), expenseCategories),
      income: formatData(process([...cashTransactions, ...cardTransactions], true, "ingreso"), incomeCategories)
    };
  }, [cashTransactions, cardTransactions, incomeCategories, expenseCategories]);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between px-2">
        <div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-primary-foreground/90">
            ¡Hola, {user?.user_metadata?.first_name || 'Amigui'}! 🎀
          </h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Hoy es un lindo día para ahorrar ✨</p>
        </div>
        <Button 
          variant="secondary" 
          size="icon" 
          onClick={() => setRefreshKey(k => k + 1)} 
          className="rounded-full h-12 w-12 bg-white shadow-soft hover:bg-primary/10 border-none"
        >
          <RefreshCw className="h-5 w-5 text-primary" />
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 px-2">
        <div className="lg:col-span-1 space-y-6">
          <FinancialHealthCard />
          <SmartTipsCard />
        </div>
        
        <div className="lg:col-span-2 space-y-6">
          <GroupedPaymentDueDatesCard cards={cards} onUpdate={() => setRefreshKey(prev => prev + 1)} />
          
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[
              { label: "Mi Tesoro", val: totals.cash + totals.debitCards, icon: Wallet, color: "text-emerald-500", bg: "bg-emerald-50", emoji: "💰" },
              { label: "Amiguis", val: totals.debt, icon: Users, color: "text-sky-500", bg: "bg-sky-50", emoji: "🤝" },
              { label: "Pendientes", val: totals.cred + totals.creditDebt, icon: DollarSign, color: "text-rose-500", bg: "bg-rose-50", emoji: "💸" },
              { label: "Pura Paz", val: totals.total, icon: Heart, color: "text-purple-500", bg: "bg-purple-50", emoji: "🦄" },
            ].map((item, i) => (
              <Card key={i} className={cn("rounded-[2rem] border-none shadow-sm card-kawaii", item.bg)}>
                <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-60">{item.label}</CardTitle>
                  <span className="text-sm">{item.emoji}</span>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-xl md:text-2xl font-black tracking-tight text-slate-800">${item.val.toFixed(0)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="px-2">
        <Card className="rounded-[2.5rem] border-none shadow-sm bg-secondary/30 border-2 border-white/50">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-black flex items-center gap-2 text-secondary-foreground uppercase tracking-widest">
              <Coins className="h-5 w-5" /> Conversor Mágico 🌈
            </CardTitle>
            <Badge variant="secondary" className="rounded-full font-bold px-3">
              1 USD = ${exchangeRate.toFixed(2)} MXN
            </Badge>
          </CardHeader>
          <CardContent className="p-5 pt-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid gap-2 flex-1">
                <Label className="text-[10px] font-black text-secondary-foreground/60 uppercase ml-2">Dólares 🇺🇸</Label>
                <div className="relative">
                  <Input 
                    type="number" value={usdInput} onChange={(e) => { setUsdInput(e.target.value); setMxnInput((parseFloat(e.target.value) * exchangeRate).toFixed(2)); }}
                    className="rounded-2xl h-11 text-sm font-bold bg-white/80 border-none shadow-inner pl-8"
                  />
                  <span className="absolute left-3 top-3 text-xs font-bold opacity-40">$</span>
                </div>
              </div>
              <div className="mt-6 p-2 bg-white rounded-full shadow-sm">
                <ArrowRightLeft className="h-4 w-4 text-secondary-foreground/40" />
              </div>
              <div className="grid gap-2 flex-1">
                <Label className="text-[10px] font-black text-secondary-foreground/60 uppercase ml-2">Pesos 🇲🇽</Label>
                <div className="relative">
                  <Input 
                    type="number" value={mxnInput} onChange={(e) => { setMxnInput(e.target.value); setUsdInput((parseFloat(e.target.value) / exchangeRate).toFixed(2)); }}
                    className="rounded-2xl h-11 text-sm font-bold bg-white/80 border-none shadow-inner pl-8"
                  />
                  <span className="absolute left-3 top-3 text-xs font-bold opacity-40">$</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 px-2">
        <Card className="rounded-[2.5rem] border-none shadow-md overflow-hidden bg-white">
          <CardHeader className="p-6 pb-2"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">¿En qué se me fue? 🍩</CardTitle></CardHeader>
          <CardContent className="p-2"><CategoryPieChart data={categoryMetrics.expenses} title="Egresos" /></CardContent>
        </Card>
        <Card className="rounded-[2.5rem] border-none shadow-md overflow-hidden bg-white">
          <CardHeader className="p-6 pb-2"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">¿De dónde llegó? 🍬</CardTitle></CardHeader>
          <CardContent className="p-2"><CategoryPieChart data={categoryMetrics.income} title="Ingresos" /></CardContent>
        </Card>
      </div>

      <Card className="rounded-[2.5rem] border-none shadow-md mx-2 bg-white">
        <CardHeader className="p-6 pb-0 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-black uppercase tracking-widest">Mis Tarjetitas 💳</CardTitle>
          <Button variant="ghost" className="text-xs font-black text-primary hover:bg-primary/10 rounded-full" onClick={() => setIsPaymentDialogOpen(true)}>
            <Star className="h-3 w-3 mr-1" /> Marcar Pago
          </Button>
        </CardHeader>
        <CardContent className="p-4"><CreditCardsChart cards={cards} /></CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;