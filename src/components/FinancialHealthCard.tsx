"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFinancialHealth } from "@/hooks/use-financial-health";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Info, Calendar, Sparkles, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import DynamicLucideIcon from "./DynamicLucideIcon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const FinancialHealthCard = () => {
  const { data, isLoading } = useFinancialHealth();
  const [showDetails, setShowDetails] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  if (isLoading || !data) return <Card className="h-[200px] animate-pulse bg-muted rounded-[2.5rem]" />;

  const statusColors = {
    Excelente: "bg-gradient-to-br from-green-50 to-emerald-100 text-green-700 border-green-200",
    Bueno: "bg-gradient-to-br from-blue-50 to-sky-100 text-blue-700 border-blue-200",
    Regular: "bg-gradient-to-br from-orange-50 to-peach-100 text-orange-700 border-orange-200",
    Crítico: "bg-gradient-to-br from-red-50 to-pink-100 text-red-700 border-red-200",
  };

  return (
    <Card className={cn("overflow-hidden border-2 shadow-xl rounded-[2.5rem] transition-all", statusColors[data.status])}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 animate-pulse" />
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">OinkScore</CardTitle>
          </div>
          <div className="text-5xl font-black flex items-baseline gap-1 tracking-tighter">
            {data.score}
            <span className="text-xs opacity-50 font-bold">/1000</span>
          </div>
          <Badge className="rounded-full font-bold px-3 bg-white/50 text-current border-none shadow-sm hover:bg-white/80 transition-colors">
            {data.status} ✨
          </Badge>
        </div>
        <div className="h-20 w-20 rounded-full border-4 border-white/50 flex items-center justify-center relative overflow-hidden bg-white/30 shadow-inner">
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: `${data.score / 10}%` }}
            className="absolute bottom-0 w-full bg-current opacity-20"
          />
          <span className="text-3xl filter drop-shadow-sm">🐷</span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 pt-2">
        <div className="bg-white/60 p-4 rounded-[2rem] border border-white/40 shadow-sm relative group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase opacity-60 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Cierre Estimado 🧸
            </span>
            <button 
              onClick={() => setShowExplanation(!showExplanation)}
              className="text-current/50 hover:text-current transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-black tracking-tight">${data.prediction.estimatedEndBalance.toFixed(2)}</div>
            <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", data.prediction.canPayAll ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
              {data.prediction.canPayAll ? "¡Todo tranqui! ✅" : "¡Ojo aquí! ⚠️"}
            </div>
          </div>

          <AnimatePresence>
            {showExplanation && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-3 p-3 bg-white/80 rounded-2xl text-[10px] leading-relaxed border border-dashed border-current/20 italic"
              >
                <p className="font-bold mb-1">¿Cómo se calcula? 🧮</p>
                1. Sumamos tu <b>Efectivo + Débito</b> actual.<br/>
                2. Restamos lo que <b>gastarás</b> según tu promedio diario de este mes.<br/>
                3. Restamos tus <b>Gastos Fijos</b> (Netflix, renta, etc) que faltan por pagar.<br/>
                <p className="mt-1 font-bold">Resultado: Lo que te sobrará (o faltará) el último día del mes.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowDetails(!showDetails)}
          className="w-full h-8 text-[10px] font-bold uppercase tracking-widest hover:bg-white/30 rounded-full"
        >
          {showDetails ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
          Detalles de mi salud 🌈
        </Button>

        <AnimatePresence>
          {showDetails && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-2 overflow-hidden px-1"
            >
              <div className="grid grid-cols-1 gap-2 pt-2">
                {data.pillars.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/40 p-2.5 rounded-[1.5rem] border border-white/20 hover:bg-white/60 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/80 rounded-xl shadow-sm">
                        <DynamicLucideIcon iconName={p.icon} className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold leading-none">{p.name}</p>
                        <p className="text-[8px] opacity-60 font-medium">{p.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black">{p.score}<span className="opacity-40 font-bold ml-0.5">/{p.max}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export default FinancialHealthCard;