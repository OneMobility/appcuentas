"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFinancialHealth } from "@/hooks/use-financial-health";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import DynamicLucideIcon from "./DynamicLucideIcon";

const FinancialHealthCard = () => {
  const { data, isLoading } = useFinancialHealth();
  const [showDetails, setShowDetails] = useState(false);

  if (isLoading || !data) return <div className="h-48 w-full animate-pulse bg-muted rounded-[2rem]" />;

  return (
    <Card className="overflow-hidden border-none shadow-soft rounded-[2rem] bg-white">
      <div className={cn(
        "p-8 text-white transition-colors duration-500 relative",
        data.status === 'Excelente' ? "bg-indigo-600" : 
        data.status === 'Bueno' ? "bg-blue-500" : 
        data.status === 'Regular' ? "bg-amber-500" : "bg-rose-500"
      )}>
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Sparkles className="h-32 w-32 rotate-12" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80 flex items-center gap-1 mb-2">
              <Sparkles className="h-3 w-3" /> Mi Salud Financiera
            </p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-6xl font-black">{data.score}</h2>
              <span className="text-xl font-bold opacity-60">/ 1000</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center md:items-end gap-3">
            <Badge className="bg-white/20 text-white border-none backdrop-blur-md px-6 py-2 text-lg font-black rounded-2xl">
              {data.status}
            </Badge>
            <p className="text-xs font-medium opacity-80 max-w-[200px] text-center md:text-right">
              {data.status === 'Excelente' ? "¡Eres un maestro de las finanzas! Sigue así." : 
               data.status === 'Bueno' ? "Vas por muy buen camino. Ajusta detalles para llegar al tope." :
               data.status === 'Regular' ? "Hay áreas de oportunidad. Revisa tus gastos hormiga." : 
               "¡Alerta roja! Es momento de tomar medidas drásticas."}
            </p>
          </div>
        </div>
      </div>

      <CardContent className="p-6">
        <Button 
          variant="ghost" 
          onClick={() => setShowDetails(!showDetails)}
          className="w-full text-xs font-black uppercase tracking-widest text-slate-400 flex justify-between hover:bg-slate-50 rounded-xl"
        >
          Ver desglose de pilares
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        <AnimatePresence>
          {showDetails && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 overflow-hidden"
            >
              {data.pillars.map((p, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                      <DynamicLucideIcon iconName={p.icon} className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{p.name}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold mb-1 ml-1">
                    <span>{p.score} <span className="text-[10px] opacity-40">pts</span></span>
                    <span className="opacity-40">{p.max}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(p.score / p.max) * 100}%` }}
                      className={cn(
                        "h-full transition-colors",
                        (p.score / p.max) > 0.8 ? "bg-emerald-500" : (p.score / p.max) > 0.5 ? "bg-amber-500" : "bg-rose-500"
                      )}
                    />
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