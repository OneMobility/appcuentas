"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  PlusCircle, 
  DollarSign, 
  Trash2, 
  Edit, 
  Trophy, 
  MoreHorizontal,
  CheckCircle2,
  Clock,
  Search,
  AlertCircle,
  Loader2
} from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import ColorPicker from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import FeedbackOverlay from "@/components/FeedbackOverlay";
import { getLocalDateString } from "@/utils/date-helpers";
import { evaluateExpression } from "@/utils/math-helpers";
import { motion, AnimatePresence } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const BUCKET_URL = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/metas";

const FEEDBACK_MESSAGES = {
  onOpen: [
    "¡Una nueva aventura financiera comienza! 🐷",
    "¡Meta creada! El primer paso es el más importante.",
    "Plantaste una semilla de abundancia. ¡A regarla! 🌿",
    "¡Oficialmente en camino a lograrlo! 🚀"
  ],
  onWithdraw: [
    "Retiraste un poco, pero sé que es por algo necesario. 📉",
    "¡Ouch! El cochinito sintió ese pellizco. 🐷",
    "¡Ánimo! Recuperaremos este saldo muy pronto.",
  ],
  onDeposit: [
    "¡Eso! Un paso más cerca de lo que sueñas. 🚀",
    "¡Tu cochinito está sonriendo con este abono!",
    "¡Estás alimentando tus sueños! Sigue así. 🍬",
  ],
  onComplete: [
    "¡LO LOGRASTE! Eres un maestro del ahorro. 🏆",
    "¡Meta cumplida! Disfruta tu recompensa, te la ganaste.",
    "¡Misión cumplida! El cochinito está listo para la fiesta. 🎉",
    "¡Oinkash celebra contigo! ¡Objetivo terminado! 🐷✨"
  ],
  onWiseDecision: [
    "¡Wow! Te arrepentiste de gastar y preferiste ahorrar. ¡Genial!",
    "¡Victoria mental! Le ganaste al impulso de gasto. 🏆",
    "¡Nivel de madurez financiera: Experto! 🌟",
  ]
};

const Savings: React.FC = () => {
  const { user } = useSession();
  const [savings, setSavings] = useState<any[]>([]);
  const [isAddSavingDialogOpen, setIsAddSavingDialogOpen] = useState(false);
  const [isEditSavingDialogOpen, setIsEditSavingDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedSavingId, setSelectedSavingId] = useState<string | null>(null);
  const [editingSaving, setEditingSaving] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [feedbackOverlay, setFeedbackOverlay] = useState<any>(null);

  const [lastAction, setLastAction] = useState<{ type: 'deposit' | 'withdrawal', time: number, savingId: string } | null>(null);

  const [newSaving, setNewSaving] = useState({
    name: "", initial_balance: "", target_amount: "", target_date: undefined as Date | undefined, color: "#22C55E",
  });
  const [newTransaction, setNewTransaction] = useState({
    type: "deposit" as "deposit" | "withdrawal", amount: "",
  });

  const fetchSavings = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('savings').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (!error) setSavings(data || []);
  };

  useEffect(() => { if (user) fetchSavings(); }, [user]);

  const totalSaved = useMemo(() => savings.reduce((s, v) => s + v.current_balance, 0), [savings]);

  const getRandomPhrase = (category: keyof typeof FEEDBACK_MESSAGES) => {
    const list = FEEDBACK_MESSAGES[category];
    return list[Math.floor(Math.random() * list.length)];
  };

  const getPiggyStatus = (saving: any) => {
    const progress = saving.target_amount ? (saving.current_balance / saving.target_amount) * 100 : 0;
    
    // Calcular inactividad (usando created_at como fallback si no hay updated_at)
    const daysSinceUpdate = differenceInDays(new Date(), parseISO(saving.updated_at || saving.created_at));

    // Prioridad 1: Meta Cumplida (08)
    if (saving.completion_date || progress >= 100) {
      return { img: `${BUCKET_URL}/08.gif`, label: "¡Logrado!", sub: "¡Eres un campeón!" };
    }
    
    // Prioridad 2: Inactividad Crítica (>30 días) (07)
    if (daysSinceUpdate > 30) {
      return { img: `${BUCKET_URL}/07.gif`, label: "Abandonada", sub: "¡Tu meta te extraña mucho!" };
    }

    // Prioridad 3: Inactividad Media (30 días) (06)
    if (daysSinceUpdate === 30) {
      return { img: `${BUCKET_URL}/06.gif`, label: "En riesgo", sub: "Ya pasó un mes..." };
    }

    // Prioridad 4: Inactividad Inicial (15 días) (05)
    if (daysSinceUpdate >= 15) {
      return { img: `${BUCKET_URL}/05.gif`, label: "Hambriento", sub: "Hace 15 días no ahorras." };
    }

    // Prioridad 5: Progreso
    if (progress >= 75) return { img: `${BUCKET_URL}/04.gif`, label: "Casi listo", sub: "¡Ya huelo el éxito!" };
    if (progress >= 50) return { img: `${BUCKET_URL}/03.gif`, label: "A la mitad", sub: "¡Medio camino recorrido!" };
    if (progress >= 25) return { img: `${BUCKET_URL}/02.gif`, label: "Creciendo", sub: "¡Buen comienzo!" };
    
    // Por defecto: Recién creada o < 25% (01)
    return { img: `${BUCKET_URL}/01.gif`, label: "Nueva", sub: "¡Empecemos con todo!" };
  };

  const handleSubmitNewSaving = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    let initial = evaluateExpression(newSaving.initial_balance) || 0;
    let target = newSaving.target_amount ? (evaluateExpression(newSaving.target_amount) || 0) : null;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('savings').insert({
        user_id: user?.id, 
        name: newSaving.name.trim(), 
        current_balance: initial, 
        target_amount: target,
        target_date: newSaving.target_date ? getLocalDateString(newSaving.target_date) : null, 
        color: newSaving.color
      }).select().single();

      if (error) throw error;

      setSavings(prev => [data, ...prev]);
      setIsAddSavingDialogOpen(false);
      setNewSaving({ name: "", initial_balance: "", target_amount: "", target_date: undefined, color: "#22C55E" });
      
      setFeedbackOverlay({ 
        isVisible: true, 
        message: getRandomPhrase('onOpen'), 
        imageSrc: `${BUCKET_URL}/01.gif`, 
        bgColor: "bg-white", 
        textColor: "text-slate-900" 
      });
    } catch (err: any) {
      showError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSaving = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    let target = newSaving.target_amount ? (evaluateExpression(newSaving.target_amount) || 0) : null;
    
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('savings').update({
        name: newSaving.name.trim(), 
        target_amount: target,
        target_date: newSaving.target_date ? getLocalDateString(newSaving.target_date) : null, 
        color: newSaving.color
      }).eq('id', editingSaving.id).select().single();

      if (error) throw error;

      setSavings(prev => prev.map(s => s.id === data.id ? data : s));
      setIsEditSavingDialogOpen(false);
      showSuccess("Meta actualizada");
    } catch (err: any) {
      showError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !selectedSavingId) return;

    let amount = evaluateExpression(newTransaction.amount) || 0;
    if (amount <= 0) return showError("Ingresa un monto válido");

    const current = savings.find(s => s.id === selectedSavingId);
    if (!current) return;

    let newBal = newTransaction.type === 'deposit' ? current.current_balance + amount : current.current_balance - amount;
    if (newBal < 0) return showError("No puedes retirar más de lo que tienes.");

    setIsSubmitting(true);
    try {
      const isCompleting = current.target_amount && newBal >= current.target_amount && !current.completion_date;
      let completionDate = current.completion_date;
      if (isCompleting) completionDate = getLocalDateString(new Date());
      else if (current.target_amount && newBal < current.target_amount) completionDate = null;

      const { data, error } = await supabase.from('savings').update({ 
        current_balance: newBal, 
        completion_date: completionDate,
        updated_at: new Date().toISOString() // Marcamos actividad
      }).eq('id', selectedSavingId).select().single();

      if (error) throw error;

      setSavings(prev => prev.map(s => s.id === data.id ? data : s));
      setIsTransactionDialogOpen(false);
      setNewTransaction(prev => ({ ...prev, amount: "" })); 
      
      const now = Date.now();
      const status = getPiggyStatus(data);

      if (isCompleting) {
        setFeedbackOverlay({ isVisible: true, message: getRandomPhrase('onComplete'), imageSrc: `${BUCKET_URL}/08.gif`, bgColor: "bg-white", textColor: "text-slate-900" });
      } else if (newTransaction.type === 'deposit') {
        setFeedbackOverlay({ isVisible: true, message: getRandomPhrase('onDeposit'), imageSrc: status.img, bgColor: "bg-white", textColor: "text-slate-900" });
      } else {
        setFeedbackOverlay({ isVisible: true, message: getRandomPhrase('onWithdraw'), imageSrc: status.img, bgColor: "bg-white", textColor: "text-slate-900" });
      }

      setLastAction({ type: newTransaction.type, time: now, savingId: selectedSavingId! });
    } catch (err: any) {
      showError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteSaving = async (id: string) => {
    const { error } = await supabase.from('savings').delete().eq('id', id);
    if (!error) {
      setSavings(prev => prev.filter(s => s.id !== id));
      showSuccess("Meta eliminada");
    }
  };

  const filteredSavings = savings.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6 pb-24 max-w-5xl mx-auto">
      
      <header className="relative">
        <div className="absolute inset-0 bg-yellow-100/50 blur-3xl rounded-full -z-10" />
        <Card className="bg-yellow-500 text-white rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
          <div className="p-8 relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-4 flex-1 text-center md:text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-100">Mis Ahorros Totales 🐷</p>
              <div className="flex items-baseline justify-center md:justify-start gap-2">
                <span className="text-5xl font-black tracking-tighter">${totalSaved.toLocaleString()}</span>
                <span className="text-xl font-bold opacity-60">MXN</span>
              </div>
              <p className="text-xs font-medium text-yellow-50/80">¡Tu futuro se construye peso a peso!</p>
            </div>
            <div className="flex-shrink-0">
              <img src={`${BUCKET_URL}/08.gif`} alt="Metas" className="h-32 w-32 object-contain" />
            </div>
          </div>
        </Card>
      </header>

      <section className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar meta..." className="pl-10 rounded-2xl h-12 border-none shadow-sm bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Button className="rounded-2xl h-12 px-6 font-black bg-slate-900 shadow-xl gap-2 w-full md:w-auto" onClick={() => setIsAddSavingDialogOpen(true)}>
          <PlusCircle className="h-5 w-5" /> Nueva Meta
        </Button>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredSavings.map((saving, i) => {
            const status = getPiggyStatus(saving);
            const progress = saving.target_amount ? Math.min(100, (saving.current_balance / saving.target_amount) * 100) : 0;
            const isCompleted = saving.completion_date || progress >= 100;
            const isAbandoned = status.label === "Abandonada" || status.label === "En riesgo";

            return (
              <motion.div key={saving.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                <Card className={cn(
                  "rounded-[2.5rem] border-none shadow-sm hover:shadow-xl transition-all bg-white overflow-hidden group relative",
                  isAbandoned && "bg-slate-50/80 border-dashed border-2 border-slate-200"
                )}>
                  {isAbandoned && (
                    <div className="absolute top-4 right-14 bg-amber-100 text-amber-700 text-[8px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 z-20 animate-pulse">
                      <AlertCircle className="h-2.5 w-2.5" /> Meta en Riesgo
                    </div>
                  )}

                  <div className="p-6 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div 
                            className="h-20 w-20 rounded-3xl flex items-center justify-center shadow-inner shrink-0 overflow-hidden"
                            style={{ backgroundColor: `${saving.color}15` }}
                          >
                            <img 
                              src={status.img} 
                              className={cn("h-16 w-16 object-contain opacity-100")} 
                              alt="Status" 
                            />
                          </div>
                          {isCompleted && <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-1.5 shadow-lg animate-bounce"><Trophy className="h-4 w-4 text-white" /></div>}
                        </div>
                        <div className="flex flex-col">
                          <span className={cn("font-black text-slate-900 text-lg leading-tight", isAbandoned && "text-slate-500")}>{saving.name}</span>
                          <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full w-fit mt-1">{status.label}</span>
                          <span className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {saving.target_date ? format(parseISO(saving.target_date), 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}
                          </span>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-full text-slate-300 hover:text-slate-600"><MoreHorizontal className="h-5 w-5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => { setEditingSaving(saving); setNewSaving({ name: saving.name, initial_balance: saving.current_balance.toString(), target_amount: saving.target_amount?.toString() || "", target_date: saving.target_date ? parseISO(saving.target_date) : undefined, color: saving.color }); setIsEditSavingDialogOpen(true); }} className="text-xs font-bold gap-2"><Edit className="h-3.5 w-3.5" /> Editar meta</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteSaving(saving.id)} className="text-xs font-bold gap-2 text-rose-500 focus:text-rose-500"><Trash2 className="h-3.5 w-3.5" /> Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase italic leading-tight">
                        "{status.sub}"
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-slate-400">Ahorrado</span>
                          <span className="text-2xl font-black text-slate-900">${saving.current_balance.toLocaleString()}</span>
                        </div>
                        {saving.target_amount && (
                          <div className="text-right flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-400">Meta</span>
                            <span className="text-sm font-bold text-slate-500">${saving.target_amount.toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      {saving.target_amount && (
                        <div className="space-y-1.5 pt-2">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                            <span style={{ color: saving.color }}>{progress.toFixed(0)}%</span>
                            <span className="text-slate-300">Falta ${(saving.target_amount - saving.current_balance).toLocaleString()}</span>
                          </div>
                          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full rounded-full" style={{ backgroundColor: saving.color }} />
                          </div>
                        </div>
                      )}
                    </div>

                    <Button 
                      className="w-full rounded-2xl h-12 font-black shadow-lg gap-2 transition-transform active:scale-95"
                      style={{ backgroundColor: saving.color, boxShadow: `0 10px 20px -5px ${saving.color}40` }}
                      onClick={() => { setSelectedSavingId(saving.id); setIsTransactionDialogOpen(true); }}
                    >
                      <PlusCircle className="h-5 w-5" /> Gestionar Dinero
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </section>

      <Dialog open={isAddSavingDialogOpen} onOpenChange={setIsAddSavingDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-[400px]">
          <DialogHeader><DialogTitle className="text-2xl font-black">Nueva Meta 🐷</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmitNewSaving} className="grid gap-5 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">¿Qué quieres comprar?</Label>
              <Input value={newSaving.name} onChange={e => setNewSaving({...newSaving, name: e.target.value})} className="rounded-2xl h-12 bg-slate-50 border-none font-bold" placeholder="Ej: Viaje a Japón" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Saldo Inicial</Label>
                <Input value={newSaving.initial_balance} onChange={e => setNewSaving({...newSaving, initial_balance: e.target.value})} className="rounded-2xl h-12 bg-slate-50 border-none font-black" placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Monto Meta</Label>
                <Input value={newSaving.target_amount} onChange={e => setNewSaving({...newSaving, target_amount: e.target.value})} className="rounded-2xl h-12 bg-slate-50 border-none font-black" placeholder="Ej: 5000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Color de la meta</Label>
              <ColorPicker selectedColor={newSaving.color} onSelectColor={c => setNewSaving({...newSaving, color: c})} />
            </div>
            <Button type="submit" className="w-full rounded-2xl h-14 font-black text-lg bg-yellow-600 shadow-xl shadow-yellow-100 mt-2" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "¡Empezar Ahorro!"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransactionDialogOpen} onOpenChange={(open) => { setIsTransactionDialogOpen(open); if(!open) setSelectedSavingId(null); }}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-[400px]">
          <DialogHeader><DialogTitle className="text-2xl font-black">Registrar Movimiento</DialogTitle></DialogHeader>
          <form onSubmit={handleTransaction} className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <Button type="button" variant={newTransaction.type === 'deposit' ? 'default' : 'ghost'} className={cn("rounded-xl font-bold h-10", newTransaction.type === 'deposit' && "bg-emerald-500 shadow-md")} onClick={() => setNewTransaction({...newTransaction, type: 'deposit'})}>Ahorrar</Button>
              <Button type="button" variant={newTransaction.type === 'withdrawal' ? 'default' : 'ghost'} className={cn("rounded-xl font-bold h-10", newTransaction.type === 'withdrawal' && "bg-rose-500 shadow-md")} onClick={() => setNewTransaction({...newTransaction, type: 'withdrawal'})}>Retirar</Button>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Monto</Label>
              <Input value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} className="rounded-2xl h-14 text-xl font-black bg-slate-50 border-none focus-visible:ring-indigo-200" placeholder="0.00" required />
            </div>
            <Button type="submit" className="w-full rounded-2xl h-14 font-black text-lg bg-indigo-600 shadow-xl shadow-indigo-100" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {feedbackOverlay?.isVisible && <FeedbackOverlay {...feedbackOverlay} onClose={() => setFeedbackOverlay(null)} />}
    </div>
  );
};

export default Savings;