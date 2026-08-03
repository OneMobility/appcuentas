"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/context/SessionContext';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, differenceInDays } from 'date-fns';

export interface FinancialHealth {
  score: number; // 0 - 1000
  status: 'Excelente' | 'Bueno' | 'Regular' | 'Crítico';
  metrics: {
    debtImpact: number;      // 300 pts
    savingsImpact: number;   // 200 pts
    punctualityImpact: number;// 200 pts
    flowImpact: number;      // 150 pts
    liquidityImpact: number; // 150 pts
  };
  prediction: {
    estimatedEndBalance: number;
    daysUntilRed: number | null; // Días antes de quedarse sin dinero
    canPayAll: boolean;
  };
  smartTips: string[];
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
      const startLastMonth = startOfMonth(subMonths(now, 1));
      const endLastMonth = endOfMonth(subMonths(now, 1));

      const [cards, cash, debtors, creditors, savings, recurring, budgets] = await Promise.all([
        supabase.from('cards').select('*').eq('user_id', user.id),
        supabase.from('cash_transactions').select('*').eq('user_id', user.id),
        supabase.from('debtors').select('*').eq('user_id', user.id),
        supabase.from('creditors').select('*').eq('user_id', user.id),
        supabase.from('savings').select('*').eq('user_id', user.id),
        supabase.from('recurring_expenses').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('shared_budgets').select('*, budget_participants(*)').eq('user_id', user.id)
      ]);

      // --- CÁLCULO DE PILARES (OinkScore) ---
      
      // 1. Deuda (300 pts): Deuda vs Límite Total
      const totalLimit = cards.data?.filter(c => c.type === 'credit').reduce((s, c) => s + (c.credit_limit || 0), 0) || 0;
      const totalCreditDebt = cards.data?.filter(c => c.type === 'credit').reduce((s, c) => s + c.current_balance, 0) || 0;
      const debtRatio = totalLimit === 0 ? 1 : Math.max(0, 1 - (totalCreditDebt / totalLimit));
      const debtImpact = Math.round(debtRatio * 300);

      // 2. Ahorro (200 pts): Progreso de metas
      const totalSaved = savings.data?.reduce((s, sv) => s + sv.current_balance, 0) || 0;
      const totalTargets = savings.data?.reduce((s, sv) => s + (sv.target_amount || 0), 0) || 0;
      const savingsRatio = totalTargets === 0 ? 1 : Math.min(1, totalSaved / totalTargets);
      const savingsImpact = Math.round(savingsRatio * 200);

      // 3. Puntualidad (200 pts): Presupuestos y Deudas vencidas
      const overdueBudgets = budgets.data?.filter(b => b.due_date && parseISO(b.due_date) < now && !b.budget_participants.every((p:any) => p.is_paid)).length || 0;
      const punctualityImpact = Math.max(0, 200 - (overdueBudgets * 50));

      // 4. Flujo (150 pts): Ingresos vs Gastos del mes
      const monthIncome = cash.data?.filter(t => t.type === 'ingreso' && isWithinInterval(parseISO(t.date), {start, end})).reduce((s, t) => s + t.amount, 0) || 0;
      const monthExpense = cash.data?.filter(t => t.type === 'egreso' && isWithinInterval(parseISO(t.date), {start, end})).reduce((s, t) => s + t.amount, 0) || 0;
      const flowImpact = monthIncome > monthExpense ? 150 : Math.round((monthIncome / (monthExpense || 1)) * 150);

      // 5. Liquidez (150 pts): Efectivo + Débito vs Deuda Próxima
      const cashBal = cash.data?.reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0) || 0;
      const debitBal = cards.data?.filter(c => c.type === "debit").reduce((s, c) => s + c.current_balance, 0) || 0;
      const totalLiquidity = cashBal + debitBal;
      const liquidityImpact = totalCreditDebt === 0 ? 150 : Math.min(150, Math.round((totalLiquidity / totalCreditDebt) * 150));

      const finalScore = debtImpact + savingsImpact + punctualityImpact + flowImpact + liquidityImpact;

      // --- PREDICCIONES ---
      const daysInMonth = differenceInDays(end, start) + 1;
      const daysPassed = Math.max(1, differenceInDays(now, start));
      const dailySpend = monthExpense / daysPassed;
      const daysLeft = differenceInDays(end, now);
      
      const upcomingRecurring = recurring.data?.reduce((s, r) => s + r.amount, 0) || 0;
      const estimatedEndBalance = totalLiquidity - (dailySpend * daysLeft) - upcomingRecurring;
      
      const daysUntilRed = estimatedEndBalance < 0 ? Math.floor(totalLiquidity / (dailySpend || 1)) : null;

      // --- CONSEJOS INTELIGENTES ---
      const tips = [];
      if (monthExpense > monthIncome) tips.push(`⚠️ Alerta: Estás gastando más de lo que ganas ($${(monthExpense - monthIncome).toFixed(2)} de diferencia).`);
      
      // Análisis de categorías "hormiga" (Antojitos, Apps, etc)
      const antojitosId = (await supabase.from('expense_categories').select('id').eq('name', 'Antojitos').single()).data?.id;
      const antojoSpend = cash.data?.filter(t => t.expense_category_id === antojitosId && isWithinInterval(parseISO(t.date), {start, end})).reduce((s, t) => s + t.amount, 0) || 0;
      if (antojoSpend > monthIncome * 0.1) tips.push(`🍦 Ojo: Tus "Antojitos" representan el ${(antojoSpend/monthIncome*100).toFixed(1)}% de tu ingreso. ¡Cuidado ahí!`);

      if (totalCreditDebt > totalLimit * 0.7) tips.push(`💳 Prioridad: Tu uso de crédito es crítico (${(totalCreditDebt/totalLimit*100).toFixed(0)}%). Paga antes del corte.`);

      let status: FinancialHealth['status'] = 'Regular';
      if (finalScore > 800) status = 'Excelente';
      else if (finalScore > 600) status = 'Bueno';
      else if (finalScore < 400) status = 'Crítico';

      setData({
        score: finalScore,
        status,
        metrics: { debtImpact, savingsImpact, punctualityImpact, flowImpact, liquidityImpact },
        prediction: { estimatedEndBalance, daysUntilRed, canPayAll: estimatedEndBalance > 0 },
        smartTips: tips
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, [user]);

  return { data, isLoading, refetch: fetchHealthData };
}