"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/context/SessionContext';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, differenceInDays } from 'date-fns';

export interface FinancialHealth {
  score: number;
  status: 'Excelente' | 'Bueno' | 'Regular' | 'Crítico';
  pillars: {
    name: string;
    score: number;
    max: number;
    description: string;
    icon: string;
  }[];
  prediction: {
    estimatedEndBalance: number;
    daysUntilRed: number | null;
    canPayAll: boolean;
  };
}

export function useFinancialHealth() {
  const { user } = useSession();
  const [data, setData] = useState<FinancialHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHealthData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);

      const [cards, cash, debtors, creditors, savings, recurring, budgets] = await Promise.all([
        supabase.from('cards').select('*').eq('user_id', user.id),
        supabase.from('cash_transactions').select('*').eq('user_id', user.id),
        supabase.from('debtors').select('*').eq('user_id', user.id),
        supabase.from('creditors').select('*').eq('user_id', user.id),
        supabase.from('savings').select('*').eq('user_id', user.id),
        supabase.from('recurring_expenses').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('shared_budgets').select('*, budget_participants(*)').eq('user_id', user.id)
      ]);

      // 1. DEUDA (250 pts)
      const totalLimit = cards.data?.filter(c => c.type === 'credit').reduce((s, c) => s + (c.credit_limit || 0), 0) || 0;
      const totalCreditDebt = cards.data?.filter(c => c.type === 'credit').reduce((s, c) => s + c.current_balance, 0) || 0;
      const debtRatio = totalLimit === 0 ? 1 : Math.max(0, 1 - (totalCreditDebt / totalLimit));
      const debtScore = Math.round(debtRatio * 250);

      // 2. AHORRO (150 pts)
      const totalSaved = savings.data?.reduce((s, sv) => s + sv.current_balance, 0) || 0;
      const totalTargets = savings.data?.reduce((s, sv) => s + (sv.target_amount || 0), 0) || 0;
      const savingsRatio = totalTargets === 0 ? 1 : Math.min(1, totalSaved / totalTargets);
      const savingsScore = Math.round(savingsRatio * 150);

      // 3. PUNTUALIDAD (200 pts)
      const overdueBudgets = budgets.data?.filter(b => b.due_date && parseISO(b.due_date) < now && !b.budget_participants.every((p:any) => p.is_paid)).length || 0;
      const punctualityScore = Math.max(0, 200 - (overdueBudgets * 50));

      // 4. FLUJO (150 pts)
      const monthIncome = cash.data?.filter(t => t.type === 'ingreso' && isWithinInterval(parseISO(t.date), {start, end})).reduce((s, t) => s + t.amount, 0) || 0;
      const monthExpense = cash.data?.filter(t => t.type === 'egreso' && isWithinInterval(parseISO(t.date), {start, end})).reduce((s, t) => s + t.amount, 0) || 0;
      const flowScore = monthIncome > monthExpense ? 150 : Math.round((monthIncome / (monthExpense || 1)) * 150);

      // 5. GASTOS HORMIGA (100 pts)
      const antojitosId = (await supabase.from('expense_categories').select('id').eq('name', 'Antojitos').single()).data?.id;
      const antojoSpend = cash.data?.filter(t => t.expense_category_id === antojitosId && isWithinInterval(parseISO(t.date), {start, end})).reduce((s, t) => s + t.amount, 0) || 0;
      const antojoRatio = monthIncome === 0 ? 1 : Math.max(0, 1 - (antojoSpend / (monthIncome * 0.15)));
      const hormigaScore = Math.round(antojoRatio * 100);

      // 6. LIQUIDEZ (150 pts)
      const cashBal = cash.data?.reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0) || 0;
      const debitBal = cards.data?.filter(c => c.type === "debit").reduce((s, c) => s + c.current_balance, 0) || 0;
      const totalLiquidity = cashBal + debitBal;
      const liquidityScore = totalCreditDebt === 0 ? 150 : Math.min(150, Math.round((totalLiquidity / totalCreditDebt) * 150));

      const finalScore = debtScore + savingsScore + punctualityScore + flowScore + hormigaScore + liquidityScore;

      // Predicciones
      const daysPassed = Math.max(1, differenceInDays(now, start));
      const dailySpend = monthExpense / daysPassed;
      const daysLeft = differenceInDays(end, now);
      const upcomingRecurring = recurring.data?.reduce((s, r) => s + r.amount, 0) || 0;
      const estimatedEndBalance = totalLiquidity - (dailySpend * daysLeft) - upcomingRecurring;

      let status: FinancialHealth['status'] = 'Regular';
      if (finalScore > 800) status = 'Excelente';
      else if (finalScore > 600) status = 'Bueno';
      else if (finalScore < 400) status = 'Crítico';

      setData({
        score: finalScore,
        status,
        pillars: [
          { name: 'Uso de Deuda', score: debtScore, max: 250, description: 'Qué tanto de tus tarjetas usas.', icon: 'CreditCard' },
          { name: 'Meta de Ahorro', score: savingsScore, max: 150, description: 'Progreso de tus metas.', icon: 'PiggyBank' },
          { name: 'Puntualidad', score: punctualityScore, max: 200, description: 'Pagos hechos a tiempo.', icon: 'Clock' },
          { name: 'Flujo Mensual', score: flowScore, max: 150, description: 'Ganas más de lo que gastas.', icon: 'TrendingUp' },
          { name: 'Gastos Hormiga', score: hormigaScore, max: 100, description: 'Control de antojitos/vicios.', icon: 'Coffee' },
          { name: 'Liquidez', score: liquidityScore, max: 150, description: 'Dinero real vs Deudas.', icon: 'Wallet' },
        ],
        prediction: { estimatedEndBalance, daysUntilRed: estimatedEndBalance < 0 ? Math.floor(totalLiquidity / (dailySpend || 1)) : null, canPayAll: estimatedEndBalance > 0 }
      });
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchHealthData(); }, [user]);
  return { data, isLoading, refetch: fetchHealthData };
}