"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DollarSign, RefreshCw, ArrowRightLeft, Coins, Wallet, CreditCard, Users, Heart, TrendingUp, Star } from "lucide-react";
import { useCategoryContext } from "@/context/CategoryContext";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import GroupedPaymentDueDatesCard from "@/components/GroupedPaymentDueDatesCard";
import CreditCardsChart from "@/components/CreditCardsChart";
import CategoryPieChart from "@/components/CategoryPieChart";
import { fetchUsdToMxnRate } from "@/utils/currency-helper";
import FinancialHealthCard from "@/components/FinancialHealthCard";
import SmartTipsCard from "@/components/SmartTipsCard";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, isLoadingCategories } = useCategoryContext();

  const [cards, setCards] = useState<any[]>([]);
  const [cashTransactions, setCashTransactions] = useState<any[]>([]);
  const [cardTransactions, setCardTransactions] = useState<any[]>([]);
  const [debtors, setDebtors] = useState<any[]>([]);
  const [creditors, setCreditors] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [exchangeRate, setExchangeRate] = useState<number>(20.00);
  const [usdInput, setUsdInput] = useState<string>("1");
  const [mxnInput, setMxnInput] = useState<string>("20.00");

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

    const process = (txs: any[]) => {
      return txs.filter(tx => {
        const d = parseISO(tx.date);
        return isWithinInterval(d, { start, end });
      }).reduce((acc: Record<string, number>, tx) => {
        const id = tx.income_category_id || tx.expense_category_id;
        if (id) acc[id] = (acc[id] || 0) + tx.amount;
        return acc;
      }, {});
    };

    const formatData = (map: Record<string, number>, cats: any[]) => Object.entries(map).map(([id, v]) => {
      const c = cats.find(x => x.id === id);
      return { name: c?.name || "Otro", value: v, color: c?.color || "#eee" };
    }).sort((a, b) => b.value - a.value);

    return {
      expenses: formatData(process([...cashTransactions.filter(t => t.type === 'egreso'), ...cardTransactions.filter(t => t.type === 'charge')]), expenseCategories),
      income: formatData(process([...cashTransactions.filter(t => t.type === 'ingreso'), ...cardTransactions.filter(t => t.type === 'payment')]), incomeCategories)
    };
  }, [cashTransactions, cardTransactions, incomeCategories, expenseCategories]);

  return (
    <div className="flex flex-col gap-8 pb-20 max-w-6xl mx-auto">
      {/* Header Fluido */}
      <header className="flex items-center justify-between px-2 pt-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Resumen General 🐷
          </h1>
          <p className="text-sm font-medium text-slate-500">Tus finanzas bajo control de forma sencilla.</p>
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setRefreshKey(k => k + 1)} 
          className="rounded-full h-12 w-12 bg-white shadow-soft border-none hover:rotate-180 transition-transform duration-500"
        >
          <RefreshCw className="h-5 w-5 text-slate-600" />
        </Button>
      </header>

      {/* Widgets Principales */}
      <div className="grid gap-6 lg:grid-cols-12 px-2">
        <div className="lg:col-span-4 space-y-6">
          <FinancialHealthCard />
          <SmartTipsCard />
        </div>
        
        <div className="lg:col-span-8 space-y-6">
          <GroupedPaymentDueDatesCard cards={cards} onUpdate={() => setRefreshKey(prev => prev + 1)} />
          
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[
              { label: "Disponible", val: totals.cash + totals.debitCards, color: "bg-indigo-50 text-indigo-700", icon: Wallet },
              { label: "Te deben", val: totals.debt, color: "bg-emerald-50 text-emerald-700", icon: Users },
              { label: "Debes", val: totals.cred + totals.creditDebt, color: "bg-rose-50 text-rose-700", icon: DollarSign },
              { label: "Balance Neto", val: totals.total, color: "bg-slate-900 text-white", icon: Heart },
            ].map((item, i) => (
              <Card key={i} className={cn("rounded-3xl border-none shadow-soft p-5", item.color)}>
                <div className="flex flex-col h-full justify-between">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{item.label}</span>
                    <item.icon className="h-4 w-4 opacity-50" />
                  </div>
                  <p className="text-xl md:text-2xl font-black">${item.val.toLocaleString()}</p>
                </div>
              </Card>
            ))}
          </div>

          <Card className="rounded-[2rem] border-none shadow-soft bg-white p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Conversor 🪙</h3>
              <Badge variant="outline" className="rounded-full">1 USD = ${exchangeRate.toFixed(2)}</Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 ml-1">Dólares</Label>
                <Input 
                  type="number" value={usdInput} 
                  onChange={(e) => { setUsdInput(e.target.value); setMxnInput((parseFloat(e.target.value) * exchangeRate).toFixed(2)); }}
                  className="rounded-2xl border-slate-100 bg-slate-50 h-12 font-bold"
                />
              </div>
              <ArrowRightLeft className="h-5 w-5 text-slate-300 mt-6" />
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 ml-1">Pesos</Label>
                <Input 
                  type="number" value={mxnInput} 
                  onChange={(e) => { setMxnInput(e.target.value); setUsdInput((parseFloat(e.target.value) / exchangeRate).toFixed(2)); }}
                  className="rounded-2xl border-slate-100 bg-slate-50 h-12 font-bold"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Gráficos Redondeados */}
      <div className="grid gap-6 md:grid-cols-2 px-2">
        <Card className="rounded-[2.5rem] border-none shadow-soft bg-white p-6">
          <CardHeader className="p-0 mb-4"><CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Gastos del Mes 🍩</CardTitle></CardHeader>
          <CategoryPieChart data={categoryMetrics.expenses} title="" />
        </Card>
        <Card className="rounded-[2.5rem] border-none shadow-soft bg-white p-6">
          <CardHeader className="p-0 mb-4"><CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Uso de Tarjetas 💳</CardTitle></CardHeader>
          <CreditCardsChart cards={cards} />
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;