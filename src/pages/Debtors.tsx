"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Trash2, Eye, Phone, Edit, DollarSign, AlertCircle, CalendarIcon, Coins } from "lucide-react";
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
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { fetchUsdToMxnRate } from "@/utils/currency-helper";

interface Debtor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  phone?: string;
  due_date?: string;
}

interface CardData {
  id: string;
  name: string;
  bank_name: string;
  type: "credit" | "debit";
  current_balance: number;
}

const Debtors = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const { incomeCategories } = useCategoryContext();
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [cards, setCards] = useState<CardData[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  
  const [isAddDebtorDialogOpen, setIsAddDebtorDialogOpen] = useState(false);
  const [isEditDebtorDialogOpen, setIsEditDebtorDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  
  const [editingDebtor, setEditingDebtor] = useState<Debtor | null>(null);
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);
  
  const [newDebtor, setNewDebtor] = useState({ name: "", initial_balance: "", phone: "", due_date: undefined as Date | undefined });
  const [newTransaction, setNewTransaction] = useState({
    type: "payment" as "charge" | "payment",
    amount: "",
    description: "",
    destinationAccountId: "cash",
    selectedIncomeCategoryId: "",
  });

  // Monedas y conversión
  const [addDebtorCurrency, setAddDebtorCurrency] = useState<"MXN" | "USD">("MXN");
  const [txCurrency, setTxCurrency] = useState<"MXN" | "USD">("MXN");
  const [usdToMxnRate, setUsdToMxnRate] = useState<number>(20.00);

  const [skipLinkedTransaction, setSkipLinkedTransaction] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Cargar tasa de cambio
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
  }, [isAddDebtorDialogOpen, isTransactionDialogOpen]);

  const fetchData = async () => {
    if (!user) return;
    
    const { data: debtorsData, error: dError } = await supabase
      .from('debtors')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (dError) showError('Error al cargar deudores: ' + dError.message);
    else setDebtors(debtorsData || []);

    const { data: cardsData } = await supabase
      .from('cards')
      .select('id, name, bank_name, type, current_balance')
      .eq('user_id', user.id);
    setCards(cardsData || []);

    const { data: cashTxData } = await supabase
      .from('cash_transactions')
      .select('type, amount')
      .eq('user_id', user.id);
    
    const currentCash = (cashTxData || []).reduce((sum, tx) => 
      tx.type === "ingreso" ? sum + tx.amount : sum - tx.amount, 0
    );
    setCashBalance(currentCash);

    if (!newTransaction.selectedIncomeCategoryId && incomeCategories.length > 0) {
      setNewTransaction(prev => ({ ...prev, selectedIncomeCategoryId: incomeCategories[0].id }));
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, incomeCategories]);

  const handleSubmitNewDebtor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let baseBalance: number;
    if (newDebtor.initial_balance.startsWith('=')) {
      baseBalance = evaluateExpression(newDebtor.initial_balance.substring(1)) || 0;
    } else {
      baseBalance = parseFloat(newDebtor.initial_balance);
    }

    if (isNaN(baseBalance) || baseBalance <= 0) {
      showError("Monto inválido.");
      return;
    }

    // Convertir si se registra en dólares
    let finalBalance = baseBalance;
    let finalName = newDebtor.name;
    if (addDebtorCurrency === "USD") {
      finalBalance = baseBalance * usdToMxnRate;
      finalName += ` (USD $${baseBalance.toFixed(2)})`;
    }

    const { data, error } = await supabase
      .from('debtors')
      .insert({
        user_id: user.id,
        name: finalName,
        initial_balance: finalBalance,
        current_balance: finalBalance,
        phone: newDebtor.phone.trim() || null,
        due_date: newDebtor.due_date ? getLocalDateString(newDebtor.due_date) : null,
      })
      .select();

    if (error) showError('Error: ' + error.message);
    else {
      setDebtors((prev) => [data[0], ...prev]);
      setIsAddDebtorDialogOpen(false);
      setNewDebtor({ name: "", initial_balance: "", phone: "", due_date: undefined });
      showSuccess("Deudor registrado.");
    }
  };

  const handleOpenEditDialog = (debtor: Debtor) => {
    setEditingDebtor(debtor);
    setNewDebtor({
      name: debtor.name,
      initial_balance: debtor.initial_balance.toString(),
      phone: debtor.phone || "",
      due_date: debtor.due_date ? parseISO(debtor.due_date) : undefined,
    });
    setIsEditDebtorDialogOpen(true);
  };

  const handleUpdateDebtor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingDebtor) return;

    const { data, error } = await supabase
      .from('debtors')
      .update({
        name: newDebtor.name.trim(),
        phone: newDebtor.phone.trim() || null,
        due_date: newDebtor.due_date ? getLocalDateString(newDebtor.due_date) : null,
      })
      .eq('id', editingDebtor.id)
      .select();

    if (error) showError('Error: ' + error.message);
    else {
      setDebtors((prev) => prev.map(d => d.id === editingDebtor.id ? data[0] : d));
      setIsEditDebtorDialogOpen(false);
      setEditingDebtor(null);
      setNewDebtor({ name: "", initial_balance: "", phone: "", due_date: undefined });
      showSuccess("Deudor actualizado.");
    }
  };

  const handleOpenTransactionDialog = (debtor: Debtor) => {
    setSelectedDebtor(debtor);
    setTxCurrency("MXN");
    setNewTransaction({
      type: debtor.current_balance <= 0 ? "charge" : "payment",
      amount: "",
      description: "",
      destinationAccountId: "cash",
      selectedIncomeCategoryId: incomeCategories[0]?.id || "",
    });
    setSkipLinkedTransaction(false);
    setIsTransactionDialogOpen(true);
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDebtor) return;

    let baseAmount: number;
    if (newTransaction.amount.startsWith('=')) {
      baseAmount = evaluateExpression(newTransaction.amount.substring(1)) || 0;
    } else {
      baseAmount = parseFloat(newTransaction.amount);
    }

    if (isNaN(baseAmount) || baseAmount <= 0) {
      showError("Monto inválido.");
      return;
    }

    // Convertir de USD a MXN si es necesario
    let finalAmount = baseAmount;
    let finalDescription = newTransaction.description;
    if (txCurrency === "USD") {
      finalAmount = baseAmount * usdToMxnRate;
      finalDescription += ` (Reg: $${baseAmount.toFixed(2)} USD a tasa $${usdToMxnRate.toFixed(2)} MXN)`;
    }

    const transactionDate = getLocalDateString(new Date());
    const linkedDescription = `Abono de ${selectedDebtor.name}: ${finalDescription}`;

    try {
      const { error: insertError } = await supabase.from('debtor_transactions').insert({
        user_id: user.id,
        debtor_id: selectedDebtor.id,
        type: newTransaction.type,
        amount: finalAmount,
        description: finalDescription + (skipLinkedTransaction ? " (Registro manual previo)" : ""),
        date: transactionDate,
      });

      if (insertError) throw insertError;

      if (newTransaction.type === "payment" && !skipLinkedTransaction) {
        if (newTransaction.destinationAccountId === "cash") {
          await supabase.from('cash_transactions').insert({
            user_id: user.id,
            type: "ingreso",
            amount: finalAmount,
            description: linkedDescription,
            date: transactionDate,
            income_category_id: newTransaction.selectedIncomeCategoryId || null,
          });
        } else {
          const card = cards.find(c => c.id === newTransaction.destinationAccountId);
          if (card) {
            const newCardBalance = card.type === "credit" ? card.current_balance - finalAmount : card.current_balance + finalAmount;
            await supabase.from('cards').update({ current_balance: newCardBalance }).eq('id', card.id);
            await supabase.from('card_transactions').insert({
              user_id: user.id,
              card_id: card.id,
              type: "payment",
              amount: finalAmount,
              description: linkedDescription,
              date: transactionDate,
              income_category_id: newTransaction.selectedIncomeCategoryId || null,
            });
          }
        }
      }

      const { data: txs, error: fetchError } = await supabase
        .from('debtor_transactions')
        .select('type, amount')
        .eq('debtor_id', selectedDebtor.id);
      
      if (fetchError) throw fetchError;

      const totalCharges = (txs || [])
        .filter(t => t.type === 'charge')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalPayments = (txs || [])
        .filter(t => t.type === 'payment')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const newBalance = selectedDebtor.initial_balance + totalCharges - totalPayments;

      const { error: updateError } = await supabase
        .from('debtors')
        .update({ current_balance: newBalance })
        .eq('id', selectedDebtor.id);

      if (updateError) throw updateError;

      showSuccess("Transacción registrada.");
      setIsTransactionDialogOpen(false);
      
      if (selectedDebtor.phone) {
        if (window.confirm("¿Deseas enviar un comprobante por WhatsApp?")) {
          const typeLabel = newTransaction.type === "charge" ? "Cargo" : "Abono";
          const msg = `Hola ${selectedDebtor.name}, se ha registrado un ${typeLabel} por $${finalAmount.toFixed(2)}. Tu saldo actual es $${newBalance.toFixed(2)}.`;
          const cleanPhone = selectedDebtor.phone.replace(/\D/g, '');
          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        }
      }
      
      fetchData();
    } catch (error: any) {
      showError('Error: ' + error.message);
    }
  };

  const handleDeleteDebtor = async (id: string) => {
    const { error } = await supabase.from('debtors').delete().eq('id', id);
    if (error) showError('Error: ' + error.message);
    else {
      setDebtors(prev => prev.filter(d => d.id !== id));
      showSuccess("Deudor eliminado.");
    }
  };

  const filteredDebtors = debtors.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const activeDebtors = filteredDebtors.filter(d => d.current_balance > 0);
  const completedDebtors = filteredDebtors.filter(d => d.current_balance <= 0);

  const DebtorTable = ({ list }: { list: Debtor[] }) => (
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
          {list.map((debtor) => (
            <TableRow key={debtor.id}>
              <TableCell className="font-medium">{debtor.name}</TableCell>
              <TableCell>${debtor.initial_balance.toFixed(2)}</TableCell>
              <TableCell>${debtor.current_balance.toFixed(2)}</TableCell>
              <TableCell className="text-right flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => navigate(`/debtors/${debtor.id}`)}>
                  <Eye className="h-4 w-4 mr-1" /> Detalles
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenTransactionDialog(debtor)}>
                  <DollarSign className="h-4 w-4 mr-1" /> 
                  {debtor.current_balance <= 0 ? "Reabrir" : "Abonar"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(debtor)}>
                  <Edit className="h-4 w-4 mr-1" /> Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar deudor?</AlertDialogTitle>
                      <AlertDialogDescription>Se borrará todo su historial permanentemente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteDebtor(debtor.id)}>Eliminar</AlertDialogAction>
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
      <h1 className="text-3xl font-bold">Los que te deben</h1>

      <Card className="border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800">
        <CardHeader><CardTitle>Saldo Total de Deudores</CardTitle></CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">${activeDebtors.reduce((s, d) => s + d.current_balance, 0).toFixed(2)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lista de Deudores</CardTitle>
          <Dialog open={isAddDebtorDialogOpen} onOpenChange={setIsAddDebtorDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><PlusCircle className="h-4 w-4 mr-1" /> Añadir Deudor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo Deudor</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmitNewDebtor} className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Nombre</Label>
                  <Input value={newDebtor.name} onChange={e => setNewDebtor({...newDebtor, name: e.target.value})} required />
                </div>
                
                <div className="grid gap-2">
                  <div className="flex justify-between items-center">
                    <Label>Saldo Inicial</Label>
                    <div className="flex bg-muted p-0.5 rounded-lg text-xs gap-1">
                      <button type="button" onClick={() => setAddDebtorCurrency("MXN")} className={cn("px-2 py-1 rounded-md font-bold transition-all", addDebtorCurrency === "MXN" ? "bg-white text-indigo-900 shadow-sm" : "text-muted-foreground")}>MXN</button>
                      <button type="button" onClick={() => setAddDebtorCurrency("USD")} className={cn("px-2 py-1 rounded-md font-bold transition-all", addDebtorCurrency === "USD" ? "bg-white text-indigo-900 shadow-sm" : "text-muted-foreground")}>USD</button>
                    </div>
                  </div>
                  <div className="relative">
                    <Input value={newDebtor.initial_balance} onChange={e => setNewDebtor({...newDebtor, initial_balance: e.target.value})} placeholder="Ej. 100" className="pr-12" required />
                    <span className="absolute right-3.5 top-2.5 text-xs text-muted-foreground font-black">{addDebtorCurrency}</span>
                  </div>
                  {addDebtorCurrency === "USD" && newDebtor.initial_balance && (
                    <p className="text-[10px] text-indigo-700 font-bold flex items-center gap-1">
                      <Coins className="h-3 w-3 animate-pulse" /> Equivale a ~ ${(parseFloat(newDebtor.initial_balance) * usdToMxnRate || 0).toFixed(2)} MXN (tasa: ${usdToMxnRate.toFixed(2)})
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label>Vencimiento (Opcional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("justify-start text-left font-normal", !newDebtor.due_date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newDebtor.due_date ? format(newDebtor.due_date, "PPP", { locale: es }) : "Selecciona una fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newDebtor.due_date} onSelect={d => setNewDebtor({...newDebtor, due_date: d})} locale={es} /></PopoverContent>
                  </Popover>
                </div>
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" /> Teléfono (Opcional)
                  </Label>
                  <Input 
                    value={newDebtor.phone} 
                    onChange={e => setNewDebtor({...newDebtor, phone: e.target.value})} 
                    placeholder="Ej. 521234567890" 
                  />
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
              <TabsTrigger value="active">Activos ({activeDebtors.length})</TabsTrigger>
              <TabsTrigger value="completed">Completados ({completedDebtors.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active"><DebtorTable list={activeDebtors} /></TabsContent>
            <TabsContent value="completed"><DebtorTable list={completedDebtors} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Diálogo de Edición */}
      <Dialog open={isEditDebtorDialogOpen} onOpenChange={setIsEditDebtorDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Deudor</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdateDebtor} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={newDebtor.name} onChange={e => setNewDebtor({...newDebtor, name: e.target.value})} required />
            </div>
            <div className="grid gap-2">
              <Label>Vencimiento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !newDebtor.due_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newDebtor.due_date ? format(newDebtor.due_date, "PPP", { locale: es }) : "Selecciona una fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newDebtor.due_date} onSelect={d => setNewDebtor({...newDebtor, due_date: d})} locale={es} /></PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> Teléfono (Opcional)
              </Label>
              <Input 
                value={newDebtor.phone} 
                onChange={e => setNewDebtor({...newDebtor, phone: e.target.value})} 
                placeholder="Ej. 521234567890" 
                  />
                </div>
            <DialogFooter><Button type="submit">Actualizar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Transacción Rápida */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Movimiento: {selectedDebtor?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={newTransaction.type} onValueChange={(v: any) => setNewTransaction({...newTransaction, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment">Abono (Me paga)</SelectItem>
                  <SelectItem value="charge">Cargo (Me debe más / Reabrir)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label>Monto</Label>
                <div className="flex bg-muted p-0.5 rounded-lg text-xs gap-1">
                  <button type="button" onClick={() => setTxCurrency("MXN")} className={cn("px-2 py-1 rounded-md font-bold transition-all", txCurrency === "MXN" ? "bg-white text-indigo-900 shadow-sm" : "text-muted-foreground")}>MXN</button>
                  <button type="button" onClick={() => setTxCurrency("USD")} className={cn("px-2 py-1 rounded-md font-bold transition-all", txCurrency === "USD" ? "bg-white text-indigo-900 shadow-sm" : "text-muted-foreground")}>USD</button>
                </div>
              </div>
              <div className="relative">
                <Input value={newTransaction.amount} onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})} placeholder="Ej. 100" className="pr-12" required />
                <span className="absolute right-3.5 top-2.5 text-xs text-muted-foreground font-black">{txCurrency}</span>
              </div>
              {txCurrency === "USD" && newTransaction.amount && (
                <p className="text-[10px] text-indigo-700 font-bold flex items-center gap-1">
                  <Coins className="h-3 w-3 animate-pulse" /> Equivale a ~ ${(parseFloat(newTransaction.amount) * usdToMxnRate || 0).toFixed(2)} MXN (tasa: ${usdToMxnRate.toFixed(2)})
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Input 
                value={newTransaction.description} 
                onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                required
              />
            </div>
            {newTransaction.type === "payment" && (
              <>
                <div className="flex items-center space-x-2 bg-blue-50 p-3 rounded-md border border-blue-100">
                  <Checkbox id="skip" checked={skipLinkedTransaction} onCheckedChange={(v) => setSkipLinkedTransaction(!!v)} />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor="skip" className="text-sm font-medium leading-none flex items-center gap-1">
                      Ya registré este ingreso manualmente <AlertCircle className="h-3 w-3 text-blue-500" />
                    </label>
                  </div>
                </div>
                {!skipLinkedTransaction && (
                  <>
                    <div className="grid gap-2">
                      <Label>Destino</Label>
                      <Select value={newTransaction.destinationAccountId} onValueChange={(v) => setNewTransaction({...newTransaction, destinationAccountId: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Efectivo (${cashBalance.toFixed(2)})</SelectItem>
                          {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Categoría</Label>
                      <Select value={newTransaction.selectedIncomeCategoryId} onValueChange={(v) => setNewTransaction({...newTransaction, selectedIncomeCategoryId: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {incomeCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-4 w-4" />
                                {cat.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </>
            )}
            <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Debtors;