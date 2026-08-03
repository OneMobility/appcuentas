"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sparkles, RefreshCw, Lightbulb, Brain, Target, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = [
  { name: 'Hábito', icon: Brain, color: 'text-purple-600 bg-purple-50' },
  { name: 'Ahorro', icon: Target, color: 'text-blue-600 bg-blue-50' },
  { name: 'Psicología', icon: Lightbulb, color: 'text-yellow-600 bg-yellow-50' },
  { name: 'Seguridad', icon: ShieldCheck, color: 'text-green-600 bg-green-50' },
];

const TIPS = [
  { cat: 'Hábito', text: 'Aplica la regla de las 48 horas: si quieres algo, espera 2 días. Si aún lo quieres, cómpralo.' },
  { cat: 'Ahorro', text: '¿Sabías que preparar café en casa te ahorra hasta $1,200 al mes? Tu OinkScore te lo agradecerá.' },
  { cat: 'Psicología', text: 'No ahorres lo que queda después de gastar, gasta lo que queda después de ahorrar.' },
  { cat: 'Seguridad', text: 'Revisa tus suscripciones activas. A veces pagamos por cosas que ya ni abrimos.' },
  { cat: 'Hábito', text: 'Registra tus gastos en el momento. La memoria es traicionera, Oinkash no.' },
  { cat: 'Ahorro', text: 'El mejor momento para ahorrar fue ayer, el segundo mejor es hoy.' },
  { cat: 'Psicología', text: 'Tu valor como persona no depende de tu saldo bancario, pero tu tranquilidad sí.' },
];

const SmartTipsCard = () => {
  const [tip, setTip] = useState(TIPS[0]);
  const [index, setIndex] = useState(0);

  const rotateTip = () => {
    const next = (index + 1) % TIPS.length;
    setIndex(next);
    setTip(TIPS[next]);
  };

  useEffect(() => {
    const interval = setInterval(rotateTip, 15000);
    return () => clearInterval(interval);
  }, [index]);

  const CatIcon = CATEGORIES.find(c => c.name === tip.cat)?.icon || Lightbulb;
  const catColor = CATEGORIES.find(c => c.name === tip.cat)?.color || '';

  return (
    <Card className="border-none shadow-md bg-white overflow-hidden relative group">
      <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Consejo Oinkash</CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={rotateTip}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={tip.text}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase", catColor)}>
              <CatIcon className="h-3 w-3" />
              {tip.cat}
            </div>
            <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
              "{tip.text}"
            </p>
          </motion.div>
        </AnimatePresence>
      </CardContent>
      <div className="absolute bottom-0 left-0 h-1 bg-indigo-500/10 w-full">
        <motion.div 
          key={tip.text}
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 15, ease: 'linear' }}
          className="h-full bg-indigo-500"
        />
      </div>
    </Card>
  );
};

export default SmartTipsCard;