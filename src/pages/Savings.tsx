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
  Search,
  Sparkles,
  Zap,
  Info
} from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from "date-fns";
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

// RECURSOS VISUALES
const GIF_METAS = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/meta.gif";
const PIGGY_STANDARD = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro.png";
const PIGGY_SAD = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro%20Triste.png";

// --- BANCO DE FRASES (60+) ---
const MOTIVATIONAL_PHRASES = [
  "Cada peso guardado es un paso hacia tu libertad.", "Ahorrar no es gastar menos, es vivir mejor mañana.", "Tu 'yo' del futuro te agradecerá este sacrificio.", "La disciplina financiera vence al talento financiero.", "No busques el momento perfecto, solo empieza a ahorrar.", "Pequeños ahorros hoy, grandes sueños mañana.", "La mejor inversión que puedes hacer es en tu tranquilidad.", "Dile a tu dinero a dónde ir, no preguntes a dónde se fue.", "Ahorrar es el arte de comprar libertad.", "Tus metas no se cumplen solas, se ahorran.",
  "El éxito financiero empieza con un 'no' a un capricho.", "No ahorres lo que te queda, gasta lo que te queda tras ahorrar.", "La constancia es la madre de la fortuna.", "Incluso un centavo es progreso.", "Visualiza tu meta y el ahorro será más fácil.", "Tu cuenta bancaria es un reflejo de tus prioridades.", "Sé el dueño de tu dinero, no su esclavo.", "Menos compras por impulso, más metas cumplidas.", "Ahorrar es amor propio en forma de billetes.", "Un presupuesto es la herramienta del éxito.",
  "El ahorro es el primer paso hacia la riqueza.", "Si puedes soñarlo, puedes ahorrarlo.", "La paciencia paga los mejores intereses.", "Controla tus gastos hormiga antes de que devoren tus metas.", "Tu futuro se construye hoy con lo que guardas.", "No necesitas más dinero, necesitas más disciplina.", "La paz mental financiera no tiene precio.", "Haz que tu dinero trabaje para ti.", "Evita deudas innecesarias, prefiere el ahorro.", "Eres capaz de lograr todo lo que te propongas.",
  "Un día sin ahorrar es un día más lejos de tu meta.", "La motivación te hace empezar, el hábito te mantiene.", "Nada es imposible para quien sabe ahorrar.", "El ahorro genera oportunidades.", "No te compares con otros, compárate con tu saldo anterior.", "Ahorrar es sembrar hoy para cosechar mañana.", "Tu meta está más cerca de lo que crees.", "Cree en tu plan y los resultados llegarán.", "El dinero bien administrado dura más.", "La libertad financiera es poder elegir.",
  "Cada moneda en el cochinito es una victoria.", "No dejes que los deseos de hoy arruinen los sueños de mañana.", "Ahorrar te da poder sobre tu destino.", "Tu voluntad es más fuerte que cualquier oferta de tienda.", "Planifica hoy, disfruta siempre.", "La riqueza es lo que no ves: el ahorro acumulado.", "Convierte el ahorro en tu pasatiempo favorito.", "No es cuánto ganas, sino cuánto conservas.", "Ahorrar es preparar el terreno para la abundancia.", "Toma el control total de tus finanzas.",
  "Cada meta cumplida merece una celebración.", "El ahorro es una inversión en ti mismo.", "No te rindas, el progreso es real aunque sea lento.", "Simplifica tu vida y verás crecer tu ahorro.", "La inteligencia financiera se entrena día a día.", "Tú eres el arquitecto de tu propio patrimonio.", "Ahorra con propósito y verás la magia.", "La abundancia llega a quien la sabe administrar.", "Protege tu futuro con el ahorro del presente.", "¡Oinkash está orgulloso de tu progreso! 🐷"
];

// --- FRASES POR CATEGORÍA ---
const FEEDBACK_MESSAGES = {
  onOpen: [
    "¡Una nueva aventura financiera comienza! 🐷",
    "¡Meta creada! El primer paso es el más importante.",
    "¡Felicidades por definir tu próximo gran objetivo!",
    "¡Tu plan de ahorro acaba de nacer! Cuídalo mucho.",
    "¡Hoy decidiste que tu futuro vale la pena!"
  ],
  onWithdraw: [
    "Retiraste un poco, pero sé que es por algo necesario. 📉",
    "Un ajuste en el camino no detiene tu meta.",
    "El dinero está para usarse, pero recuerda volver pronto.",
    "¡Ánimo! El saldo bajó pero tu voluntad sigue intacta.",
    "Toma lo que necesites, tus metas te esperarán."
  ],
  onDeposit: [
    "¡Eso! Un paso más cerca de lo que sueñas. 🚀",
    "¡Tu cochinito está sonriendo con este abono!",
    "¡Ahorro registrado con éxito! Eres imparable.",
    "¡Cada peso cuenta y hoy sumaste una victoria!",
    "¡Buen trabajo! Estás construyendo algo increíble."
  ],
  onComplete: [
    "¡LO LOGRASTE! Eres un maestro del ahorro. 🏆",
    "¡Meta cumplida! Disfruta tu recompensa, te la ganaste.",
    "¡Increíble! Sabíamos que podías hacerlo. ¡A celebrar!",
    "¡Misión cumplida! Tu disciplina ha dado frutos.",
    "¡Felicidades! Has alcanzado la cima. ¿Cuál es la siguiente?"
  ],
  onWiseDecision: [
    "¡Esa es la actitud! Rectificar es de sabios financieros. ✨",
    "¡Wow! Te arrepentiste de gastar y preferiste ahorrar. ¡Genial!",
    "¡Sabia decisión! Tu meta te lo agradece profundamente.",
    "¡Prioridades claras! Decidiste que tu sueño vale más que el gasto.",
    "¡Felicidades por esa fuerza de voluntad! Eres un crack."
  ]
};

const Savings: React.FC = () => {
  const { user } = useSession();
  const [savings, setSavings] = useState<any[]>([]);
  const [isAddSavingDialogOpen, setIsAddSavingDialogOpen] = useState(false);
  const [isEditSavingDialogOpen, setIsEditSavingDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [selectedSavingId, setSelectedSavingId] = useState<string | null>(null);
  const [editingSaving, setEditingSaving] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Lógica de "Sabia Decisión"
  const [lastAction, setLastAction] = useState<{ type: string, time: number } | null>(null);

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

  const getRandomPhrase = (category: keyof typeof FEEDBACK_MESSAGES) => {
    const list = FEEDBACK_MESSAGES[category];
    return list[Math.floor(Math.random() * list.length)];
  };

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
      setFeedbackOverlay({ isVisible: true, message: getRandomPhrase('onOpen'), imageSrc: GIF_METAS, bgColor: "bg-indigo-600", textColor: "text-white" });
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

    const isCompleting = current.target_amount && newBal >= current.target_amount && !current.completion_date;
    let completionDate = current.completion_date;
    if (isCompleting) completionDate = getLocalDateString(new Date());
    else if (current.target_amount && newBal < current.target_amount) completionDate = null;

    const { data, error } = await supabase.from('savings').update({ 
      current_balance: newBal, 
      completion_date: completionDate,
      updated_at: new Date().toISOString() 
    }).eq('id', selectedSavingId).select().single();

    if (!error) {
      setSavings(prev => prev.map(s => s.id === data.id ? data : s));
      setIsTransactionDialogOpen(false);
      
      // Lógica de "Sabia Decisión"
      const now = Date.now();
      const isDecisionCorrected = lastAction?.type === 'withdrawal' && newTransaction.type === 'deposit' && (now - lastAction.time < 300000); // 5 minutos

      if (isCompleting) {
        setFeedbackOverlay({ isVisible: true, message: getRandomPhrase('onComplete'), imageSrc: GIF_METAS, bgColor: "bg-yellow-500", textColor: "text-white" });
      } else if (isDecisionCorrected) {
        setFeedbackOverlay({ isVisible: true, message: getRandomPhrase('onWiseDecision'), imageSrc: GIF_METAS, bgColor: "bg-emerald-600", textColor: "text-white" });
      } else if (newTransaction.type === 'deposit') {
        setFeedbackOverlay({ isVisible: true, message: getRandomPhrase('onDeposit'), imageSrc: GIF_METAS, bgColor: "bg-indigo-600", textColor: "text-white" });
      } else {
        setFeedbackOverlay({ isVisible: true, message: getRandomPhrase('onWithdraw'), imageSrc: PIGGY_SAD, bgColor: "bg-slate-900", textColor: "text-white" });
      }

      setLastAction({ type: newTransaction.type, time: now });
    }
  };

  const deleteSaving = async (id: string) => {
    await supabase.from('savings').delete().eq('id', id);
    setSavings(prev => prev.filter(s => s.id !== id));
    showSuccess("Meta eliminada");
  };

  // Lógica de Cochinitos Evolutivos
  const getPiggyImage = (saving: any) => {
    if (saving.completion_date || (saving.target_amount && saving.current_balance >= saving.target_amount)) {
      return GIF_METAS; // Completado
    }
    
    // Inactividad > 7 días
    const daysSinceUpdate = differenceInDays(new Date(), parseISO(saving.updated_at || saving.created_at));
    if (daysSinceUpdate > 7) return PIGGY_SAD;

    const progress = saving.target_amount ? (saving.current_balance / saving.target_amount) * 100 : 0;
    
    if (progress < 30) return PIGGY_SAD; // Muy poco ahorro
    return PIGGY_STANDARD; // Ahorro normal o avanzado
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

      {/* MARQUESINA MOTIVACIONAL (60 FRASES) */}
      <section className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 overflow-hidden relative">
        <div className="flex items-center gap-3 absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-indigo-50/80 backdrop-blur-sm pr-4">
          <Zap className="h-4 w-4 text-indigo-600 fill-indigo-600 animate-pulse" />
          <span className="text-[10px] font-black uppercase text-indigo-600 tracking-tighter">Recordatorio:</span>
        </div>
        <div className="whitespace-nowrap overflow-hidden">
           <motion.div 
            animate={{ x: ["100%", "-200%"] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            className="inline-block pl-[20%] text-sm font-bold text-slate-600"
           >
             {MOTIVATIONAL_PHRASES.join(" • ")}
           </motion.div>
        </div>
      </section>

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
            const daysSinceUpdate = differenceInDays(new Date(), parseISO(saving.updated_at || saving.created_at));
            const isInactive = !isCompleted && daysSinceUpdate > 7;

            return (
              <motion.div key={saving.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                <Card className={cn(
                  "rounded-[2.5rem] border-none shadow-sm hover:shadow-xl transition-all bg-white overflow-hidden group relative",
                  isInactive && "bg-slate-50/80 border-dashed border-2 border-slate-200"
                )}>
                  {isInactive && (
                    <div className="absolute top-4 right-14 bg-amber-100 text-amber-700 text-[8px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 z-20">
                      <AlertCircle className="h-2.5 w-2.5" /> Meta Abandonada
                    </div>
                  )}

                  <div className="p-6 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div 
                            className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-inner shrink-0 overflow-hidden"
                            style={{ backgroundColor: `${saving.color}15` }}
                          >
                            <img src={getPiggyImage(saving)} className={cn("h-12 w-12 object-contain", isInactive && "grayscale opacity-60")} alt="Status" />
                          </div>
                          {isCompleted && <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-1 shadow-lg animate-bounce"><Trophy className="h-4 w-4 text-white" /></div>}
                        </div>
                        <div className="flex flex-col">
                          <span className={cn("font-black text-slate-900 text-lg leading-tight", isInactive && "text-slate-400")}>{saving.name}</span>
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
                      <PlusCircle className="h-5 w-5" /> Gestionar Dinero
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