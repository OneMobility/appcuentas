"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  PlusCircle, 
  DollarSign, 
  Trash2, 
  Edit, 
  CalendarIcon, 
  TrendingUp, 
  Trophy, 
  Target, 
  MoreHorizontal,
  History,
  CheckCircle2,
  Clock,
  Search
} from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import ColorPicker from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FeedbackOverlay from "@/components/FeedbackOverlay";
import { getLocalDateString } from "@/utils/date-helpers";
import { evaluateExpression } from "@/utils/math-helpers";
import { motion, AnimatePresence } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const GIF_METAS = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/meta.gif";

const Savings: React.FC = () => {
  const { user } = useSession();
  const [savings, setSavings] = useState<any[]>([]);
  const [isAddSavingDialogOpen, setIsAddSavingDialogOpen] = useState(false);
  const [isEditSavingDialogOpen, setIsEditSavingDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [selectedSavingId, setSelectedSavingId] = useState<string | null>(null);
  const [editingSaving, setEditingSaving] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [newSaving, setNewSaving] = useState({
    name: "", initial_balance: "", target_amount: "", target_date: undefined as Date | undefined, color: "#22C55E",
  });
  const [newTransaction, setNewTransaction] = useState({
    type: "deposit" as "deposit" | "withdrawal", amount: "", description: "",
  });
  const [feedbackOverlay, setFeedbackOverlay] = useState<any>(null);

  const fetchSavings = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('savings').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (!error) setSavings(data || []);
  };

  useEffect(() => { if (user) fetchSavings(); }, [user]);

  const totalSaved = useMemo(() => savings.reduce((s, v) => s + v.current_balance, 0), [savings]);

  const handleSubmitNewSaving = async (e: React.FormEvent) => {
    e.preventDefault();
    let initial = evaluateExpression(newSaving.initial_balance) || 0;
    let target = newSaving.target_amount ? (evaluateExpression(newSaving.target_amount) || 0) : null;

    const { data, error } = await supabase.from('savings').insert({
      user_id: user?.id, name: newSaving.name.trim(), current_balance: initial, target_amount: target,
      target_date: newSaving.target_date ? getLocalDateString(newSaving.target_date) : null, color: newSaving.color
    }).select().single();

    if (!error) {
      setSavings(prev => [data, ...prev]);
      setIsAddSavingDialogOpen(false);
      setNewSaving({ name: "", initial_balance: "", target_amount: "", target_date: undefined, color: "#22C55E" });
      setFeedbackOverlay({ isVisible: true, message: "¡Meta creada! ¡Vamos por ello! 🐷", imageSrc: GIF_METAS, bgColor: "bg-indigo-50", textColor: "text-indigo-800" });
    }
  };

  const handleUpdateSaving = async (e: React.FormEvent) => {
    e.preventDefault();
    let target = newSaving.target_amount ? (evaluateExpression(newSaving.target_amount) || 0) : null;
    const { data, error } = await supabase.from('savings').update({
      name: newSaving.name.trim(), target_amount: target,
      target_date: newSaving.target_date ? getLocalDateString(newSaving.target_date) : null, color: newSaving.color
    }).eq('id', editingSaving.id).select().single();

    if (!error) {
      setSavings(prev => prev.map(s => s.id === data.id ? data : s));
      setIsEditSavingDialogOpen(false);
      showSuccess("Meta actualizada");
    }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    let amount = evaluateExpression(newTransaction.amount) || 0;
    const current = savings.find(s => s.id === selectedSavingId);
    if (!current) return;

    let newBal = newTransaction.type === 'deposit' ? current.current_balance + amount : current.current_balance - amount;
    if (newBal < 0) return showError("No puedes retirar más de lo que tienes.");

    let completionDate = current.completion_date;
    if (current.target_amount && newBal >= current.target_amount && !current.completion_date) completionDate = getLocalDateString(new Date());
    else if (current.target_amount && newBal < current.target_amount) completionDate = null;

    const { data, error } = await supabase.from('savings').update({ current_balance: newBal, completion_date: completionDate }).eq('id', selectedSavingId).select().single();

    if (!error) {
      setSavings(prev => prev.map(s => s.id === data.id ? data : s));
      setIsTransactionDialogOpen(false);
      if (newTransaction.type === 'deposit') {
         setFeedbackOverlay({ isVisible: true, message: "¡Buen ahorro! Un paso más cerca. 🐷", imageSrc: "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro.png", bgColor: "bg-emerald-50", textColor: "text-emerald-800" });
      }
    }
  };

  const deleteSaving = async (id: string) => {
    await supabase.from('savings').delete().eq('id', id);
    setSavings(prev => prev.filter(s => s.id !== id));
    showSuccess("Meta eliminada");
  };

  const filteredSavings = savings.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6 pb-24 max-w-5xl mx-auto">
      
      {/* HEADER: COCHINITO DE LAS METAS */}
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
              <img src={GIF_METAS} alt="Metas" className="h-32 w-32 object-contain" />
            </div>
          </div>
        </Card>
      </header>

      {/* FILTROS Y BUSQUEDA */}
      <section className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar meta..." className="pl-10 rounded-2xl h-12 border-none shadow-sm bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Button className="rounded-2xl h-12 px-6 font-black bg-slate-900 shadow-xl gap-2 w-full md:w-auto" onClick={() => setIsAddSavingDialogOpen(true)}>
          <PlusCircle className="h-5 w-5" /> Nueva Meta
        </Button>
      </section>

      {/* LISTA DE METAS (TARJETAS) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredSavings.map((saving, i) => {
            const progress = saving.target_amount ? Math.min(100, (saving.current_balance / saving.target_amount) * 100) : 0;
            const isCompleted = saving.completion_date || (saving.target_amount && saving.current_balance >= saving.target_amount);

            return (
              <motion.div key={saving.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                <Card className="rounded-[2.5rem] border-none shadow-sm hover:shadow-xl transition-all bg-white overflow-hidden group">
                  <div className="p-6 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div 
                          className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner shrink-0"
                          style={{ backgroundColor: `${saving.color}15`, color: saving.color }}
                        >
                          {isCompleted ? <Trophy className="h-7 w-7" /> : <Target className="h-7 w-7" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 text-lg leading-tight">{saving.name}</span>
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
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

                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-slate-400">Llevas ahorrado</span>
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
                            <span style={{ color: saving.color }}>{progress.toFixed(0)}% Completado</span>
                            <span className="text-slate-300">Faltan ${(saving.target_amount - saving.current_balance).toLocaleString()}</span>
                          </div>
                          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
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
                      <PlusCircle className="h-5 w-5" /> Añadir Dinero
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </section>

      {/* DIALOGOS */}
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
            <Button type="submit" className="w-full rounded-2xl h-14 font-black text-lg bg-yellow-600 shadow-xl shadow-yellow-100 mt-2">¡Empezar Ahorro!</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-[400px]">
          <DialogHeader><DialogTitle className="text-2xl font-black">Registrar Movimiento</DialogTitle></DialogHeader>
          <form onSubmit={handleTransaction} className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-2xl">
              <Button type="button" variant={newTransaction.type === 'deposit' ? 'default' : 'ghost'} className={cn("rounded-xl font-bold h-10", newTransaction.type === 'deposit' && "bg-emerald-500 shadow-md")} onClick={() => setNewTransaction({...newTransaction, type: 'deposit'})}>Ahorrar</Button>
              <Button type="button" variant={newTransaction.type === 'withdrawal' ? 'default' : 'ghost'} className={cn("rounded-xl font-bold h-10", newTransaction.type === 'withdrawal' && "bg-rose-500 shadow-md")} onClick={() => setNewTransaction({...newTransaction, type: 'withdrawal'})}>Retirar</Button>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Monto</Label>
              <Input value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} className="rounded-2xl h-14 text-xl font-black bg-slate-50 border-none focus-visible:ring-indigo-200" placeholder="0.00" required />
            </div>
            <Button type="submit" className="w-full rounded-2xl h-14 font-black text-lg bg-indigo-600 shadow-xl shadow-indigo-100">Confirmar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {feedbackOverlay?.isVisible && <FeedbackOverlay {...feedbackOverlay} onClose={() => setFeedbackOverlay(null)} />}
    </div>
  );
};

export default Savings;