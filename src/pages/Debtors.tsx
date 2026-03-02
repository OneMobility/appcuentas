"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Trash2, Eye, Phone, Edit, DollarSign, AlertCircle } from "lucide-react";
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

interface Debtor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  phone?: string;
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
  
  const [newDebtor, setNewDebtor] = useState({ name: "", initial_balance: "", phone: "" });
  const [newTransaction, setNewTransaction] = useState({
    type: "payment" as "charge" | "payment",
    amount: "",
    description: "",
    destinationAccountId: "cash",
    selectedIncomeCategoryId: "",
  });
  const [skipLinkedTransaction, setSkipLinkedTransaction] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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

    let initialBalance: number;
    if (newDebtor.initial_balance.startsWith('=')) {
      initialBalance = evaluateExpression(newDebtor.initial_balance.substring(1)) || 0;
    } else {
      initialBalance = parseFloat(newDebtor.initial_balance);
    }

    if (isNaN(initialBalance) || initialBalance <= 0) {
      showError("Monto inválido.");
      return;
    }

    const { data, error } = await supabase
      .from('debtors')
      .insert({
        user_id: user.id,
        name: newDebtor.name,
        initial_balance: initialBalance,
        current_balance: initialBalance,
        phone: newDebtor.phone.trim() || null,
      })
      .select();

    if (error) showError('Error: ' + error.message);
    else {
      setDebtors((prev) => [data[0], ...prev]);
      setIsAddDebtorDialogOpen(false);
      setNewDebtor({ name: "", initial_balance: "", phone: "" });
      showSuccess("Deudor registrado.");
    }
  };

  const handleOpenEditDialog = (debtor: Debtor) => {
    setEditingDebtor(debtor);
    setNewDebtor({
      name: debtor.name,
      initial_balance: debtor.initial_balance.toString(),
      phone: debtor.phone || "",
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
      })
      .eq('id', editingDebtor.id)
      .select();

    if (error) showError('Error: ' + error.message);
    else {
      setDebtors((prev) => prev.map(d => d.id === editingDebtor.id ? data[0] : d));
      setIsEditDebtorDialogOpen(false);
      setEditingDebtor(null);
      setNewDebtor({ name: "", initial_balance: "", phone: "" });
      showSuccess("Deudor actualizado.");
    }
  };

  const handleOpenTransactionDialog = (debtor: Debtor) => {
    setSelectedDebtor(debtor);
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

    let amount: number;
    if (newTransaction.amount.startsWith('=')) {
      amount = evaluateExpression(newTransaction.amount.substring(1)) || 0;
    } else {
      amount = parseFloat(newTransaction.amount);
    }

    if (isNaN(amount) || amount <= 0) {
      showError("Monto inválido.");
      return;
    }

    const transactionDate = getLocalDateString(new Date());
    const linkedDescription = `Abono de ${selectedDebtor.name}: ${newTransaction.description}`;

    try {
      let newDebtorBalance = selectedDebtor.current_balance;

      if (newTransaction.type === "charge") {
        newDebtorBalance += amount;
      } else {
        if (newDebtorBalance < amount - 0.01) {
          showError("El abono excede la deuda.");
          return;
        }
        newDebtorBalance -= amount;

        if (!skipLinkedTransaction) {
          if (newTransaction.destinationAccountId === "cash") {
            await supabase.from('cash_transactions').insert({
              user_id: user.id,
              type: "ingreso",
              amount,
              description: linkedDescription,
              date: transactionDate,
              income_category_id: newTransaction.selectedIncomeCategoryId || null,
            });
          } else {
            const card = cards.find(c => c.id === newTransaction.destinationAccountId);
            if (card) {
              const newCardBalance = card.type === "credit" ? card.current_balance - amount : card.current_balance + amount;
              await supabase.from('cards').update({ current_balance: newCardBalance }).eq('id', card.id);
              await supabase.from('card_transactions').insert({
                user_id: user.id,
                card_id: card.id,
                type: "payment",
                amount,
                description: linkedDescription,
                date: transactionDate,
                income_category_id: newTransaction.selectedIncomeCategoryId || null,
              });
            }
          }
        }
      }

      await supabase.from('debtors').update({ current_balance: newDebtorBalance }).eq('id', selectedDebtor.id);
      await supabase.from('debtor_transactions').insert({
        user_id: user.id,
        debtor_id: selectedDebtor.id,
        type: newTransaction.type,
        amount,
        description: newTransaction.description + (skipLinkedTransaction ? " (Registro manual previo)" : ""),
        date: transactionDate,
      });

      showSuccess("Transacción registrada.");
      setIsTransactionDialogOpen(false);
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
              <TableCell className={cn(debtor.current_balance > 0 ? "text-red-600 font-semibold" : "text-green-600")}>
                ${debtor.current_balance.toFixed(2)}
              </TableCell>
              <TableCell className="text-right flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => handleOpenTransactionDialog(debtor)}>
                  <DollarSign className="h-4 w-4 mr-1" /> 
                  {debtor.current_balance <= 0 ? "Reabrir" : "Abonar"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/debtors/${debtor.id}`)}>
                  <Eye className="h-4 w-4 mr-1" /> Detalles
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
                  <Label>Saldo Inicial</Label>
                  <Input value={newDebtor.initial_balance} onChange={e => setNewDebtor({...newDebtor, initial_balance: e.target.value})} placeholder="Ej. 100" required />
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
              <Label>Monto</Label>
              <Input 
                value={newTransaction.amount} 
                onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                placeholder="Ej. 100"
                required
              />
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