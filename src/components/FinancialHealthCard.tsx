"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useFinancialHealth } from "@/hooks/use-financial-health";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Info, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const FinancialHealthCard = () => {
  const { data, isLoading } = useFinancialHealth();

  if (isLoading || !data) return (
    <Card className="h-[280px] flex items-center justify-center animate-pulse">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 bg-muted rounded-full mx-auto" />
        <p className="text-xs text-muted-foreground">Calculando OinkScore...</p>
      </div>
    </Card>
  );

  const scoreColors = {
    Excelente: "text-green-600 bg-green-50 border-green-200",
    Bueno: "text-blue-600 bg-blue-50 border-blue-200",
    Regular: "text-orange-600 bg-orange-50 border-orange-200",
    Crítico: "text-red-600 bg-red-50 border-red-200",
  };

  return (
    <Card className={cn("overflow-hidden border-2 transition-all shadow-lg", scoreColors[data.status])}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">OinkScore</CardTitle>
          <div className="text-4xl font-black mt-1 flex items-baseline gap-1">
            {data.score}
            <span className="text-xs opacity-50 font-bold">/ 1000</span>
          </div>
          <Badge className={cn("mt-2 rounded-full px-3 py-0.5 text-[10px] font-bold", 
            data.status === 'Excelente' ? "bg-green-500 text-white" : 
            data.status === 'Bueno' ? "bg-blue-500 text-white" :
            data.status === 'Regular' ? "bg-orange-500 text-white" : "bg-red-500 text-white"
          )}>
            Nivel: {data.status}
          </Badge>
        </div>
        <div className="h-16 w-16 rounded-full border-4 border-current flex items-center justify-center relative overflow-hidden">
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: `${data.score / 10}%` }}
            className="absolute bottom-0 w-full bg-current opacity-20"
          />
          <span className="text-xl">🐷</span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 pt-2">
        {/* Predicción de Fin de Mes */}
        <div className="bg-white/50 p-3 rounded-2xl border border-white/30 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase opacity-60 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Cierre Estimado
            </span>
            {data.prediction.canPayAll ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 animate-pulse" />
            )}
          </div>
          <div className="flex items-end justify-between">
            <div className="text-xl font-black">${data.prediction.estimatedEndBalance.toFixed(2)}</div>
            <div className="text-[10px] font-bold text-right">
              {data.prediction.canPayAll ? (
                <span className="text-green-700">¡Libras el mes!</span>
              ) : (
                <span className="text-red-700">Faltan ${Math.abs(data.prediction.estimatedEndBalance).toFixed(0)}</span>
              )}
            </div>
          </div>
          {data.prediction.daysUntilRed && (
            <p className="text-[9px] mt-2 font-bold text-red-600 uppercase tracking-tighter">
              ⚠️ Alerta: Te quedarás sin dinero en aprox. {data.prediction.daysUntilRed} días.
            </p>
          )}
        </div>

        {/* Consejos/Alertas Dinámicas */}
        <div className="space-y-2">
          {data.smartTips.slice(0, 2).map((tip, i) => (
            <div key={i} className="flex gap-2 items-start bg-white/40 p-2 rounded-xl text-[10px] font-bold border border-white/20">
              <Info className="h-3 w-3 shrink-0 mt-0.5 text-current" />
              <p>{tip}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

import { Badge } from "./ui/badge";
export default FinancialHealthCard;