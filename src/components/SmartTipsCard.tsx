"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sparkles, RefreshCw, Lightbulb, Brain, Target, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getRandomTip, OINKASH_TIPS, OinkashTip } from "@/utils/oinkash-tips";

const CATEGORIES = [
  { name: 'Hábito', icon: Brain, color: 'text-purple-600 bg-purple-50' },
  { name: 'Ahorro', icon: Target, color: 'text-blue-600 bg-blue-50' },
  { name: 'Psicología', icon: Lightbulb, color: 'text-yellow-600 bg-yellow-50' },
  { name: 'Seguridad', icon: ShieldCheck, color: 'text-green-600 bg-green-50' },
];

const SmartTipsCard = () => {
  const [tip, setTip] = useState<OinkashTip>(getRandomTip());

  const rotateTip = () => {
    setTip(getRandomTip());
  };

  useEffect(() => {
    // Rotación cada 30 segundos (30000ms)
    const interval = setInterval(rotateTip, 30000);
    return () => clearInterval(interval);
  }, []);

  const category = CATEGORIES.find(c => c.name === tip.cat);
  const CatIcon = category?.icon || Lightbulb;
  const catColor = category?.color || '';

  return (
    <Card className="border-none shadow-soft bg-white overflow-hidden relative group h-full">
      <CardHeader className="p-5 pb-0 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Consejo Oinkash</CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={rotateTip}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-5 pt-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={tip.text}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", catColor)}>
              <CatIcon className="h-3.5 w-3.5" />
              {tip.cat}
            </div>
            <p className="text-base font-semibold text-slate-700 leading-snug italic">
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
          transition={{ duration: 30, ease: 'linear' }}
          className="h-full bg-indigo-500"
        />
      </div>
    </Card>
  );
};

export default SmartTipsCard;