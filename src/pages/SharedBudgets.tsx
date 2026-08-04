"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  PlusCircle, 
  Users, 
  Trash2, 
  Clock, 
  DollarSign, 
  Edit, 
  AlertCircle, 
  Calendar as CalendarIcon, 
  UserCheck,
  CheckCircle2,
  ChevronRight,
  TrendingUp
} from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useCategoryContext } from "@/context/CategoryContext";
import { evaluateExpression } from "@/utils/math-helpers";
import { format, parseISO, isBefore, isSameDay, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";

const SHARED_PIGGY = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro.png";

const SharedBudgets = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const { incomeCategories } = useCategoryContext();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [debtors, setDebtors] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", destinationId: "cash", categoryId: "" });
  const [skipLinked, setSkipLinked] = useState(false);

  const fetchAllData = async () => {
    if (!user) return;
    const [debtorsRes, cardsRes, budgetsRes] = await Promise.all([
      supabase.from('debtors').select('*').eq('user_id', user.id),
      supabase.from('cards').select('*').eq('user_id', user.id),
      supabase.from('shared_budgets').select('*, budget_participants(id, debtor_id, share_amount, paid_amount, is_paid, debtors(id, name))').eq('user_id', user.id).order('created_at', { ascending: false })
    ]);
    setDebtors(debtorsRes.data || []);
    setCards(cardsRes.data || []);
    setBudgets(budgetsRes.data || []);
    if (incomeCategories.length > 0) setPaymentForm(p => ({...p, categoryId: incomeCategories[0].id}));
  };

  useEffect(() => { fetchAllData(); }, [user]);

  const handleDelete = async (id: string) => {
     await supabase.from('shared_budgets').delete().eq('id', id);
     setBudgets(prev => prev.filter(b => b.id !== id));
     showSuccess("Presupuesto eliminado");
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    let amt = evaluateExpression(paymentForm.amount) || 0;
    
    try {
      const newPaid = (selectedParticipant.paid_amount || 0) + amt;
      const fullyPaid = newPaid >= selectedParticipant.share_amount - 0.01;

      await supabase.from('budget_participants').update({ paid_amount: newPaid, is_paid: fullyPaid }).eq('id', selectedParticipant.id);
      
      const debtor = debtors.find(d => d.id === selectedParticipant.debtor_id);
      if (debtor) {
        await supabase.from('debtors').update({ current_balance: debtor.current_balance - amt }).eq('id', debtor.id);
        await supabase.from('debtor_transactions').insert({ user_id: user?.id, debtor_id: debtor.id, type: "payment", amount: amt, description: `Abono: ${selectedParticipant.budgetName}`, date: new Date().toISOString().split('T')[0] });
      }

      if (!skipLinked) {
        await supabase.from('cash_transactions').insert({ user_id: user?.id, type: "ingreso", amount: amt, description: `Abono ${selectedParticipant.debtorName}`, date: new Date().toISOString().split('T')[0], income_category_id: paymentForm.categoryId });
      }

      showSuccess("Abono registrado");
      setIsPaymentDialogOpen(false);
      fetchAllData();
    } catch (e) {} finally { setIsProcessing(false); }
  };

  const activeBudgets = budgets.filter(b => !b.budget_participants.every((p:any) => p.is_paid));
  const completedBudgets = budgets.filter(b => b.budget_participants.every((p:any) => p.is_paid));

  const BudgetCard = ({ budget }: { budget: any }) => {
    const isOverdue = budget.due_date && isBefore(parseISO(budget.due_date), new Date());
    const totalPending = budget.budget_participants.reduce((s:number, p:any) => s + (p.share_amount - p.paid_amount), 0);
    const paidCount = budget.budget_participants.filter((p:any) => p.is_paid).length;

    return (
      <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden hover:shadow-md transition-all">
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h3 className="font-black text-slate-900 text-lg">{budget.name}</h3>
              {budget.due_date && (
                <span className={cn("text-[10px] font-bold uppercase tracking-widest flex items-center gap-1", isOverdue ? "text-rose-500" : "text-slate-400")}>
                  <Clock className="h-3 w-3" /> {isOverdue ? 'Vencido' : 'Vence'}: {format(parseISO(budget.due_date), 'd MMM', { locale: es })}
                </span>
              )}
            </div>
            <Badge className={cn("rounded-full border-none px-3", totalPending === 0 ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600")}>
              {totalPending === 0 ? 'Liquidado' : `Faltan $${totalPending.toFixed(0)}`}
            </Badge>
          </div>

          <div className="flex items-center gap-3 py-2">
            <div className="flex -space-x-3 overflow-hidden">
              {budget.budget_participants.map((p:any, i:number) => (
                <div key={i} className={cn("h-8 w-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black", p.is_paid ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500")}>
                  {p.debtors?.name[0]}
                </div>
              ))}
            </div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">
              {paidCount} de {budget.budget_participants.length} pagaron
            </span>
          </div>

          <div className="flex gap-2 pt-2">
            <Dialog>
              <DialogTrigger asChild><Button variant="outline" className="flex-1 rounded-xl h-10 font-bold border-slate-100 gap-2"><Users className="h-4 w-4" /> Ver Cobros</Button></DialogTrigger>
              <DialogContent className="rounded-[2.5rem] p-8 max-w-[500px]">
                <DialogHeader><DialogTitle className="text-2xl font-black">Pagos: {budget.name}</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-4">
                  {budget.budget_participants.map((p:any) => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center font-black", p.is_paid ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600")}>
                          {p.debtors?.name[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{p.debtors?.name}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Falta: ${(p.share_amount - p.paid_amount).toFixed(2)}</span>
                        </div>
                      </div>
                      {p.is_paid ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      ) : (
                        <Button size="sm" className="rounded-lg h-8 font-black text-[10px] uppercase bg-indigo-600" onClick={() => { setSelectedParticipant({...p, debtorName: p.debtors?.name, budgetName: budget.name}); setPaymentForm(f => ({...f, amount: (p.share_amount - p.paid_amount).toFixed(2)})); setIsPaymentDialogOpen(true); }}>Cobrar</Button>
                      )}
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-300 hover:text-rose-500 hover:bg-rose-50" onClick={() => handleDelete(budget.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6 pb-24 max-w-5xl mx-auto">
      <header className="relative">
        <div className="absolute inset-0 bg-indigo-100/50 blur-3xl rounded-full -z-10" />
        <Card className="bg-slate-900 text-white rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
          <div className="p-8 space-y-4 relative">
            <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
              <img src={SHARED_PIGGY} alt="Shared" className="h-40 w-40 object-contain rotate-12" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Presupuestos en Equipo 🐷</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tighter">${budgets.reduce((s, b) => s + b.total_amount, 0).toLocaleString()}</span>
              <span className="text-xl font-bold opacity-40">MXN</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 bg-indigo-400/10 w-fit px-4 py-1.5 rounded-full">
              <Users className="h-3 w-3" /> {activeBudgets.length} gastos por cobrar
            </div>
          </div>
        </Card>
      </header>

      <section className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <Tabs defaultValue="active" className="w-full">
          <div className="flex items-center justify-between mb-8">
            <TabsList className="bg-slate-100 p-1 rounded-2xl h-11">
              <TabsTrigger value="active" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Activos ({activeBudgets.length})</TabsTrigger>
              <TabsTrigger value="completed" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Listos</TabsTrigger>
            </TabsList>
            <Button className="rounded-2xl h-11 px-6 font-black bg-indigo-600 shadow-xl gap-2" onClick={() => navigate('/shared-budgets/create')}>
              <PlusCircle className="h-5 w-5" /> <span className="hidden sm:inline">Nuevo Gasto</span>
            </Button>
          </div>
          
          <TabsContent value="active" className="grid grid-cols-1 sm:grid-cols-2 gap-6 outline-none">
            {activeBudgets.map(b => <BudgetCard key={b.id} budget={b} />)}
            {activeBudgets.length === 0 && <div className="col-span-full py-20 text-center opacity-30 font-black uppercase text-xs">¡Todo el equipo está al corriente!</div>}
          </TabsContent>
          <TabsContent value="completed" className="grid grid-cols-1 sm:grid-cols-2 gap-6 outline-none opacity-60 grayscale">
            {completedBudgets.map(b => <BudgetCard key={b.id} budget={b} />)}
          </TabsContent>
        </Tabs>
      </section>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-[400px]">
          <DialogHeader><DialogTitle className="text-2xl font-black">Registrar Abono</DialogTitle></DialogHeader>
          <form onSubmit={handleRecordPayment} className="grid gap-6 py-4">
             <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Monto Recibido</Label>
              <Input value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} className="rounded-2xl h-14 text-xl font-black bg-slate-50 border-none" required />
            </div>
            <div className="flex items-center space-x-2 bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <Checkbox id="skip" checked={skipLinked} onCheckedChange={(v) => setSkipLinked(!!v)} />
              <Label htmlFor="skip" className="text-xs font-bold text-blue-900 leading-tight">Ya registré este dinero en mi efectivo/banco manualmente</Label>
            </div>
            <Button type="submit" className="w-full rounded-2xl h-14 font-black text-lg bg-emerald-600 shadow-xl" disabled={isProcessing}>Confirmar Abono</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SharedBudgets;