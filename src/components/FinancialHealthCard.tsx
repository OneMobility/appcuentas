"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useFinancialHealth } from "@/hooks/use-financial-health";
import { motion } from "framer-motion";
import { ShieldCheck, AlertTriangle, Zap, TrendingUp, TrendingDown, Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const FinancialHealthCard = () => {
  const { data, isLoading } = useFinancialHealth();

  if (isLoading || !data) return (
    <Card className="h-48 flex items-center justify-center animate-pulse">
      <p className="text-sm text-muted-foreground">Analizando tus finanzas...</p>
    </Card>
  );

  const colors = {
    excellent: "text-green-600 bg-green-50 border-green-200",
    good: "text-blue-600 bg-blue-50 border-blue-200",
    warning: "text-orange-600 bg-orange-50 border-orange-200",
    critical: "text-red-600 bg-red-50 border-red-200",
  };

  const icons = {
    excellent: <ShieldCheck className="h-8 w-8" />,
    good: <Zap className="h-8 w-8" />,
    warning: <AlertTriangle className="h-8 w-8" />,
    critical: <AlertTriangle className="h-8 w-8" />,
  };

  return (
    <Card className={cn("overflow-hidden border-2 transition-all", colors[data.status])}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold uppercase tracking-wider opacity-70">Salud Financiera</CardTitle>
          <div className="text-2xl font-black mt-1">Score: {data.score}/100</div>
        </div>
        {icons[data.status]}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Semáforo Visual */}
        <div className="relative h-3 w-full bg-black/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${data.score}%` }}
            className={cn(
              "absolute h-full rounded-full",
              data.score > 80 ? "bg-green-500" : data.score > 50 ? "bg-yellow-500" : "bg-red-500"
            )}
          />
        </div>

        {/* Predicción */}
        <div className="bg-white/40 p-3 rounded-2xl border border-white/20">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase opacity-60">Predicción Fin de Mes</span>
            {data.prediction.trend === 'up' ? <TrendingUp className="h-3 w-3 text-green-600" /> : <TrendingDown className="h-3 w-3 text-red-600" />}
          </div>
          <div className="text-lg font-bold">${data.prediction.estimatedEndOfMonthBalance.toFixed(2)}</div>
          <p className="text-[9px] italic opacity-70">Estimado basado en tus gastos recurrentes y hábitos actuales.</p>
        </div>

        {/* Consejos (Uno aleatorio) */}
        {data.tips.length > 0 && (
          <div className="flex gap-2 items-start bg-white/60 p-2 rounded-xl text-[10px] font-medium border border-white/40">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            <p>{data.tips[Math.floor(Math.random() * data.tips.length)]}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinancialHealthCard;