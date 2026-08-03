"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { X, Send, Bot, Sparkles, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AIChatAssistant = () => {
  const { user } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '¡Hola! Soy tu asistente Oinkash. ¿En qué puedo ayudarte con tus finanzas hoy? 🐷' }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const fetchFinancialContext = async () => {
    if (!user) return {};
    
    // Obtenemos un resumen rápido de los datos para la IA
    const [cards, cash, debtors, creditors] = await Promise.all([
      supabase.from('cards').select('*').eq('user_id', user.id),
      supabase.from('cash_transactions').select('*').eq('user_id', user.id),
      supabase.from('debtors').select('*').eq('user_id', user.id),
      supabase.from('creditors').select('*').eq('user_id', user.id)
    ]);

    const cashBal = (cash.data || []).reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0);
    const debitBal = (cards.data || []).filter(c => c.type === 'debit').reduce((s, c) => s + c.current_balance, 0);
    const creditDebt = (cards.data || []).filter(c => c.type === 'credit').reduce((s, c) => s + c.current_balance, 0);
    const credBal = (creditors.data || []).reduce((s, c) => s + c.current_balance, 0);
    const debtRec = (debtors.data || []).reduce((s, d) => s + d.current_balance, 0);

    return {
      available: cashBal + debitBal,
      debts: creditDebt + credBal,
      receivable: debtRec,
      pendingPayments: "Varios pagos de tarjeta próximos"
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const context = await fetchFinancialContext();
      
      const { data, error } = await supabase.functions.invoke('chat-ai', {
        body: { message: userMsg, context }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Lo siento, tuve un problema al conectar con mis neuronas de cerdito. ¿Podrías intentar de nuevo? 🐷" }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-2xl z-50 bg-indigo-600 hover:bg-indigo-700 text-white p-0 md:bottom-6"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            className="fixed inset-0 md:inset-auto md:bottom-24 md:right-6 md:w-96 z-[60] p-4 md:p-0"
          >
            <Card className="h-full md:h-[500px] flex flex-col shadow-2xl rounded-3xl overflow-hidden border-indigo-200">
              <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  <span className="font-bold">Asistente Oinkash IA</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white hover:bg-white/10 rounded-full">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-indigo-50/30">
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] p-3 rounded-2xl text-sm shadow-sm",
                      msg.role === 'user' ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white text-indigo-950 rounded-tl-none border border-indigo-100"
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white p-3 rounded-2xl border border-indigo-100 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                      <span className="text-xs text-indigo-400 font-medium">Oinkash está pensando...</span>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="p-4 bg-white border-t flex gap-2">
                <Input 
                  placeholder="Pregúntame algo..." 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  className="rounded-xl border-indigo-100 focus-visible:ring-indigo-500 h-11"
                  disabled={isTyping}
                />
                <Button type="submit" size="icon" className="rounded-xl bg-indigo-600 h-11 w-11" disabled={isTyping}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIChatAssistant;