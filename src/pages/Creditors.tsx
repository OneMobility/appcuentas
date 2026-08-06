"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  PlusCircle, 
  Trash2, 
  Eye, 
  Coins, 
  Search, 
  UserPlus,
  History,
  CheckCircle2,
  DollarSign
} from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { evaluateExpression } from "@/utils/math-helpers";
import { useNavigate } from "react-router-dom";
import { fetchUsdToMxnRate } from "@/utils/currency-helper";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const COCHINITO_TRISTE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/debo.gif";

const Creditors = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [isAddCreditorDialogOpen, setIsAddCreditorDialogOpen] = useState(false);
  const [newCreditor, setNewCreditor] = useState({ name: "", initial_balance: "" });
  const [searchTerm, setSearchTerm] = useState("");

  const [currency, setCurrency] = useState<"MXN" | "USD">("MXN");
  const [usdToMxnRate, setUsdToMxnRate] = useState<number>(20.00);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const rate = await fetchUsdToMxnRate();
        setUsdToMxnRate(rate);
      } catch (e) {
        console.error(e);
      }
    };
    fetchRate();
  }, [isAddCreditorDialogOpen]);

  const fetchCreditors = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('creditors')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) showError('Error al cargar acreedores: ' + error.message);
    else setCreditors(data || []);
  };

  useEffect(() => {
    fetchCreditors();
  }, [user]);

  const handleSubmitNewCreditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let baseBalance = evaluateExpression(newCreditor.initial_balance) || 0;
    if (isNaN(baseBalance) || baseBalance <= 0) {
      showError("Monto inválido.");
      return;
    }

    let finalBalance = baseBalance;
    let finalName = newCreditor.name;
    if (currency === "USD") {
      finalBalance = baseBalance * usdToMxnRate;
      finalName += ` (USD $${baseBalance.toFixed(2)})`;
    }

    const { data, error } = await supabase
      .from('creditors')
      .insert({
        user_id: user.id,
        name: finalName,
        initial_balance: finalBalance,
        current_balance: finalBalance,
      })
      .select();

    if (error) showError('Error: ' + error.message);
    else {
      setCreditors((prev) => [data[0], ...prev]);
      setIsAddCreditorDialogOpen(false);
      setNewCreditor({ name: "", initial_balance: "" });
      showSuccess("Acreedor registrado.");
    }
  };

  const handleDeleteCreditor = async (id: string) => {
    const { error } = await supabase.from('creditors').delete().eq('id', id);
    if (error) showError('Error: ' + error.message);
    else {
      setCreditors(prev => prev.filter(c => c.id !== id));
      showSuccess("Acreedor eliminado.");
    }
  };

  const filteredCreditors = creditors.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const activeCreditors = filteredCreditors.filter(c => c.current_balance > 0.01);
  const settledCreditors = filteredCreditors.filter(c => c.current_balance <= 0.01);

  const CreditorCard = ({ creditor }: { creditor: Creditor }) => {
    const initials = creditor.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return (
      <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="group relative">
        <Card className="rounded-[2rem] border-none shadow-sm hover:shadow-xl transition-all overflow-hidden bg-white">
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 font-black text-lg shadow-inner shrink-0">
                  {initials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-slate-900 truncate">{creditor.name}</span>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Debes</p>
                <p className="text-xl font-black text-rose-600">${creditor.current_balance.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-6">
              <Button 
                variant="outline" 
                className="rounded-xl h-10 font-bold border-slate-100 bg-slate-50/50 hover:bg-rose-50 hover:text-rose-600"
                onClick={() => navigate(`/creditors/${creditor.id}`)}
              >
                <DollarSign className="h-4 w-4 mr-1" /> Pagar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="rounded-xl h-10 font-bold">
                    <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="w-[90vw] max-w-md rounded-3xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar acreedor?</AlertDialogTitle>
                    <AlertDialogDescription>Se borrará a "{creditor.name}" y todo su historial permanentemente. Esta acción no se puede deshacer.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="rounded-xl" onClick={() => handleDeleteCreditor(creditor.id)}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialog>
              </AlertDialog>
            </div>
            
            <div className="flex justify-center mt-3">
              <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-slate-400 hover:text-primary rounded-lg" onClick={() => navigate(`/creditors/${creditor.id}`)}>
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
      <header className="relative">
        <div className="absolute inset-0 bg-rose-100/50 blur-3xl rounded-full -z-10" />
        <Card className="bg-rose-600 text-white rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
          <div className="p-8 relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-4 flex-1 text-center md:text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-100">Dinero que Debes 🐷</p>
              <div className="flex items-baseline justify-center md:justify-start gap-2">
                <span className="text-5xl font-black tracking-tighter">
                  ${activeCreditors.reduce((s, c) => s + c.current_balance, 0).toLocaleString()}
                </span>
                <span className="text-xl font-bold opacity-60">MXN</span>
              </div>
              <p className="text-xs font-medium text-rose-50/80">No te preocupes, ¡pronto serás libre de deudas!</p>
            </div>
            <div className="flex-shrink-0">
              <img src={COCHINITO_TRISTE} alt="Deuda" className="h-32 w-32 object-contain" />
            </div>
          </div>
        </Card>
      </header>

      <section className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar por nombre..." className="pl-10 rounded-2xl h-12 border-none shadow-sm bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Button className="rounded-2xl h-12 px-6 font-black bg-slate-900 shadow-xl gap-2 w-full md:w-auto" onClick={() => setIsAddCreditorDialogOpen(true)}>
          <UserPlus className="h-5 w-5" /> Nueva Deuda
        </Button>
      </section>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-2xl h-12">
          <TabsTrigger value="active" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Activas ({activeCreditors.length})</TabsTrigger>
          <TabsTrigger value="settled" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Saldadas ({settledCreditors.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-8">
          {activeCreditors.length === 0 ? (
            <div className="text-center py-20 opacity-30">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-xs">¡Sin deudas pendientes!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeCreditors.map(c => <CreditorCard key={c.id} creditor={c} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settled" className="mt-8">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60">
              {settledCreditors.map(c => (
                <Card key={c.id} className="rounded-[2rem] border-none shadow-sm grayscale bg-slate-50">
                  <div className="p-6 flex justify-between items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 font-bold text-sm shrink-0">
                        {c.name[0]}
                      </div>
                      <span className="font-bold text-slate-400 truncate">{c.name}</span>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 border-none rounded-full">Saldada</Badge>
                  </div>
                </Card>
              ))}
           </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isAddCreditorDialogOpen} onOpenChange={setIsAddCreditorDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-[2.5rem] p-8">
          <DialogHeader><DialogTitle className="text-2xl font-black tracking-tight">Nueva Deuda</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmitNewCreditor} className="grid gap-5 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">¿A quién le debes?</Label>
              <Input value={newCreditor.name} onChange={e => setNewCreditor({...newCreditor, name: e.target.value})} className="rounded-2xl h-12 bg-slate-50 border-none font-bold" required />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-1">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Monto de la Deuda</Label>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-[9px] gap-1">
                  <button type="button" onClick={() => setCurrency("MXN")} className={cn("px-2 py-0.5 rounded-md font-bold", currency === "MXN" ? "bg-white shadow-sm" : "text-slate-400")}>MXN</button>
                  <button type="button" onClick={() => setCurrency("USD")} className={cn("px-2 py-0.5 rounded-md font-bold", currency === "USD" ? "bg-white shadow-sm" : "text-slate-400")}>USD</button>
                </div>
              </div>
              <div className="relative">
                <Input value={newCreditor.initial_balance} onChange={e => setNewCreditor({...newCreditor, initial_balance: e.target.value})} className="rounded-2xl h-14 text-xl font-black bg-slate-50 border-none pr-12" required />
                <span className="absolute right-4 top-4 text-xs font-black text-slate-300">{currency}</span>
              </div>
              {currency === "USD" && newCreditor.initial_balance && (
                <p className="text-[10px] text-indigo-700 font-bold flex items-center gap-1">
                  <Coins className="h-3 w-3 animate-pulse" /> Equivale a ~ ${(parseFloat(newCreditor.initial_balance) * usdToMxnRate || 0).toFixed(2)} MXN
                </p>
              )}
            </div>
            <DialogFooter><Button type="submit" className="w-full rounded-2xl h-14 font-black text-lg bg-rose-600 shadow-xl shadow-rose-100">Registrar Deuda</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Creditors;