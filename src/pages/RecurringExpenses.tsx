"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  PlusCircle, 
  Trash2, 
  Calendar, 
  RefreshCw, 
  AlertCircle, 
  CreditCard, 
  Banknote, 
  History,
  TrendingDown,
  Sparkles,
  Bell
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { useCategoryContext } from "@/context/CategoryContext";
import { showError, showSuccess } from "@/utils/toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { getContrastColor } from "@/utils/color-helpers";

const COCHINITO_PLANNER = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro.png";

const RecurringExpenses = () => {
  const { user } = useSession();
  const { expenseCategories, getCategoryById } = useCategoryContext();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "", 
    amount: "", 
    category_id: "", 
    next_date: "", 
    frequency: "monthly"
  });

  const fetchExpenses = async () => {
    if (!user) return;
    const { data } = await supabase.from('recurring_expenses').select('*').eq('user_id', user.id).order('next_date', { ascending: true });
    setExpenses(data || []);
  };

  useEffect(() => { fetchExpenses(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    const { error } = await supabase.from('recurring_expenses').insert({
      user_id: user.id,
      name: formData.name,
      amount: parseFloat(formData.amount),
      category_id: formData.category_id || null,
      next_date: formData.next_date,
      frequency: formData.frequency
    });

    if (error) {
      showError("No se pudo guardar la suscripción.");
    } else {
      showSuccess("¡Suscripción añadida! 🐷");
      setIsAddDialogOpen(false);
      setFormData({ name: "", amount: "", category_id: "", next_date: "", frequency: "monthly" });
      fetchExpenses();
    }
    setIsSubmitting(false);
  };

  const deleteExpense = async (id: string) => {
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
    if (!error) {
      showSuccess("Suscripción eliminada.");
      fetchExpenses();
    }
  };

  const totalMonthly = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6 pb-24 max-w-5xl mx-auto">
      
      {/* HEADER: COCHINITO PLANIFICADOR */}
      <header className="relative">
        <div className="absolute inset-0 bg-purple-100/50 blur-3xl rounded-full -z-10" />
        <Card className="bg-slate-900 text-white rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
          <div className="p-8 space-y-6 relative">
            <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
              <img src={COCHINITO_PLANNER} alt="Planner" className="h-40 w-40 object-contain rotate-6" />
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Presupuesto Fijo Mensual 🐷</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black tracking-tighter">${totalMonthly.toLocaleString()}</span>
                <span className="text-xl font-bold text-slate-500">MXN</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 bg-purple-400/10 w-fit px-4 py-1.5 rounded-full">
              <RefreshCw className="h-3 w-3 animate-spin-slow" /> {expenses.length} suscripciones activas
            </div>
          </div>
        </Card>
      </header>

      {/* ACCIONES Y FILTROS */}
      <section className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
           <div className="h-10 w-10 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400">
             <Bell className="h-5 w-5" />
           </div>
           <h2 className="text-lg font-black tracking-tight">Mis Pagos Fijos</h2>
        </div>
        <Button 
          onClick={() => setIsAddDialogOpen(true)} 
          className="rounded-2xl h-12 px-6 font-black bg-indigo-600 shadow-xl shadow-indigo-100 gap-2"
        >
          <PlusCircle className="h-5 w-5" /> <span className="hidden sm:inline">Añadir Suscripción</span>
        </Button>
      </section>

      {/* LISTA DE SUSCRIPCIONES */}
      <section className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {expenses.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 opacity-30">
              <History className="h-12 w-12 mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-xs">No hay suscripciones registradas</p>
            </motion.div>
          ) : (
            expenses.map((exp, i) => {
              const category = getCategoryById(exp.category_id);
              return (
                <motion.div 
                  key={exp.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="rounded-3xl border-none shadow-sm hover:shadow-md transition-all group bg-white overflow-hidden">
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div 
                          className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner shrink-0"
                          style={{ 
                            backgroundColor: category?.color || '#f1f5f9',
                            color: getContrastColor(category?.color || '#f1f5f9')
                          }}
                        >
                          <DynamicLucideIcon iconName={category?.icon || "Tag"} className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900">{exp.name}</span>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                            <Calendar className="h-3 w-3" /> Próximo: {format(parseISO(exp.next_date), "dd 'de' MMMM", { locale: es })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right flex flex-col">
                          <span className="text-lg font-black text-rose-500">-${exp.amount.toLocaleString()}</span>
                          <span className="text-[8px] font-black uppercase text-slate-300 tracking-tighter">{exp.frequency === 'monthly' ? 'Mensual' : 'Anual'}</span>
                        </div>
                        
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteExpense(exp.id)}
                          className="h-10 w-10 rounded-full text-slate-200 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </section>

      {/* DIÁLOGO: NUEVA SUSCRIPCIÓN */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-500" /> Nueva Suscripción
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombre del Servicio</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="Ej. Netflix, Renta, Gym..." 
                className="rounded-2xl h-12 bg-slate-50 border-none font-bold focus-visible:ring-purple-500" 
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Monto</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={formData.amount} 
                    onChange={e => setFormData({...formData, amount: e.target.value})} 
                    className="rounded-2xl h-12 bg-slate-50 border-none font-black pr-10 focus-visible:ring-purple-500" 
                    placeholder="0.00" 
                    required 
                  />
                  <span className="absolute right-3 top-3.5 text-[10px] font-black text-slate-300">MXN</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Frecuencia</Label>
                <Select value={formData.frequency} onValueChange={v => setFormData({...formData, frequency: v})}>
                  <SelectTrigger className="rounded-2xl h-12 bg-slate-50 border-none font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="monthly" className="rounded-xl">Mensual</SelectItem>
                    <SelectItem value="yearly" className="rounded-xl">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Próxima Fecha de Pago</Label>
              <Input 
                type="date" 
                value={formData.next_date} 
                onChange={e => setFormData({...formData, next_date: e.target.value})} 
                className="rounded-2xl h-12 bg-slate-50 border-none font-bold focus-visible:ring-purple-500" 
                required 
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Categoría</Label>
              <Select value={formData.category_id} onValueChange={v => setFormData({...formData, category_id: v})}>
                <SelectTrigger className="rounded-2xl h-12 bg-slate-50 border-none font-bold">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {expenseCategories.map(c => (
                    <SelectItem key={c.id} value={c.id} className="rounded-xl">
                      <div className="flex items-center gap-2">
                        <DynamicLucideIcon iconName={c.icon || "Tag"} className="h-4 w-4" />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              type="submit" 
              className="w-full rounded-2xl h-14 font-black text-lg bg-purple-600 shadow-xl shadow-purple-100 mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Guardando..." : "Guardar Pago Fijo"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecurringExpenses;