"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Trash2, Eye, Coins } from "lucide-react";
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

  const handleDeleteCreditor = async (id: string) => {
    const { error } = await supabase.from('creditors').delete().eq('id', id);
    if (error) showError('Error: ' + error.message);
    else {
      setCreditors(prev => prev.filter(c => c.id !== id));
      showSuccess("Acreedor eliminado.");
    }
  };

  const filteredCreditors = creditors.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const activeCreditors = filteredCreditors.filter(c => c.current_balance > 0);
  const completedCreditors = filteredCreditors.filter(c => c.current_balance <= 0);

  const CreditorTable = ({ list }: { list: Creditor[] }) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Saldo Inicial</TableHead>
            <TableHead>Saldo Actual</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((creditor) => (
            <TableRow key={creditor.id}>
              <TableCell className="font-medium">{creditor.name}</TableCell>
              <TableCell>${creditor.initial_balance.toFixed(2)}</TableCell>
              <TableCell>${creditor.current_balance.toFixed(2)}</TableCell>
              <TableCell className="text-right flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => navigate(`/creditors/${creditor.id}`)}>
                  <Eye className="h-4 w-4 mr-1" /> Detalles
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar acreedor?</AlertDialogTitle>
                      <AlertDialogDescription>Se borrará todo su historial permanentemente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteCreditor(creditor.id)}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-4">
      <header className="relative">
        <div className="absolute inset-0 bg-rose-100/50 blur-3xl rounded-full -z-10" />
        <Card className="bg-rose-600 text-white rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
          <div className="p-8 space-y-4 relative">
            <div className="absolute top-0 right-0 p-4 opacity-30">
              <img src={COCHINITO_TRISTE} alt="Deuda" className="h-32 w-32 object-contain" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-100">Dinero que Debes 🐷</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tighter">
                ${activeCreditors.reduce((s, c) => s + c.current_balance, 0).toLocaleString()}
              </span>
              <span className="text-xl font-bold opacity-60">MXN</span>
            </div>
            <p className="text-xs font-medium text-rose-50/80">No te preocupes, ¡pronto serás libre de deudas!</p>
          </div>
        </Card>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lista de Acreedores</CardTitle>
          <Dialog open={isAddCreditorDialogOpen} onOpenChange={setIsAddCreditorDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><PlusCircle className="h-4 w-4 mr-1" /> Añadir Acreedor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo Acreedor</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmitNewCreditor} className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Nombre</Label>
                  <Input value={newCreditor.name} onChange={e => setNewCreditor({...newCreditor, name: e.target.value})} required />
                </div>
                
                <div className="grid gap-2">
                  <div className="flex justify-between items-center">
                    <Label>Saldo Inicial</Label>
                    <div className="flex bg-muted p-0.5 rounded-lg text-xs gap-1">
                      <button type="button" onClick={() => setCurrency("MXN")} className={cn("px-2 py-1 rounded-md font-bold transition-all", currency === "MXN" ? "bg-white text-indigo-900 shadow-sm" : "text-muted-foreground")}>MXN</button>
                      <button type="button" onClick={() => setCurrency("USD")} className={cn("px-2 py-1 rounded-md font-bold transition-all", currency === "USD" ? "bg-white text-indigo-900 shadow-sm" : "text-muted-foreground")}>USD</button>
                    </div>
                  </div>
                  <div className="relative">
                    <Input value={newCreditor.initial_balance} onChange={e => setNewCreditor({...newCreditor, initial_balance: e.target.value})} placeholder="Ej. 100" className="pr-12" required />
                    <span className="absolute right-3.5 top-2.5 text-xs text-muted-foreground font-black">{currency}</span>
                  </div>
                  {currency === "USD" && newCreditor.initial_balance && (
                    <p className="text-[10px] text-indigo-700 font-bold flex items-center gap-1">
                      <Coins className="h-3 w-3 animate-pulse" /> Equivale a ~ ${(parseFloat(newCreditor.initial_balance) * usdToMxnRate || 0).toFixed(2)} MXN (tasa: ${usdToMxnRate.toFixed(2)})
                    </p>
                  )}
                </div>

                <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mb-4 max-w-sm" />
          <Tabs defaultValue="active">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="active">Activos ({activeCreditors.length})</TabsTrigger>
              <TabsTrigger value="completed">Completados ({completedCreditors.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              <CreditorTable list={activeCreditors} />
            </TabsContent>
            <TabsContent value="completed">
              <CreditorTable list={completedCreditors} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Creditors;