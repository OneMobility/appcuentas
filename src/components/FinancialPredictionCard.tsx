"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useFinancialHealth } from "@/hooks/use-financial-health";
import { HelpCircle, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const FinancialPredictionCard = () => {
  const { data, isLoading } = useFinancialHealth();
  const [showLogic, setShowLogic] = useState(false);

  if (isLoading || !data) return <div className="h-full w-full animate-pulse bg-muted rounded-[2rem]" />;

  const isNegative = data.prediction.estimatedEndBalance < 0;

  return (
    <Card className="overflow-hidden border-none shadow-soft rounded-[2rem] bg-white h-full">
      <div className={cn(
        "p-5 text-white flex flex-col justify-between h-full",
        isNegative ? "bg-rose-600" : "bg-emerald-600"
      )}>
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-80 flex items-center gap-1">
               Predicción de Cierre 🔮
            </span>
            <button onClick={() => setShowLogic(!showLogic)} className="opacity-60 hover:opacity-100 transition-opacity">
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
          
          <p className="text-3xl font-black mb-1">${data.prediction.estimatedEndBalance.toLocaleString()}</p>
          <p className="text-[11px] font-medium opacity-80 leading-tight">
            Es el saldo que proyectamos que tendrás al finalizar el mes calendario.
          </p>
        </div>

        <div className="mt-4 bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
          <AnimatePresence mode="wait">
            {!showLogic ? (
              <motion.div 
                key="summary"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                {isNegative ? (
                  <>
                    <AlertTriangle className="h-8 w-8 text-rose-200" />
                    <p className="text-xs font-bold leading-tight">
                      ¡Cuidado! Tu ritmo de gasto indica que podrías quedar en rojo en {data.prediction.daysUntilRed || 'pocos'} días.
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-emerald-200" />
                    <p className="text-xs font-bold leading-tight">
                      ¡Vas bien! Tu flujo de caja es positivo y podrás cubrir tus gastos fijos este mes.
                    </p>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="logic"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="text-[10px] space-y-2"
              >
                <p className="font-black uppercase tracking-wider mb-1">¿Cómo lo calculamos?</p>
                <div className="space-y-1 opacity-90 font-medium">
                  <p className="flex justify-between"><span>💰 Dinero Actual:</span> <b>+$...</b></p>
                  <p className="flex justify-between"><span>📉 Gasto Diario Prom:</span> <b>-$...</b></p>
                  <p className="flex justify-between"><span>📅 Pagos Fijos Restantes:</span> <b>-$...</b></p>
                  <div className="border-t border-white/20 pt-1 flex justify-between font-black">
                    <span>Proyección Final:</span>
                    <span>${data.prediction.estimatedEndBalance.toFixed(0)}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  );
};

export default FinancialPredictionCard;