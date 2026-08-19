"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  PlusCircle, 
  Trash2, 
  Edit, 
  DollarSign, 
  MessageSquare, 
  Search, 
  UserPlus,
  History,
  CheckCircle2,
  Clock,
  Coins,
  Plus,
  Minus
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
import { useCategoryContext } from "@/context/CategoryContext";
import { cn } from "@/lib/utils";
import { format, parseISO, isBefore, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { fetchUsdToMxnRate } from "@/utils/currency-helper";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const GIF_COBRANDO = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/debtorsnuevos.gif";

interface DebtorTransaction {
  type: "charge" | "payment";
  amount: number;
}

interface Debtor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  phone?: string;
  due_date?: string;
  created_at: string;
  debtor_transactions: DebtorTransaction[];
}

const Debtors = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  
  const [isAddDebtorDialogOpen, setIsAddDebtorDialogOpen] = useState(false);
  const [isEditDebtorDialogOpen, setIsEditDebtorDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);
  const [editingDebtor, setEditingDebtor] = useState<Debtor | null>(null);
  
  const [newDebtor, setNewDebtor] = useState({ 
    name: "", 
    initial_balance: "", 
    initial_motive: "",
    phone: "", 
    due_date: undefined as Date | undefined 
  });
  const [editDebtorForm, setEditDebtorForm] = useState({ id: "", name: "", phone: "", due_date: "" });
  
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
      const totalCharges = (d.debtor_transactions || []).filter((t: any) => t.type === 'charge').reduce((s: number, t: any) => s + t.amount, 0);
      const totalPayments = (d.debtor_transactions || []).filter((t: any) => t.type === 'payment').reduce((s: number, t: any) => s + t.amount, 0);
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
    if (base < 0) return showError("El monto no puede ser negativo");

    let finalBal = addDebtorCurrency === "USD" ? base * usdToMxnRate : base;
    let name = addDebtorCurrency === "USD" ? `${newDebtor.name} (USD)` : newDebtor.name;
    const initialDescription = newDebtor.initial_motive.trim() || "Préstamo inicial / Apertura de cuenta";

    const { data: createdDebtor, error } = await supabase.from('debtors').insert({
      user_id: user?.id, 
      name, 
      initial_balance: finalBal, 
      current_balance: finalBal,
      phone: newDebtor.phone.trim() || null,
      due_date: newDebtor.due_date ? getLocalDateString(newDebtor.due_date) : null,
    }).select().single();

    if (error) {
      showError(error.message);
    } else {
      // Guardar también la transacción de apertura si hubo un monto inicial
      if (finalBal > 0 && createdDebtor) {
        await supabase.from('debtor_transactions').insert({
          user_id: user?.id,
          debtor_id: createdDebtor.id,
          type: "charge",
          amount: finalBal,
          description: initialDescription,
          date: getLocalDateString(new Date()),
        });
        // Como ya registramos el primer cargo en transacciones, ajustamos initial_balance a 0 para no duplicar el cálculo
        await supabase.from('debtors').update({ initial_balance: 0 }).eq('id', createdDebtor.id);
      }

      showSuccess("Deudor registrado exitosamente.");
      fetchData();
      setIsAddDebtorDialogOpen(false);
      setNewDebtor({ name: "", initial_balance: "", initial_motive: "", phone: "", due_date: undefined });
    }
  };

  const handleOpenEditDebtor = (debtor: Debtor) => {
    setEditingDebtor(debtor);
    setEditDebtorForm({
      id: debtor.id,
      name: debtor.name,
      phone: debtor.phone || "",
      due_date: debtor.due_date || "",
    });
    setIsEditDebtorDialogOpen(true);
  };

  const handleUpdateDebtor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDebtorForm.id) return;

    const { error } = await supabase.from('debtors').update({
      name: editDebtorForm.name.trim(),
      phone: editDebtorForm.phone.trim() || null,
      due_date: editDebtorForm.due_date || null,
    }).eq('id', editDebtorForm.id);

    if (error) showError("Error al actualizar: " + error.message);
    else {
      showSuccess("Datos del deudor actualizados.");
      setIsEditDebtorDialogOpen(false);
      fetchData();
    }
  };

  const handleDeleteDebtor = async (debtorId: string) => {
    try {
      await supabase.from('debtor_transactions').delete().eq('debtor_id', debtorId);
      const { error } = await supabase.from('debtors').delete().eq('id', debtorId);
      if (error) throw error;
      showSuccess("Deudor eliminado.");
      fetchData();
    } catch (err: any) {
      showError("Error al eliminar deudor: " + err.message);
    }
  };

  const handleOpenQuickTransaction = (debtor: Debtor, type: "payment" | "charge") => {
    setSelectedDebtor(debtor);
    setNewTransaction({
      type,
      amount: "",
      description: type === "payment" ? "Abono recibido" : "Préstamo / Cargo adicional",
      destinationAccountId: "cash",
      selectedIncomeCategoryId: incomeCategories[0]?.id || "",
    });
    setSkipLinkedTransaction(false);
    setIsTransactionDialogOpen(true);
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtor) return;
    let base = evaluateExpression(newTransaction.amount) || 0;
    if (base <= 0) return showError("Monto inválido");

    let finalAmt = txCurrency === "USD" ? base * usdToMxnRate : base;
    const date = getLocalDateString(new Date());
    const desc = newTransaction.description.trim() || (newTransaction.type === "payment" ? "Abono a cuenta" : "Cargo / Préstamo");

    try {
      await supabase.from('debtor_transactions').insert({
        user_id: user?.id,
        debtor_id: selectedDebtor.id,
        type: newTransaction.type,
        amount: finalAmt,
        description: desc,
        date
      });

      if (!skipLinkedTransaction) {
        if (newTransaction.type === "payment") {
          // El deudor me paga -> entra dinero
          if (newTransaction.destinationAccountId === "cash") {
            await supabase.from('cash_transactions').insert({
              user_id: user?.id,
              type: "ingreso",
              amount: finalAmt,
              description: `Abono de ${selectedDebtor.name}: ${desc}`,
              date,
              income_category_id: newTransaction.selectedIncomeCategoryId || null
            });
          } else {
            const card = cards.find(c => c.id === newTransaction.destinationAccountId);
            if (card) {
              const newBal = card.type === "credit" ? card.current_balance - finalAmt : card.current_balance + finalAmt;
              await supabase.from('cards').update({ current_balance: newBal }).eq('id', card.id);
              await supabase.from('card_transactions').insert({
                user_id: user?.id,
                card_id: card.id,
                type: "payment",
                amount: finalAmt,
                description: `Abono de ${selectedDebtor.name}: ${desc}`,
                date,
                income_category_id: newTransaction.selectedIncomeCategoryId || null
              });
            }
          }
        } else {
          // Es un Cargo / Préstamo adicional -> sale dinero de mi cuenta
          if (newTransaction.destinationAccountId === "cash") {
            await supabase.from('cash_transactions').insert({
              user_id: user?.id,
              type: "egreso",
              amount: finalAmt,
              description: `Préstamo a ${selectedDebtor.name}: ${desc}`,
              date,
              expense_category_id: null
            });
          } else {
            const card = cards.find(c => c.id === newTransaction.destinationAccountId);
            if (card) {
              const newBal = card.type === "credit" ? card.current_balance + finalAmt : card.current_balance - finalAmt;
              await supabase.from('cards').update({ current_balance: newBal }).eq('id', card.id);
              await supabase.from('card_transactions').insert({
                user_id: user?.id,
                card_id: card.id,
                type: "charge",
                amount: finalAmt,
                description: `Préstamo a ${selectedDebtor.name}: ${desc}`,
                date,
                expense_category_id: null
              });
            }
          }
        }
      }

      showSuccess(newTransaction.type === "payment" ? "Abono registrado con éxito" : "Cargo registrado con éxito");
      setIsTransactionDialogOpen(false);
      fetchData();
    } catch (err: any) { 
      showError("Error: " + err.message); 
    }
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
      <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="group relative">
        <Card className="rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden bg-white">
          <div className="p-5 flex flex-col gap-4">
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-base shadow-inner shrink-0">
                  {initials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-slate-900 truncate text-base">{debtor.name}</span>
                  {debtor.due_date && (
                    <span className={cn("text-[10px] font-bold uppercase flex items-center gap-1", isOverdue ? "text-rose-500 font-black" : "text-slate-400")}>
                      <Clock className="h-3 w-3 shrink-0" /> {isOverdue ? 'Vencido' : 'Vence'}: {format(parseISO(debtor.due_date), 'd MMM', { locale: es })}
                    </span>
                  )}
                </div>
              </div>

              {/* Botones de acción complementarios: WhatsApp, Editar, Eliminar */}
              <div className="flex items-center gap-1 shrink-0">
                {debtor.phone && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl"
                    onClick={() => handleWhatsApp(debtor)}
                    title="Cobrar por WhatsApp"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"
                  onClick={() => handleOpenEditDebtor(debtor)}
                  title="Editar Deudor"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
                      title="Eliminar Deudor"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl w-[90vw] max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar deudor?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se eliminará a <b>{debtor.name}</b> junto con todos sus registros asociados de préstamos y abonos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel className="rounded-xl mt-0">Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteDebtor(debtor.id)} className="rounded-xl bg-rose-600 hover:bg-rose-700">
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl flex justify-between items-center border border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deuda Pendiente:</span>
              <span className="text-2xl font-black text-indigo-600">${debtor.current_balance.toLocaleString()}</span>
            </div>

            {/* ACCIONES RÁPIDAS: ABONAR Y CARGO */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button 
                variant="default" 
                className="rounded-xl h-11 font-bold text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                onClick={() => handleOpenQuickTransaction(debtor, "payment")}
              >
                <DollarSign className="h-4 w-4" /> Abonar
              </Button>
              <Button 
                variant="outline" 
                className="rounded-xl h-11 font-bold text-xs gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 bg-rose-50/40"
                onClick={() => handleOpenQuickTransaction(debtor, "charge")}
              >
                <Plus className="h-4 w-4 text-rose-600" /> Cargo
              </Button>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-xl h-9" 
              onClick={() => navigate(`/debtors/${debtor.id}`)}
            >
              Ver Historial Completo <History className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-2 sm:p-4 md:p-6 pb-24 max-w-5xl mx-auto">
      
      {/* HEADER COBRANZA */}
      <header className="relative">
        <div className="absolute inset-0 bg-emerald-100/50 blur-3xl rounded-full -z-10" />
        <Card className="bg-emerald-600 text-white rounded-3xl md:rounded-[2.5rem] border-none shadow-xl overflow-hidden">
          <div className="p-6 md:p-8 relative flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            <div className="space-y-3 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Dinero por Cobrar 🐷</p>
              <div className="flex items-baseline justify-center sm:justify-start gap-2">
                <span className="text-4xl md:text-5xl font-black tracking-tight">
                  ${debtors.filter(d => d.current_balance > 0.01).reduce((s, d) => s + d.current_balance, 0).toLocaleString()}
                </span>
                <span className="text-lg font-bold opacity-70">MXN</span>
              </div>
              <p className="text-xs font-medium text-emerald-50/90">¡Lleva el control de quién te debe, aplica abonos y cargos rápidos!</p>
            </div>
            <div className="flex-shrink-0">
              <img src={GIF_COBRANDO} alt="Cobrando" className="h-28 w-28 md:h-36 md:w-36 object-contain" />
            </div>
          </div>
        </Card>
      </header>

      {/* FILTROS Y BÚSQUEDA */}
      <section className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar deudor..." 
            className="pl-10 rounded-2xl h-11 border-slate-200 shadow-sm bg-white text-sm" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
        <Button 
          className="rounded-2xl h-11 px-5 font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-md gap-2 w-full sm:w-auto" 
          onClick={() => setIsAddDebtorDialogOpen(true)}
        >
          <UserPlus className="h-4 w-4" /> Nuevo Deudor
        </Button>
      </section>

      {/* LISTA DE DEUDORES CON TABS */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-2xl h-12">
          <TabsTrigger value="active" className="rounded-xl font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Activos ({activeDebtors.length})
          </TabsTrigger>
          <TabsTrigger value="settled" className="rounded-xl font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Saldados ({settledDebtors.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-6">
          {activeDebtors.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 p-6">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
              <p className="font-bold text-slate-700 text-base">¡No tienes deudores activos!</p>
              <p className="text-xs text-slate-400 mt-1">Usa el botón "Nuevo Deudor" para registrar un nuevo préstamo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {activeDebtors.map(d => <DebtorCard key={d.id} debtor={d} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settled" className="mt-6">
          {settledDebtors.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 p-6 text-slate-400 text-xs">
              No hay cuentas saldadas aún.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {settledDebtors.map(d => (
                <Card key={d.id} className="rounded-3xl border border-slate-100 shadow-sm bg-slate-50/80">
                  <div className="p-5 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0">
                        {d.name[0]}
                      </div>
                      <span className="font-bold text-slate-700 text-sm truncate">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className="bg-emerald-100 text-emerald-800 border-none rounded-full text-[10px] font-bold">
                        Saldado
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-xl">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl w-[90vw] max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar registro saldado?</AlertDialogTitle>
                            <AlertDialogDescription>Se borrará la ficha de {d.name}.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteDebtor(d.id)} className="rounded-xl bg-rose-600">Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO AÑADIR DEUDOR */}
      <Dialog open={isAddDebtorDialogOpen} onOpenChange={setIsAddDebtorDialogOpen}>
        <DialogContent className="rounded-3xl p-6 sm:p-8 w-[95vw] max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Nuevo Deudor</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitNewDebtor} className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Nombre del deudor</Label>
              <Input 
                value={newDebtor.name} 
                onChange={e => setNewDebtor({...newDebtor, name: e.target.value})} 
                className="rounded-xl h-11 bg-slate-50 border-slate-200 font-medium" 
                placeholder="Ej. Juan Pérez"
                required 
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs font-bold text-slate-600">Monto Inicial que te debe</Label>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] gap-1">
                  <button type="button" onClick={() => setAddDebtorCurrency("MXN")} className={cn("px-2 py-0.5 rounded-md font-bold transition-all", addDebtorCurrency === "MXN" ? "bg-white shadow-sm text-slate-900" : "text-slate-400")}>MXN</button>
                  <button type="button" onClick={() => setAddDebtorCurrency("USD")} className={cn("px-2 py-0.5 rounded-md font-bold transition-all", addDebtorCurrency === "USD" ? "bg-white shadow-sm text-slate-900" : "text-slate-400")}>USD</button>
                </div>
              </div>
              <div className="relative">
                <Input 
                  value={newDebtor.initial_balance} 
                  onChange={e => setNewDebtor({...newDebtor, initial_balance: e.target.value})} 
                  className="rounded-xl h-12 text-lg font-bold bg-slate-50 border-slate-200 pr-12" 
                  placeholder="0.00"
                  required 
                />
                <span className="absolute right-3.5 top-3.5 text-xs font-bold text-slate-400">{addDebtorCurrency}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Motivo / Concepto del préstamo inicial</Label>
              <Input 
                value={newDebtor.initial_motive} 
                onChange={e => setNewDebtor({...newDebtor, initial_motive: e.target.value})} 
                placeholder="Ej. Préstamo para colegiatura, Cena..." 
                className="rounded-xl h-11 bg-slate-50 border-slate-200" 
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Teléfono (WhatsApp, Opcional)</Label>
              <Input 
                value={newDebtor.phone} 
                onChange={e => setNewDebtor({...newDebtor, phone: e.target.value})} 
                placeholder="Ej. 5215512345678" 
                className="rounded-xl h-11 bg-slate-50 border-slate-200" 
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Fecha de Vencimiento (Opcional)</Label>
              <Input 
                type="date"
                value={newDebtor.due_date ? getLocalDateString(newDebtor.due_date) : ""}
                onChange={e => setNewDebtor({...newDebtor, due_date: e.target.value ? parseISO(e.target.value) : undefined})}
                className="rounded-xl h-11 bg-slate-50 border-slate-200"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full rounded-xl h-12 font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                Registrar Deudor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO EDITAR DEUDOR */}
      <Dialog open={isEditDebtorDialogOpen} onOpenChange={setIsEditDebtorDialogOpen}>
        <DialogContent className="rounded-3xl p-6 sm:p-8 w-[95vw] max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Editar Deudor</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateDebtor} className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Nombre</Label>
              <Input 
                value={editDebtorForm.name} 
                onChange={e => setEditDebtorForm({...editDebtorForm, name: e.target.value})} 
                className="rounded-xl h-11 bg-slate-50 border-slate-200 font-medium" 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Teléfono (WhatsApp)</Label>
              <Input 
                value={editDebtorForm.phone} 
                onChange={e => setEditDebtorForm({...editDebtorForm, phone: e.target.value})} 
                className="rounded-xl h-11 bg-slate-50 border-slate-200" 
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Fecha de Vencimiento</Label>
              <Input 
                type="date"
                value={editDebtorForm.due_date} 
                onChange={e => setEditDebtorForm({...editDebtorForm, due_date: e.target.value})} 
                className="rounded-xl h-11 bg-slate-50 border-slate-200" 
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full rounded-xl h-12 font-bold bg-indigo-600 hover:bg-indigo-700 text-white">
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO RÁPIDO: ABONO O CARGO */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="rounded-3xl p-6 sm:p-8 w-[95vw] max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {newTransaction.type === "payment" ? "Registrar Abono" : "Registrar Cargo"} a {selectedDebtor?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <Button 
                type="button" 
                variant={newTransaction.type === 'payment' ? 'default' : 'ghost'} 
                className={cn("rounded-xl font-bold text-xs uppercase h-10", newTransaction.type === 'payment' && "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700")}
                onClick={() => setNewTransaction(prev => ({ ...prev, type: 'payment', description: 'Abono recibido' }))}
              >
                <DollarSign className="h-4 w-4 mr-1" /> Abono (Resta)
              </Button>
              <Button 
                type="button" 
                variant={newTransaction.type === 'charge' ? 'default' : 'ghost'} 
                className={cn("rounded-xl font-bold text-xs uppercase h-10", newTransaction.type === 'charge' && "bg-rose-600 text-white shadow-sm hover:bg-rose-700")}
                onClick={() => setNewTransaction(prev => ({ ...prev, type: 'charge', description: 'Préstamo / Cargo adicional' }))}
              >
                <Plus className="h-4 w-4 mr-1" /> Cargo (Suma)
              </Button>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs font-bold text-slate-600">
                  {newTransaction.type === "payment" ? "Monto del Abono" : "Monto del Cargo"}
                </Label>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] gap-1">
                  <button type="button" onClick={() => setTxCurrency("MXN")} className={cn("px-2 py-0.5 rounded-md font-bold transition-all", txCurrency === "MXN" ? "bg-white shadow-sm text-slate-900" : "text-slate-400")}>MXN</button>
                  <button type="button" onClick={() => setTxCurrency("USD")} className={cn("px-2 py-0.5 rounded-md font-bold transition-all", txCurrency === "USD" ? "bg-white shadow-sm text-slate-900" : "text-slate-400")}>USD</button>
                </div>
              </div>
              <Input 
                value={newTransaction.amount} 
                onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} 
                className="rounded-xl h-12 text-lg font-bold bg-slate-50 border-slate-200" 
                placeholder="0.00 o =50+50"
                required 
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Motivo / Descripción</Label>
              <Input 
                value={newTransaction.description} 
                onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} 
                placeholder="Ej. Pago parcial, Comida fin de semana..." 
                className="rounded-xl h-11 bg-slate-50 border-slate-200 font-medium text-sm" 
                required 
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                {newTransaction.type === "payment" ? "¿A qué cuenta ingresa el dinero?" : "¿De qué cuenta salió el dinero?"}
              </Label>
              <Select value={newTransaction.destinationAccountId} onValueChange={v => setNewTransaction({...newTransaction, destinationAccountId: v})}>
                <SelectTrigger className="rounded-xl h-11 bg-slate-50 border-slate-200 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="cash" className="rounded-xl">Efectivo (${cashBalance.toFixed(2)})</SelectItem>
                  {cards.map(c => (
                    <SelectItem key={c.id} value={c.id} className="rounded-xl">
                      {c.name} ({c.bank_name}) - Saldo: ${c.current_balance.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button 
                type="submit" 
                className={cn(
                  "w-full rounded-xl h-12 font-bold text-white shadow-md",
                  newTransaction.type === "payment" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                )}
              >
                {newTransaction.type === "payment" ? "Confirmar Abono" : "Confirmar Cargo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Debtors;