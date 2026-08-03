"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFinancialHealth } from "@/hooks/use-financial-health";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Sparkles, HelpCircle, Info, TrendingUp, Wallet, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import DynamicLucideIcon from "./DynamicLucideIcon";

const FinancialHealthCard = () => {
  const { data, isLoading } = useFinancialHealth();
  const [showDetails, setShowDetails] = useState(false);
  const [showLogic, setShowLogic] = useState(false);

  if (isLoading || !data) return <div className="h-64 w-full animate-pulse bg-muted rounded-3xl" />;

  return (
    <Card className="overflow-hidden border-none shadow-soft rounded-[2rem] bg-white">
      <div className={cn(
        "p-6 text-white transition-colors duration-500",
        data.status === 'Excelente' ? "bg-indigo-600" : 
        data.status === 'Bueno' ? "bg-blue-500" : 
        data.status === 'Regular' ? "bg-amber-500" : "bg-rose-500"
      )}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Mi Salud Financiera
            </p>
            <h2 className="text-4xl font-black">{data.score}</h2>
          </div>
          <Badge className="bg-white/20 text-white border-none backdrop-blur-md">
            {data.status}
          </Badge>
        </div>
        
        <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase opacity-80 flex items-center gap-1">
               Predicción de Cierre 🔮
            </span>
            <button onClick={() => setShowLogic(!showLogic)} className="opacity-60 hover:opacity-100">
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
          <p className="text-2xl font-bold">${data.prediction.estimatedEndBalance.toFixed(2)}</p>
          <p className="text-[10px] opacity-80 mt-1">Lo que te sobrará el último día del mes.</p>

          <AnimatePresence>
            {showLogic && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 pt-3 border-t border-white/10 text-[10px] space-y-2 overflow-hidden"
              >
                <p className="font-bold">¿Cómo calculamos esto? 🤔</p>
                <div className="space-y-1 opacity-90">
                  <p className="flex justify-between"><span>💰 Tu dinero actual (Efectivo + Débito):</span> <b>+$...</b></p>
                  <p className="flex justify-between"><span>📉 Gasto diario promedio:</span> <b>-$...</b></p>
                  <p className="flex justify-between"><span>📅 Suscripciones/Fijos pendientes:</span> <b>-$...</b></p>
                  <p className="border-t border-white/20 pt-1 font-bold">Total = Saldo que proyectas tener.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <CardContent className="p-4">
        <Button 
          variant="ghost" 
          onClick={() => setShowDetails(!showDetails)}
          className="w-full text-xs font-bold text-muted-foreground flex justify-between"
        >
          Ver desglose de puntos
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        <AnimatePresence>
          {showDetails && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 space-y-3 overflow-hidden"
            >
              {data.pillars.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center text-primary">
                    <DynamicLucideIcon iconName={p.icon} className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] font-bold mb-1">
                      <span>{p.name}</span>
                      <span>{p.score}/{p.max}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(p.score / p.max) * 100}%` }}
                        className="h-full bg-primary"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export default FinancialHealthCard;