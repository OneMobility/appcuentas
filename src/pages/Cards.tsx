"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, DollarSign, Search, Banknote, ThumbsUp, ThumbsDown, PiggyBank } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import CardDisplay from "@/components/CardDisplay";
import ColorPicker from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import CardTransferDialog from "@/components/CardTransferDialog";
import { useCategoryContext } from "@/context/CategoryContext";
import { evaluateExpression } from "@/utils/math-helpers";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { getLocalDateString } from "@/utils/date-helpers";

const Cards = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, isLoadingCategories } = useCategoryContext();
  const [cards, setCards] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [debtorsBalance, setDebtorsBalance] = useState(0);
  const [creditorsBalance, setCreditorsBalance] = useState(0);
  
  const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");

  const [newCard, setNewCard] = useState({
    name: "", bank_name: "", last_four_digits: "", expiration_date: "",
    type: "debit" as "credit" | "debit", initial_balance: "", credit_limit: "",
    cut_off_day: "" as string, days_to_pay_after_cut_off: "" as string,
    color: "#3B82F6",
  });

  const [newTransaction, setNewTransaction] = useState({
    type: "charge" as "charge" | "payment",
    amount: "",
    description: "",
    selectedCategoryId: "",
  });

  const fetchAllData = async () => {
    if (!user) return;
    
    const [cardsRes, cashRes, debtorsRes, creditorsRes] = await Promise.all([
      supabase.from('cards').select('*, card_pockets(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('cash_transactions').select('type, amount').eq('user_id', user.id),
      supabase.from('debtors').select('current_balance').eq('user_id', user.id),
      supabase.from('creditors').select('current_balance').eq('user_id', user.id)
    ]);

    setCards(cardsRes.data || []);
    setCashBalance((cashRes.data || []).reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0));
    setDebtorsBalance((debtorsRes.data || []).reduce((s, d) => s + d.current_balance, 0));
    setCreditorsBalance((creditorsRes.data || []).reduce((s, c) => s + c.current_balance, 0));
  };

  useEffect(() => {
    if (user && !isLoadingCategories) fetchAllData();
  }, [user, isLoadingCategories]);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const balance = evaluateExpression(newCard.initial_balance) || 0;
    const limit = newCard.type === "credit" ? (evaluateExpression(newCard.credit_limit) || 0) : null;

    const { error } = await supabase.from('cards').insert({
      user_id: user?.id,
      name: newCard.name || `${newCard.bank_name} ${newCard.type}`,
      bank_name: newCard.bank_name,
      last_four_digits: newCard.last_four_digits,
      expiration_date: newCard.expiration_date,
      type: newCard.type,
      initial_balance: balance,
      current_balance: balance,
      color: newCard.color,
      credit_limit: limit,
      cut_off_day: newCard.cut_off_day ? parseInt(newCard.cut_off_day) : null,
      days_to_pay_after_cut_off: newCard.days_to_pay_after_cut_off ? parseInt(newCard.days_to_pay_after_cut_off) : null,
    });

    if (error) showError("Error al guardar tarjeta");
    else {
      showSuccess("Tarjeta añadida");
      setIsAddCardDialogOpen(false);
      fetchAllData();
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId) return;
    
    const amount = evaluateExpression(newTransaction.amount) || 0;
    if (amount <= 0) { showError("Monto inválido"); return; }

    const card = cards.find(c => c.id === selectedCardId);
    if (!card) return;

    let newBalance = card.current_balance;
    if (card.type === "debit") {
      newBalance = newTransaction.type === "charge" ? newBalance - amount : newBalance + amount;
    } else {
      newBalance = newTransaction.type === "charge" ? newBalance + amount : newBalance - amount;
    }

    const { error } = await supabase.from('card_transactions').insert({
      user_id: user?.id,
      card_id: selectedCardId,
      type: newTransaction.type,
      amount,
      description: newTransaction.description,
      date: getLocalDateString(new Date()),
      income_category_id: newTransaction.type === "payment" ? newTransaction.selectedCategoryId : null,
      expense_category_id: newTransaction.type === "charge" ? newTransaction.selectedCategoryId : null,
    });

    if (!error) {
      await supabase.from('cards').update({ current_balance: newBalance }).eq('id', selectedCardId);
      showSuccess("Movimiento registrado");
      setIsAddTransactionDialogOpen(false);
      fetchAllData();
    } else {
      showError("Error al registrar movimiento");
    }
  };

  const filteredCards = cards.filter(c => 
    (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.bank_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDebitBalance = cards.filter(c => c.type === "debit").reduce((s, c) => s + c.current_balance, 0);
  const totalCreditDebt = cards.filter(c => c.type === "credit").reduce((s, c) => s + c.current_balance, 0);
  const overallBalance = cashBalance + totalDebitBalance + debtorsBalance - creditorsBalance - totalCreditDebt;

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Tus Tarjetas</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-green-600 bg-green-50 text-green-800">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium flex items-center gap-2"><Banknote className="h-3 w-3" /> EFECTIVO</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${cashBalance.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-blue-600 bg-blue-50 text-blue-800">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium flex items-center gap-2"><ThumbsUp className="h-3 w-3" /> TE DEBEN</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${debtorsBalance.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-red-600 bg-red-50 text-red-800">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium flex items-center gap-2"><ThumbsDown className="h-3 w-3" /> DEBES</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${creditorsBalance.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-pink-600 bg-pink-50 text-pink-800">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium flex items-center gap-2"><PiggyBank className="h-3 w-3" /> BALANCE TOTAL</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${overallBalance.toFixed(2)}</div></CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tarjeta..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none" onClick={() => setIsTransferDialogOpen(true)}>Transferir</Button>
          <Button className="flex-1 md:flex-none" onClick={() => setIsAddCardDialogOpen(true)}><PlusCircle className="h-4 w-4 mr-2" /> Añadir Tarjeta</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCards.map(card => (
          <CardDisplay
            key={card.id}
            card={card}
            onAddTransaction={(id) => { setSelectedCardId(id); setIsAddTransactionDialogOpen(true); }}
            onDeleteCard={fetchAllData}
            onEditCard={() => {}}
            onTransfer={() => setIsTransferDialogOpen(true)}
          />
        ))}
      </div>

      <CardTransferDialog
        isOpen={isTransferDialogOpen}
        onClose={() => setIsTransferDialogOpen(false)}
        cards={cards}
        cashBalance={cashBalance}
        onTransferSuccess={fetchAllData}
      />

      {/* Diálogo de Movimiento Rápido */}
      <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Movimiento: {cards.find(c => c.id === selectedCardId)?.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={newTransaction.type} onValueChange={(v: any) => setNewTransaction({...newTransaction, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="charge">Gasto / Retiro</SelectItem>
                  <SelectItem value="payment">Pago / Depósito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Monto</Label>
              <Input value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} placeholder="0.00" required />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Input value={newTransaction.description} onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} required />
            </div>
            <div className="grid gap-2">
              <Label>Categoría</Label>
              <Select value={newTransaction.selectedCategoryId} onValueChange={(v) => setNewTransaction({...newTransaction, selectedCategoryId: v})}>
                <SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
                <SelectContent>
                  {(newTransaction.type === "charge" ? expenseCategories : incomeCategories).map(cat => (
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
            <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Nueva Tarjeta */}
      <Dialog open={isAddCardDialogOpen} onOpenChange={setIsAddCardDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Tarjeta</DialogTitle></DialogHeader>
          <form onSubmit={handleAddCard} className="grid gap-4 py-4">
            <Input placeholder="Banco" value={newCard.bank_name} onChange={e => setNewCard({...newCard, bank_name: e.target.value})} required />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Últimos 4 dígitos" maxLength={4} value={newCard.last_four_digits} onChange={e => setNewCard({...newCard, last_four_digits: e.target.value})} required />
              <Input placeholder="Expira (MM/AA)" maxLength={5} value={newCard.expiration_date} onChange={e => setNewCard({...newCard, expiration_date: e.target.value})} required />
            </div>
            <Select value={newCard.type} onValueChange={(v: any) => setNewCard({...newCard, type: v})}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent><SelectItem value="debit">Débito</SelectItem><SelectItem value="credit">Crédito</SelectItem></SelectContent>
            </Select>
            <Input placeholder="Saldo Inicial" value={newCard.initial_balance} onChange={e => setNewCard({...newCard, initial_balance: e.target.value})} required />
            {newCard.type === "credit" && (
              <>
                <Input placeholder="Límite de Crédito" value={newCard.credit_limit} onChange={e => setNewCard({...newCard, credit_limit: e.target.value})} required />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Día de Corte (1-31)" type="number" value={newCard.cut_off_day} onChange={e => setNewCard({...newCard, cut_off_day: e.target.value})} />
                  <Input placeholder="Días para pagar" type="number" value={newCard.days_to_pay_after_cut_off} onChange={e => setNewCard({...newCard, days_to_pay_after_cut_off: e.target.value})} />
                </div>
              </>
            )}
            <ColorPicker selectedColor={newCard.color} onSelectColor={c => setNewCard({...newCard, color: c})} />
            <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cards;