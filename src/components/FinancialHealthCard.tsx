"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFinancialHealth } from "@/hooks/use-financial-health";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Info, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import DynamicLucideIcon from "./DynamicLucideIcon";

const FinancialHealthCard = () => {
  const { data, isLoading } = useFinancialHealth();
  const [showDetails, setShowDetails] = useState(false);

  if (isLoading || !data) return <Card className="h-[200px] animate-pulse bg-muted" />;

  const statusColors = {
    Excelente: "border-green-200 bg-green-50 text-green-700",
    Bueno: "border-blue-200 bg-blue-50 text-blue-700",
    Regular: "border-orange-200 bg-orange-50 text-orange-700",
    Crítico: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <Card className={cn("overflow-hidden border-2 transition-all shadow-md", statusColors[data.status])}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Tu OinkScore</CardTitle>
          <div className="text-4xl font-black flex items-baseline gap-1">
            {data.score}
            <span className="text-xs opacity-50 font-bold">/ 1000</span>
          </div>
          <Badge className="rounded-full font-bold">{data.status}</Badge>
        </div>
        <div className="h-16 w-16 rounded-full border-4 border-current flex items-center justify-center relative overflow-hidden bg-white/20">
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: `${data.score / 10}%` }}
            className="absolute bottom-0 w-full bg-current opacity-20"
          />
          <span className="text-2xl">🐷</span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 pt-0">
        <div className="bg-white/40 p-3 rounded-2xl border border-white/20">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase opacity-60 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Cierre Estimado
            </span>
            {data.prediction.canPayAll ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <AlertCircle className="h-3.5 w-3.5 text-red-600 animate-pulse" />}
          </div>
          <div className="flex items-end justify-between">
            <div className="text-lg font-black">${data.prediction.estimatedEndBalance.toFixed(2)}</div>
            <div className="text-[9px] font-bold uppercase">
              {data.prediction.canPayAll ? "A salvo" : `Faltan $${Math.abs(data.prediction.estimatedEndBalance).toFixed(0)}`}
            </div>
          </div>
        </div>

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowDetails(!showDetails)}
          className="w-full h-7 text-[10px] font-bold uppercase tracking-wider hover:bg-white/20"
        >
          {showDetails ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
          ¿Por qué este puntaje?
        </Button>

        <AnimatePresence>
          {showDetails && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <div className="grid grid-cols-1 gap-1.5 pt-2">
                {data.pillars.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/30 p-2 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-white/50 rounded-lg">
                        <DynamicLucideIcon iconName={p.icon} className="h-3 w-3" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold leading-none">{p.name}</p>
                        <p className="text-[8px] opacity-60">{p.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black">{p.score} <span className="opacity-40">/ {p.max}</span></p>
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