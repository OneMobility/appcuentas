"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Trash2, Eye, Coins, Edit, Search } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { evaluateExpression } from "@/utils/math-helpers";
import { useNavigate } from "react-router-dom";
import { fetchUsdToMxnRate } from "@/utils/currency-helper";

const COCHINITO_TRISTE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/debo.gif";

interface Creditor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
}

const Creditors = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  
  const [isAddCreditorDialogOpen, setIsAddCreditorDialogOpen] = useState(false);
  const [isEditCreditorDialogOpen, setIsEditCreditorDialogOpen] = useState(false);
  
  const [newCreditor, setNewCreditor] = useState({ name: "", initial_balance: "" });
  const [editCreditorForm, setEditCreditorForm] = useState({ id: "", name: "" });
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

    let baseBalance: number;
    if (newCreditor.initial_balance.startsWith('=')) {
      baseBalance = evaluateExpression(newCreditor.initial_balance.substring(1)) || 0;
    } else {
      baseBalance = parseFloat(newCreditor.initial_balance);
    }

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
      setCreditors((prev) => [...prev, data[0]]);
      setIsAddCreditorDialogOpen(false);
      setNewCreditor({ name: "", initial_balance: "" });
      showSuccess("Acreedor registrado.");
    }
  };

  const handleOpenEditCreditor = (creditor: Creditor) => {
    setEditCreditorForm({ id: creditor.id, name: creditor.name });
    setIsEditCreditorDialogOpen(true);
  };

  const handleUpdateCreditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCreditorForm.id) return;

    const { error } = await supabase
      .from('creditors')
      .update({ name: editCreditorForm.name.trim() })
      .eq('id', editCreditorForm.id);

    if (error) showError("Error al actualizar: " + error.message);
    else {
      showSuccess("Nombre de acreedor actualizado.");
      setIsEditCreditorDialogOpen(false);
      fetchCreditors();
    }
  };

  const handleDeleteCreditor = async (id: string) => {
    try {
      await supabase.from('creditor_transactions').delete().eq('creditor_id', id);
      const { error } = await supabase.from('creditors').delete().eq('id', id);
      if (error) throw error;
      setCreditors(prev => prev.filter(c => c.id !== id));
      showSuccess("Acreedor eliminado.");
    } catch (err: any) {
      showError("Error al eliminar: " + err.message);
    }
  };

  const filteredCreditors = creditors.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const activeCreditors = filteredCreditors.filter(c => c.current_balance > 0);
  const completedCreditors = filteredCreditors.filter(c => c.current_balance <= 0);

  const CreditorCardsList = ({ list }: { list: Creditor[] }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {list.length === 0 ? (
        <p className="col-span-full text-center py-8 text-slate-400 text-sm font-medium">No hay registros en esta sección.</p>
      ) : (
        list.map((creditor) => (
          <Card key={creditor.id} className="rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between gap-4 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-black text-slate-900 text-base">{creditor.name}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  Deuda Inicial: ${creditor.initial_balance.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">Deuda Actual</span>
                <p className="text-xl font-black text-rose-600">${creditor.current_balance.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Button 
                variant="default" 
                size="sm" 
                className="flex-1 rounded-xl font-bold text-xs h-10 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => navigate(`/creditors/${creditor.id}`)}
              >
                <Eye className="h-4 w-4 mr-1.5" /> Ver Detalle
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                onClick={() => handleOpenEditCreditor(creditor)}
                title="Editar Acreedor"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl w-[90vw] max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar acreedor?</AlertDialogTitle>
                    <AlertDialogDescription>Se borrará la ficha de <b>{creditor.name}</b> junto con todo su historial.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="rounded-xl mt-0">Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteCreditor(creditor.id)} className="rounded-xl bg-rose-600">Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-2 sm:p-4 md:p-6 pb-24 max-w-5xl mx-auto">
      <header className="relative">
        <div className="absolute inset-0 bg-rose-100/50 blur-3xl rounded-full -z-10" />
        <Card className="bg-rose-600 text-white rounded-3xl md:rounded-[2.5rem] border-none shadow-xl overflow-hidden">
          <div className="p-6 md:p-8 relative flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            <div className="space-y-2 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-100">Dinero que Debes (Acreedores) 🐷</p>
              <div className="flex items-baseline justify-center sm:justify-start gap-2">
                <span className="text-4xl md:text-5xl font-black tracking-tight">
                  ${activeCreditors.reduce((s, c) => s + c.current_balance, 0).toLocaleString()}
                </span>
                <span className="text-lg font-bold opacity-70">MXN</span>
              </div>
              <p className="text-xs font-medium text-rose-50/90">Lleva el registro puntual para saldar tus deudas fácilmente.</p>
            </div>
            <div className="flex-shrink-0">
              <img src={COCHINITO_TRISTE} alt="Deuda" className="h-28 w-28 md:h-36 md:w-36 object-contain" />
            </div>
          </div>
        </Card>
      </header>

      <section className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar acreedor..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="pl-10 rounded-2xl h-11 border-slate-200 shadow-sm bg-white text-sm" 
          />
        </div>
        <Dialog open={isAddCreditorDialogOpen} onOpenChange={setIsAddCreditorDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl h-11 px-5 font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-md gap-2 w-full sm:w-auto">
              <PlusCircle className="h-4 w-4" /> Añadir Acreedor
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl p-6 sm:p-8 w-[95vw] max-w-[420px]">
            <DialogHeader><DialogTitle className="text-xl font-bold">Nuevo Acreedor</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmitNewCreditor} className="grid gap-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Nombre</Label>
                <Input 
                  value={newCreditor.name} 
                  onChange={e => setNewCreditor({...newCreditor, name: e.target.value})} 
                  placeholder="Ej. Banco, Amigo..." 
                  className="rounded-xl h-11 bg-slate-50 border-slate-200" 
                  required 
                />
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between items-center mb-1">
                  <Label className="text-xs font-bold text-slate-600">Saldo Inicial Deuda</Label>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] gap-1">
                    <button type="button" onClick={() => setCurrency("MXN")} className={cn("px-2 py-0.5 rounded-md font-bold transition-all", currency === "MXN" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400")}>MXN</button>
                    <button type="button" onClick={() => setCurrency("USD")} className={cn("px-2 py-0.5 rounded-md font-bold transition-all", currency === "USD" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400")}>USD</button>
                  </div>
                </div>
                <div className="relative">
                  <Input 
                    value={newCreditor.initial_balance} 
                    onChange={e => setNewCreditor({...newCreditor, initial_balance: e.target.value})} 
                    placeholder="Ej. 500" 
                    className="rounded-xl h-12 text-lg font-bold bg-slate-50 border-slate-200 pr-12" 
                    required 
                  />
                  <span className="absolute right-3.5 top-3.5 text-xs font-bold text-slate-400">{currency}</span>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full rounded-xl h-12 font-bold bg-rose-600 hover:bg-rose-700 text-white">
                  Guardar Acreedor
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-2xl h-12">
          <TabsTrigger value="active" className="rounded-xl font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Activos ({activeCreditors.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-xl font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Completados ({completedCreditors.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-6">
          <CreditorCardsList list={activeCreditors} />
        </TabsContent>
        <TabsContent value="completed" className="mt-6">
          <CreditorCardsList list={completedCreditors} />
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO EDITAR ACREEDOR */}
      <Dialog open={isEditCreditorDialogOpen} onOpenChange={setIsEditCreditorDialogOpen}>
        <DialogContent className="rounded-3xl p-6 sm:p-8 w-[95vw] max-w-[400px]">
          <DialogHeader><DialogTitle className="text-xl font-bold">Editar Nombre de Acreedor</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdateCreditor} className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Nombre</Label>
              <Input 
                value={editCreditorForm.name} 
                onChange={e => setEditCreditorForm({...editCreditorForm, name: e.target.value})} 
                className="rounded-xl h-11 bg-slate-50 border-slate-200" 
                required 
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
    </div>
  );
};

export default Creditors;