"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { 
  PlusCircle, 
  Trash2, 
  Eye, 
  Phone, 
  Edit, 
  DollarSign, 
  AlertCircle, 
  CalendarIcon, 
  Coins, 
  MessageSquare, 
  Search, 
  UserPlus,
  History,
  CheckCircle2,
  Clock
} from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { evaluateExpression } from "@/utils/math-helpers";
import { useNavigate } from "react-router-dom";
import { getLocalDateString } from "@/utils/date-helpers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useCategoryContext } from "@/context/CategoryContext";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isBefore, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { fetchUsdToMxnRate } from "@/utils/currency-helper";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const GIF_COBRANDO = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/debtorsnuevos.gif";

const Debtors = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const { incomeCategories } = useCategoryContext();
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  
  const [isAddDebtorDialogOpen, setIsAddDebtorDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);
  
  const [newDebtor, setNewDebtor] = useState({ name: "", initial_balance: "", phone: "", due_date: undefined as Date | undefined });
  const [newTransaction, setNewTransaction] = useState({
    type: "payment" as "charge" | "payment",
    amount: "",
    description: "",
    destinationAccountId: "cash",
    selectedIncomeCategoryId: "",
  });

  const [addDebtorCurrency, setAddDebtorCurrency] = useState<"MXN" | "USD">("MXN");
  const [txCurrency, setTxCurrency] = useState<"MXN" | "USD">("MXN");
  const [usdToMxnRate, setUsdToMxnRate] = useState<number>(20.00);
  const [skipLinkedTransaction, setSkipLinkedTransaction] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchRate = async () => {
      const rate = await fetchUsdToMxnRate();
      setUsdToMxnRate(rate);
    };
    fetchRate();
  }, [isAddDebtorDialogOpen, isTransactionDialogOpen]);

  const fetchData = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('debtors')
      .select('*, debtor_transactions(type, amount)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const debtorsWithRealBalance = (data || []).map((d: any) => {
      const totalCharges = d.debtor_transactions.filter((t: any) => t.type === 'charge').reduce((s: number, t: any) => s + t.amount, 0);
      const totalPayments = d.debtor_transactions.filter((t: any) => t.type === 'payment').reduce((s: number, t: any) => s + t.amount, 0);
      const realBalance = d.initial_balance + totalCharges - totalPayments;
      return { ...d, current_balance: realBalance };
    });

    setDebtors(debtorsWithRealBalance);

    const { data: cData } = await supabase.from('cards').select('*').eq('user_id', user.id);
    setCards(cData || []);

    const { data: cashData } = await supabase.from('cash_transactions').select('type, amount').eq('user_id', user.id);
    setCashBalance((cashData || []).reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0));

    if (incomeCategories.length > 0) setNewTransaction(p => ({...p, selectedIncomeCategoryId: incomeCategories[0].id}));
  };

  useEffect(() => { fetchData(); }, [user, incomeCategories]);

  const handleSubmitNewDebtor = async (e: React.FormEvent) => {
    e.preventDefault();
    let base = evaluateExpression(newDebtor.initial_balance) || 0;
    if (base <= 0) return showError("Monto inválido");

    let finalBal = addDebtorCurrency === "USD" ? base * usdToMxnRate : base;
    let name = addDebtorCurrency === "USD" ? `${newDebtor.name} (USD)` : newDebtor.name;

    const { data, error } = await supabase.from('debtors').insert({
      user_id: user?.id, name, initial_balance: finalBal, current_balance: finalBal,
      phone: newDebtor.phone.trim() || null,
      due_date: newDebtor.due_date ? getLocalDateString(newDebtor.due_date) : null,
    }).select().single();

    if (error) showError(error.message);
    else {
      showSuccess("Deudor registrado");
      fetchData();
      setIsAddDebtorDialogOpen(false);
      setNewDebtor({ name: "", initial_balance: "", phone: "", due_date: undefined });
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtor) return;
    let base = evaluateExpression(newTransaction.amount) || 0;
    if (base <= 0) return showError("Monto inválido");

    let finalAmt = txCurrency === "USD" ? base * usdToMxnRate : base;
    const date = getLocalDateString(new Date());

    try {
      await supabase.from('debtor_transactions').insert({
        user_id: user?.id, debtor_id: selectedDebtor.id, type: newTransaction.type,
        amount: finalAmt, description: newTransaction.description, date
      });

      if (newTransaction.type === "payment" && !skipLinkedTransaction) {
        if (newTransaction.destinationAccountId === "cash") {
          await supabase.from('cash_transactions').insert({ user_id: user?.id, type: "ingreso", amount: finalAmt, description: `Abono: ${selectedDebtor.name}`, date, income_category_id: newTransaction.selectedIncomeCategoryId });
        } else {
          const card = cards.find(c => c.id === newTransaction.destinationAccountId);
          if (card) {
            const newBal = card.type === "credit" ? card.current_balance - finalAmt : card.current_balance + finalAmt;
            await supabase.from('cards').update({ current_balance: newBal }).eq('id', card.id);
            await supabase.from('card_transactions').insert({ user_id: user?.id, card_id: card.id, type: "payment", amount: finalAmt, description: `Abono: ${selectedDebtor.name}`, date, income_category_id: newTransaction.selectedIncomeCategoryId });
          }
        }
      }

      showSuccess("Abono registrado");
      setIsTransactionDialogOpen(false);
      fetchData();
    } catch (err: any) { showError(err.message); }
  };

  const handleWhatsApp = (debtor: Debtor) => {
    if (!debtor.phone) return showError("No tiene teléfono registrado");
    const msg = `Hola ${debtor.name}, ¿cómo estás? Te escribo para recordarte el pendiente de $${debtor.current_balance.toFixed(2)}. ¡Saludos! 🐷`;
    window.open(`https://wa.me/${debtor.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const activeDebtors = debtors.filter(d => d.current_balance > 0.01 && d.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const settledDebtors = debtors.filter(d => d.current_balance <= 0.01 && d.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const DebtorCard = ({ debtor }: { debtor: Debtor }) => {
    const isOverdue = debtor.due_date && isBefore(parseISO(debtor.due_date), new Date()) && !isSameDay(parseISO(debtor.due_date), new Date());
    const initials = debtor.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    return (
      <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="group relative">
        <Card className="rounded-[2rem] border-none shadow-sm hover:shadow-xl transition-all overflow-hidden bg-white">
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-lg shadow-inner">
                  {initials}
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-slate-900 truncate max-w-[120px]">{debtor.name}</span>
                  {debtor.due_date && (
                    <span className={cn("text-[10px] font-bold uppercase flex items-center gap-1", isOverdue ? "text-rose-500" : "text-slate-400")}>
                      <Clock className="h-3 w-3" /> {isOverdue ? 'Vencido' : 'Vence'}: {format(parseISO(debtor.due_date), 'd MMM', { locale: es })}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo</p>
                <p className="text-xl font-black text-indigo-600">${debtor.current_balance.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-6">
              <Button 
                variant="outline" 
                className="rounded-xl h-10 font-bold border-slate-100 bg-slate-50/50 hover:bg-indigo-50 hover:text-indigo-600"
                onClick={() => { setSelectedDebtor(debtor); setIsTransactionDialogOpen(true); }}
              >
                <DollarSign className="h-4 w-4 mr-1" /> Abonar
              </Button>
              <Button 
                variant="outline" 
                className="rounded-xl h-10 font-bold border-slate-100 bg-slate-50/50 hover:bg-green-50 hover:text-green-600"
                onClick={() => handleWhatsApp(debtor)}
              >
                <MessageSquare className="h-4 w-4 mr-1" /> Cobrar
              </Button>
            </div>
            
            <div className="flex justify-center mt-3">
              <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-slate-400 hover:text-primary rounded-lg" onClick={() => navigate(`/debtors/${debtor.id}`)}>
                Ver Historial <History className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6 pb-24 max-w-5xl mx-auto">
      
      {/* HEADER COBRANZA */}
      <header className="relative">
        <div className="absolute inset-0 bg-emerald-100/50 blur-3xl rounded-full -z-10" />
        <Card className="bg-emerald-600 text-white rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
          <div className="p-8 relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-4 flex-1 text-center md:text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Dinero por Cobrar 🐷</p>
              <div className="flex items-baseline justify-center md:justify-start gap-2">
                <span className="text-5xl font-black tracking-tighter">
                  ${debtors.filter(d => d.current_balance > 0.01).reduce((s, d) => s + d.current_balance, 0).toLocaleString()}
                </span>
                <span className="text-xl font-bold opacity-60">MXN</span>
              </div>
              <p className="text-xs font-medium text-emerald-50/80">¡Es hora de que esos cerditos vuelvan a casa!</p>
            </div>
            <div className="flex-shrink-0">
              <img src={GIF_COBRANDO} alt="Cobrando" className="h-36 w-36 object-contain" />
            </div>
          </div>
        </Card>
      </header>

      {/* FILTROS Y BUSQUEDA */}
      <section className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar por nombre..." className="pl-10 rounded-2xl h-12 border-none shadow-sm bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Button className="rounded-2xl h-12 px-6 font-black bg-slate-900 shadow-xl gap-2 w-full md:w-auto" onClick={() => setIsAddDebtorDialogOpen(true)}>
          <UserPlus className="h-5 w-5" /> Nuevo Deudor
        </Button>
      </section>

      {/* LISTA DE DEUDORES */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-2xl h-12">
          <TabsTrigger value="active" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Activos ({activeDebtors.length})</TabsTrigger>
          <TabsTrigger value="settled" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Saldados ({settledDebtors.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-8">
          {activeDebtors.length === 0 ? (
            <div className="text-center py-20 opacity-30">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-xs">¡Todo cobrado!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeDebtors.map(d => <DebtorCard key={d.id} debtor={d} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settled" className="mt-8">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60">
              {settledDebtors.map(d => (
                <Card key={d.id} className="rounded-[2rem] border-none shadow-sm grayscale bg-slate-50">
                  <div className="p-6 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 font-bold text-sm">
                        {d.name[0]}
                      </div>
                      <span className="font-bold text-slate-400">{d.name}</span>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 border-none rounded-full">Saldado</Badge>
                  </div>
                </Card>
              ))}
           </div>
        </TabsContent>
      </Tabs>

      {/* DIALOGOS */}
      <Dialog open={isAddDebtorDialogOpen} onOpenChange={setIsAddDebtorDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-[400px]">
          <DialogHeader><DialogTitle className="text-2xl font-black">Nuevo Deudor</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmitNewDebtor} className="grid gap-5 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombre</Label>
              <Input value={newDebtor.name} onChange={e => setNewDebtor({...newDebtor, name: e.target.value})} className="rounded-2xl h-12 bg-slate-50 border-none font-bold" required />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-1">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Saldo Inicial</Label>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-[9px] gap-1">
                  <button type="button" onClick={() => setAddDebtorCurrency("MXN")} className={cn("px-2 py-0.5 rounded-md font-bold", addDebtorCurrency === "MXN" ? "bg-white shadow-sm" : "text-slate-400")}>MXN</button>
                  <button type="button" onClick={() => setAddDebtorCurrency("USD")} className={cn("px-2 py-0.5 rounded-md font-bold", addDebtorCurrency === "USD" ? "bg-white shadow-sm" : "text-slate-400")}>USD</button>
                </div>
              </div>
              <div className="relative">
                <Input value={newDebtor.initial_balance} onChange={e => setNewDebtor({...newDebtor, initial_balance: e.target.value})} className="rounded-2xl h-14 text-xl font-black bg-slate-50 border-none pr-12" required />
                <span className="absolute right-4 top-4 text-xs font-black text-slate-300">{addDebtorCurrency}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Teléfono (WhatsApp)</Label>
              <Input value={newDebtor.phone} onChange={e => setNewDebtor({...newDebtor, phone: e.target.value})} placeholder="521..." className="rounded-2xl h-12 bg-slate-50 border-none font-bold" />
            </div>
            <Button type="submit" className="w-full rounded-2xl h-14 font-black text-lg bg-emerald-600 shadow-xl shadow-emerald-100">Registrar Deuda</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-[400px]">
          <DialogHeader><DialogTitle className="text-2xl font-black">Abono: {selectedDebtor?.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-6 py-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-1">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Monto del Pago</Label>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-[9px] gap-1">
                  <button type="button" onClick={() => setTxCurrency("MXN")} className={cn("px-2 py-0.5 rounded-md font-bold", txCurrency === "MXN" ? "bg-white shadow-sm" : "text-slate-400")}>MXN</button>
                  <button type="button" onClick={() => setTxCurrency("USD")} className={cn("px-2 py-0.5 rounded-md font-bold", txCurrency === "USD" ? "bg-white shadow-sm" : "text-slate-400")}>USD</button>
                </div>
              </div>
              <Input value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} className="rounded-2xl h-14 text-xl font-black bg-slate-50 border-none" required />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">¿A dónde entró el dinero?</Label>
              <Select value={newTransaction.destinationAccountId} onValueChange={v => setNewTransaction({...newTransaction, destinationAccountId: v})}>
                <SelectTrigger className="rounded-2xl h-12 bg-slate-50 border-none font-bold"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="cash" className="rounded-xl">Efectivo (${cashBalance.toFixed(0)})</SelectItem>
                  {cards.map(c => <SelectItem key={c.id} value={c.id} className="rounded-xl">{c.name} ({c.bank_name})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full rounded-2xl h-14 font-black text-lg bg-primary shadow-xl">Confirmar Abono</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Debtors;