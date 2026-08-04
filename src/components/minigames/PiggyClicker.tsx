"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const COCHINITO_IMG = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro.png";

const PiggyClicker = () => {
  const [score, setScore] = useState(0);
  const [clicks, setClicks] = useState<{ id: number; x: number; y: number }[]>([]);

  const handleClick = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setScore(s => s + 1);
    const newClick = { id: Date.now(), x, y };
    setClicks(prev => [...prev, newClick]);
    
    setTimeout(() => {
      setClicks(prev => prev.filter(c => c.id !== newClick.id));
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <div className="text-center">
        <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Monedas Oinkash</p>
        <div className="flex items-center justify-center gap-2">
          <Coins className="h-6 w-6 text-yellow-500 fill-yellow-500" />
          <span className="text-4xl font-black text-slate-900">{score}</span>
        </div>
      </div>

      <div className="relative cursor-pointer select-none" onClick={handleClick}>
        <AnimatePresence>
          {clicks.map(c => (
            <motion.div
              key={c.id}
              initial={{ opacity: 1, y: c.y - 20, x: c.x }}
              animate={{ opacity: 0, y: c.y - 100 }}
              exit={{ opacity: 0 }}
              className="absolute pointer-events-none text-xl font-black text-yellow-600 z-10"
            >
              +1 🪙
            </motion.div>
          ))}
        </AnimatePresence>
        
        <motion.img
          src={COCHINITO_IMG}
          alt="Cochinito"
          className="h-48 w-48 object-contain drop-shadow-2xl"
          whileTap={{ scale: 0.9, rotate: -5 }}
          whileHover={{ scale: 1.05 }}
        />
      </div>

      <p className="text-sm font-medium text-slate-500 italic">¡Cada click es un peso virtual para tu ahorro!</p>
      
      <Button variant="outline" className="rounded-xl font-bold" onClick={() => setScore(0)}>Reiniciar</Button>
    </div>
  );
};

export default PiggyClicker;