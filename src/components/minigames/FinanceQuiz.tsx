"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, Trophy, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const QUESTIONS = [
  {
    q: "¿Cuál es la regla recomendada para el ahorro?",
    options: ["50/30/20", "90/5/5", "100/0/0"],
    correct: 0,
    info: "50% necesidades, 30% deseos, 20% ahorro."
  },
  {
    q: "¿Qué es un 'gasto hormiga'?",
    options: ["Un gasto muy grande", "Pequeños gastos diarios que suman mucho", "Comprar comida para hormigas"],
    correct: 1,
    info: "Cafés, snacks o propinas que parecen poco pero afectan tu presupuesto."
  },
  {
    q: "Si quieres comprar algo caro, ¿cuánto tiempo deberías esperar?",
    options: ["1 hora", "48 horas", "Nunca comprarlo"],
    correct: 1,
    info: "La regla de las 48h ayuda a evitar compras impulsivas."
  }
];

const FinanceQuiz = () => {
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const handleAnswer = (idx: number) => {
    setSelected(idx);
    if (idx === QUESTIONS[step].correct) setScore(s => s + 1);
    
    setTimeout(() => {
      if (step < QUESTIONS.length - 1) {
        setStep(s => s + 1);
        setSelected(null);
      } else {
        setShowResult(true);
      }
    }, 1500);
  };

  if (showResult) return (
    <div className="text-center p-6 space-y-4">
      <Trophy className="h-16 w-16 text-yellow-500 mx-auto animate-bounce" />
      <h3 className="text-2xl font-black">¡Quiz Terminado!</h3>
      <p className="text-slate-500 font-bold">Aciertos: {score} de {QUESTIONS.length}</p>
      <Button className="rounded-xl w-full" onClick={() => { setStep(0); setScore(0); setShowResult(false); setSelected(null); }}>
        <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
      </Button>
    </div>
  );

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">Pregunta {step + 1}/{QUESTIONS.length}</span>
        <span className="text-[10px] font-black uppercase text-emerald-500">Puntos: {score}</span>
      </div>

      <h3 className="text-lg font-black leading-tight">{QUESTIONS[step].q}</h3>

      <div className="grid gap-3">
        {QUESTIONS[step].options.map((opt, i) => (
          <Button
            key={i}
            variant={selected === null ? "outline" : (i === QUESTIONS[step].correct ? "default" : (selected === i ? "destructive" : "outline"))}
            className={cn(
              "h-14 rounded-2xl font-bold justify-start px-6 transition-all",
              selected === i && "scale-[1.02]"
            )}
            onClick={() => selected === null && handleAnswer(i)}
            disabled={selected !== null}
          >
            {selected !== null && i === QUESTIONS[step].correct && <CheckCircle2 className="h-4 w-4 mr-2" />}
            {selected === i && i !== QUESTIONS[step].correct && <XCircle className="h-4 w-4 mr-2" />}
            {opt}
          </Button>
        ))}
      </div>

      <AnimatePresence>
        {selected !== null && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs font-medium text-slate-600">
            💡 {QUESTIONS[step].info}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FinanceQuiz;