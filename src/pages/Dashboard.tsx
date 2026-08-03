"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DollarSign, RefreshCw, ArrowRightLeft, Coins, Wallet, CreditCard, Users, Heart, Star } from "lucide-react";
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
import FinancialPredictionCard from "@/components/FinancialPredictionCard";
import SmartTipsCard from "@/components/SmartTipsCard";
import { cn } from "@/lib/utils";
import { showSuccess, showError } from "@/utils/toast";

const COCHINITO_LOGO = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro.png";

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

  const fetchDashboardData = async (isManual = false) => {
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
      
      if (isManual) {
        showSuccess("Datos actualizados correctamente 🐷");
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      showError("No se pudieron cargar los datos.");
    }
  };

  useEffect(() => {
    if (user && !isLoadingCategories) {
      fetchDashboardData(refreshKey > 0);
    }
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

    const processTxs = (txs: any[]) => {
      return txs.filter(tx => {
        const d = parseISO(tx.date);
        return isWithinInterval(d, { start, end });
      }).reduce((acc: Record<string, number>, tx) => {
        const id = tx.income_category_id || tx.expense_category_id;
        if (id) acc[id] = (acc[id] || 0) + tx.amount;
        return acc;
      }, {});
    };

    const formatData = (map: Record<string, number>, cats: any[]) => {
      return Object.entries(map).map(([id, v]) => {
        const c = cats.find(x => x.id === id);
        return { name: c?.name || "Otro", value: v, color: c?.color || "#eee" };
      }).sort((a, b) => b.value - a.value);
    };

    return {
      expenses: formatData(processTxs([...cashTransactions.filter(t => t.type === 'egreso'), ...cardTransactions.filter(t => t.type === 'charge')]), expenseCategories),
      income: formatData(processTxs([...cashTransactions.filter(t => t.type === 'ingreso'), ...cardTransactions.filter(t => t.type === 'payment')]), incomeCategories)
    };
  }, [cashTransactions, cardTransactions, incomeCategories, expenseCategories]);

  return (
    <div className="flex flex-col gap-10 pb-24 max-w-6xl mx-auto px-4 md:px-6">
      
      {/* 1. SECCIÓN DE SALUDO */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 text-center md:text-left">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl animate-pulse" />
            <img 
              src={COCHINITO_LOGO} 
              alt="Oinkash" 
              className="h-32 w-32 relative z-10 drop-shadow-xl hover:scale-105 transition-transform duration-300 object-contain"
            />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
              ¡Hola, {user?.user_metadata?.first_name || 'Amigo'}! 🐷
            </h1>
            <p className="text-lg font-medium text-slate-500 mt-1">Qué bueno verte por aquí. Tu dinero está en buenas manos.</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setRefreshKey(k => k + 1)} 
          className="rounded-full h-12 w-12 bg-white shadow-soft border-none hover:rotate-180 transition-transform duration-500 hidden md:flex"
        >
          <RefreshCw className="h-5 w-5 text-slate-600" />
        </Button>
      </header>

      {/* 2. TARJETAS DE RESUMEN */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
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
      </section>

      {/* 3. SALUD FINANCIERA (Score Ancho Total) */}
      <section className="space-y-6">
        <FinancialHealthCard />
        
        <div className="grid gap-6 md:grid-cols-2">
          <FinancialPredictionCard />
          <SmartTipsCard />
        </div>
      </section>

      {/* 5. LISTA DE PAGOS */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Star className="h-4 w-4" /> Pagos Pendientes
          </h3>
        </div>
        <GroupedPaymentDueDatesCard cards={cards} onUpdate={() => setRefreshKey(prev => prev + 1)} />
      </section>

      {/* 6. CONVERSOR DE DIVISAS */}
      <section>
        <Card className="rounded-[2.5rem] border-none shadow-soft bg-white p-6 md:p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Coins className="h-4 w-4" /> Conversor 🪙
            </h3>
            <Badge variant="outline" className="rounded-full border-slate-200 text-slate-600 font-bold px-4 py-1">
              1 USD = ${exchangeRate.toFixed(2)} MXN
            </Badge>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 w-full space-y-2">
              <Label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">Dólares (USD)</Label>
              <Input 
                type="number" value={usdInput} 
                onChange={(e) => { 
                  setUsdInput(e.target.value); 
                  setMxnInput((parseFloat(e.target.value || "0") * exchangeRate).toFixed(2)); 
                }}
                className="rounded-2xl border-slate-100 bg-slate-50 h-14 font-black text-lg focus-visible:ring-primary/20"
              />
            </div>
            <div className="bg-slate-50 p-3 rounded-full shadow-inner mt-4 md:mt-6">
              <ArrowRightLeft className="h-6 w-6 text-slate-300" />
            </div>
            <div className="flex-1 w-full space-y-2">
              <Label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">Pesos (MXN)</Label>
              <Input 
                type="number" value={mxnInput} 
                onChange={(e) => { 
                  setMxnInput(e.target.value); 
                  setUsdInput((parseFloat(e.target.value || "0") / exchangeRate).toFixed(2)); 
                }}
                className="rounded-2xl border-slate-100 bg-slate-50 h-14 font-black text-lg focus-visible:ring-primary/20"
              />
            </div>
          </div>
        </Card>
      </section>

      {/* 7. GRÁFICAS DE CATEGORÍAS */}
      <section className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-[2.5rem] border-none shadow-soft bg-white p-6 md:p-8">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Gastos del Mes 🍩</CardTitle>
          </CardHeader>
          <CategoryPieChart data={categoryMetrics.expenses} title="" />
        </Card>
        <Card className="rounded-[2.5rem] border-none shadow-soft bg-white p-6 md:p-8">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Ingresos del Mes 🍬</CardTitle>
          </CardHeader>
          <CategoryPieChart data={categoryMetrics.income} title="" />
        </Card>
      </section>

      {/* 8. USO DE TARJETAS */}
      <section>
        <Card className="rounded-[2.5rem] border-none shadow-soft bg-white p-6 md:p-8">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Uso de Tarjetas 💳
            </CardTitle>
          </CardHeader>
          <div className="w-full">
            <CreditCardsChart cards={cards} />
          </div>
        </Card>
      </section>

    </div>
  );
};

export default Dashboard;