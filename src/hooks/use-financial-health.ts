"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/context/SessionContext';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, addMonths, format } from 'date-fns';

export interface FinancialHealth {
  score: number; // 0 - 100
  status: 'excellent' | 'good' | 'warning' | 'critical';
  metrics: {
    liquidityRatio: number;
    debtRatio: number;
    savingsProgress: number;
    punctualityScore: number;
  };
  prediction: {
    estimatedEndOfMonthBalance: number;
    trend: 'up' | 'down' | 'stable';
  };
  tips: string[];
}

export function useFinancialHealth() {
  const { user } = useSession();
  const [data, setData] = useState<FinancialHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHealthData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // 1. Obtener todos los datos necesarios
      const [cards, cash, debts, savings, recurring] = await Promise.all([
        supabase.from('cards').select('*').eq('user_id', user.id),
        supabase.from('cash_transactions').select('*').eq('user_id', user.id),
        supabase.from('debtors').select('*').eq('user_id', user.id),
        supabase.from('savings').select('*').eq('user_id', user.id),
        supabase.from('recurring_expenses').select('*').eq('user_id', user.id).eq('is_active', true)
      ]);

      const cardsData = cards.data || [];
      const cashTxs = cash.data || [];
      const savingsData = savings.data || [];
      const recurringData = recurring.data || [];

      // --- CÁLCULOS DE SCORE ---

      // A. Liquidez (Dinero disponible vs Deudas inmediatas)
      const cashBalance = cashTxs.reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0);
      const debitBalance = cardsData.filter(c => c.type === "debit").reduce((s, c) => s + c.current_balance, 0);
      const creditDebt = cardsData.filter(c => c.type === "credit").reduce((s, c) => s + c.current_balance, 0);
      
      const totalAvailable = cashBalance + debitBalance;
      const liquidityRatio = creditDebt === 0 ? 100 : Math.min(100, (totalAvailable / creditDebt) * 50);

      // B. Uso de Crédito (Deuda vs Límite)
      const totalCreditLimit = cardsData.filter(c => c.type === "credit").reduce((s, c) => s + (c.credit_limit || 0), 0);
      const debtRatio = totalCreditLimit === 0 ? 100 : Math.max(0, 100 - (creditDebt / totalCreditLimit * 100));

      // C. Progreso de Ahorro
      const totalSavings = savingsData.reduce((s, sv) => s + sv.current_balance, 0);
      const totalTargets = savingsData.reduce((s, sv) => s + (sv.target_amount || 0), 0);
      const savingsProgress = totalTargets === 0 ? 100 : Math.min(100, (totalSavings / totalTargets) * 100);

      // D. Puntualidad (Simulado basado en deudas de tarjetas y recurring)
      const punctualityScore = 90; // Por ahora base 90

      // Score Final (Promedio ponderado)
      const finalScore = Math.round(
        (liquidityRatio * 0.3) + 
        (debtRatio * 0.3) + 
        (savingsProgress * 0.2) + 
        (punctualityScore * 0.2)
      );

      // --- PREDICCIONES ---
      const now = new Date();
      const endMonth = endOfMonth(now);
      const daysLeft = endMonth.getDate() - now.getDate();
      
      // Gasto promedio diario (últimos 30 días)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const recentExpenses = cashTxs.filter(t => t.type === 'egreso' && parseISO(t.date) >= thirtyDaysAgo);
      const dailyAverage = recentExpenses.reduce((s, t) => s + t.amount, 0) / 30;
      
      // Gastos recurrentes que faltan en el mes
      const upcomingRecurring = recurringData.filter(r => {
        const nextDate = parseISO(r.next_date);
        return isWithinInterval(nextDate, { start: now, end: endMonth });
      }).reduce((s, r) => s + r.amount, 0);

      const estimatedEndOfMonthBalance = totalAvailable - (dailyAverage * daysLeft) - upcomingRecurring;

      // --- CONSEJOS DINÁMICOS ---
      const tips = [];
      if (debtRatio < 50) tips.push("Tu deuda de crédito es alta. Trata de pagar más del mínimo para evitar intereses.");
      if (savingsProgress < 20) tips.push("¡No olvides tus metas! Un pequeño ahorro hoy hace la diferencia mañana.");
      if (estimatedEndOfMonthBalance < 0) tips.push("¡Cuidado! A este ritmo podrías terminar el mes en números rojos.");
      if (finalScore > 80) tips.push("¡Excelente salud financiera! Sigue así.");

      let status: FinancialHealth['status'] = 'good';
      if (finalScore > 85) status = 'excellent';
      else if (finalScore < 60) status = 'warning';
      if (finalScore < 40) status = 'critical';

      setData({
        score: finalScore,
        status,
        metrics: { liquidityRatio, debtRatio, savingsProgress, punctualityScore },
        prediction: {
          estimatedEndOfMonthBalance,
          trend: estimatedEndOfMonthBalance > totalAvailable ? 'up' : 'down'
        },
        tips
      });
    } catch (e) {
      console.error("Health calculation error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, [user]);

  return { data, isLoading, refetch: fetchHealthData };
}