"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, DollarSign, Search, Scale, ArrowRightLeft } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import CardDisplay from "@/components/CardDisplay";
import ColorPicker from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import CardTransferDialog from "@/components/CardTransferDialog";
import CardReconciliationDialog from "@/components/CardReconciliationDialog";
import { useCategoryContext } from "@/context/CategoryContext";
import { evaluateExpression } from "@/utils/math-helpers";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { getLocalDateString } from "@/utils/date-helpers";

const Cards = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, isLoadingCategories } = useCategoryContext();
  
  const [cards, setCards] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  
  const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);
  const [isEditCardDialogOpen, setIsEditCardDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [isReconcileDialogOpen, setIsReconcileDialogOpen] = useState(false);
  const [isSelectCardForReconcileOpen, setIsSelectCardForReconcileOpen] = useState(false);
  
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [cardForm, setCardForm] = useState({
    id: "", name: "", bank_name: "", last_four_digits: "", expiration_date: "",
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
    
    const [cardsRes, cashRes] = await Promise.all([
      supabase.from('cards').select('*, card_pockets(*), card_transactions(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('cash_transactions').select('type, amount').eq('user_id', user.id)
    ]);

    setCards(cardsRes.data || []);
    setCashBalance((cashRes.data || []).reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0));
  };

  useEffect(() => {
    if (user && !isLoadingCategories) fetchAllData();
  }, [user, isLoadingCategories]);

  const handleOpenAddCard = () => {
    setCardForm({
      id: "", name: "", bank_name: "", last_four_digits: "", expiration_date: "",
      type: "debit", initial_balance: "0", credit_limit: "",
      cut_off_day: "", days_to_pay_after_cut_off: "", color: "#3B82F6",
    });
    setIsAddCardDialogOpen(true);
  };

  const handleOpenEditCard = (card: any) => {
    setCardForm({
      id: card.id,
      name: card.name,
      bank_name: card.bank_name,
      last_four_digits: card.last_four_digits,
      expiration_date: card.expiration_date,
      type: card.type,
      initial_balance: card.initial_balance.toString(),
      credit_limit: card.credit_limit?.toString() || "",
      cut_off_day: card.cut_off_day?.toString() || "",
      days_to_pay_after_cut_off: card.days_to_pay_after_cut_off?.toString() || "",
      color: card.color,
    });
    setIsEditCardDialogOpen(true);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const balance = evaluateExpression(cardForm.initial_balance) || 0;
    const limit = cardForm.type === "credit" ? (evaluateExpression(cardForm.credit_limit) || 0) : null;

    const cardData = {
      user_id: user.id,
      name: cardForm.name || `${cardForm.bank_name} ${cardForm.type}`,
      bank_name: cardForm.bank_name,
      last_four_digits: cardForm.last_four_digits,
      expiration_date: cardForm.expiration_date,
      type: cardForm.type,
      initial_balance: balance,
      color: cardForm.color,
      credit_limit: limit,
      cut_off_day: cardForm.cut_off_day ? parseInt(cardForm.cut_off_day) : null,
      days_to_pay_after_cut_off: cardForm.days_to_pay_after_cut_off ? parseInt(cardForm.days_to_pay_after_cut_off) : null,
    };

    let error;
    if (cardForm.id) {
      const { error: updateError } = await supabase.from('cards').update(cardData).eq('id', cardForm.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('cards').insert({ ...cardData, current_balance: balance });
      error = insertError;
    }

    if (error) showError("Error al guardar tarjeta: " + error.message);
    else {
      showSuccess(cardForm.id ? "Tarjeta actualizada" : "Tarjeta añadida");
      setIsAddCardDialogOpen(false);
      setIsEditCardDialogOpen(false);
      fetchAllData();
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard) return;
    
    const amount = evaluateExpression(newTransaction.amount) || 0;
    if (amount <= 0) { showError("Monto inválido"); return; }

    let newBalance = selectedCard.current_balance;
    if (selectedCard.type === "debit") {
      newBalance = newTransaction.type === "charge" ? newBalance - amount : newBalance + amount;
    } else {
      newBalance = newTransaction.type === "charge" ? newBalance + amount : newBalance - amount;
    }

    const { error } = await supabase.from('card_transactions').insert({
      user_id: user?.id,
      card_id: selectedCard.id,
      type: newTransaction.type,
      amount,
      description: newTransaction.description,
      date: getLocalDateString(new Date()),
      income_category_id: newTransaction.type === "payment" ? newTransaction.selectedCategoryId : null,
      expense_category_id: newTransaction.type === "charge" ? newTransaction.selectedCategoryId : null,
    });

    if (!error) {
      await supabase.from('cards').update({ current_balance: newBalance }).eq('id', selectedCard.id);
      showSuccess("Movimiento registrado");
      setIsAddTransactionDialogOpen(false);
      fetchAllData();
    } else {
      showError("Error al registrar movimiento");
    }
  };

  const handleOpenReconcile = () => {
    if (cards.length === 0) {
      showError("No tienes tarjetas para cuadrar.");
      return;
    }
    setIsSelectCardForReconcileOpen(true);
  };

  const handleSelectCardForReconcile = (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (card) {
      setSelectedCard(card);
      setIsSelectCardForReconcileOpen(false);
      setIsReconcileDialogOpen(true);
    }
  };

  const filteredCards = cards.filter(c => 
    (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.bank_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDebitBalance = cards.filter(c => c.type === "debit").reduce((s, c) => s + c.current_balance, 0);
  const totalCreditDebt = cards.filter(c => c.type === "credit").reduce((s, c) => s + c.current_balance, 0);
  const totalAvailableCredit = cards.filter(c => c.type === "credit").reduce((s, c) => s + ((c.credit_limit || 0) - c.current_balance), 0);
  const netCardBalance = totalDebitBalance - totalCreditDebt;

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Tus Tarjetas</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-green-600 bg-green-50 text-green-800">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">SALDO EN DÉBITO</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${totalDebitBalance.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-red-600 bg-red-50 text-red-800">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">DEUDA DE CRÉDITO</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${totalCreditDebt.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-blue-600 bg-blue-50 text-blue-800">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">CRÉDITO DISPONIBLE</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${totalAvailableCredit.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-pink-600 bg-pink-50 text-pink-800">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">BALANCE NETO TARJETAS</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${netCardBalance.toFixed(2)}</div></CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tarjeta..." className="pl-8 h-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setIsTransferDialogOpen(true)} title="Transferir"><ArrowRightLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleOpenReconcile} title="Cuadrar Saldo"><Scale className="h-4 w-4" /></Button>
          <Button variant="default" size="icon" className="h-9 w-9" onClick={handleOpenAddCard} title="Añadir Tarjeta"><PlusCircle className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCards.map(card => (
          <CardDisplay
            key={card.id}
            card={card}
            onAddTransaction={() => { setSelectedCard(card); setIsAddTransactionDialogOpen(true); }}
            onDeleteCard={fetchAllData}
            onEditCard={handleOpenEditCard}
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

      {/* Diálogo de Selección de Tarjeta para Cuadre */}
      <Dialog open={isSelectCardForReconcileOpen} onOpenChange={setIsSelectCardForReconcileOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Selecciona Tarjeta para Cuadrar</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <Select onValueChange={handleSelectCardForReconcile}>
              <SelectTrigger><SelectValue placeholder="Selecciona una tarjeta" /></SelectTrigger>
              <SelectContent>
                {cards.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} ({c.bank_name})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>

      {selectedCard && (
        <CardReconciliationDialog
          isOpen={isReconcileDialogOpen}
          onClose={() => { setIsReconcileDialogOpen(false); setSelectedCard(null); }}
          card={{
            ...selectedCard,
            transactions: selectedCard.card_transactions || []
          }}
          onReconciliationSuccess={fetchAllData}
          onNoAdjustmentSuccess={() => showSuccess("El saldo ya está cuadrado.")}
        />
      )}

      {/* Diálogo de Movimiento Rápido */}
      <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Movimiento: {selectedCard?.name}</DialogTitle></DialogHeader>
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

      {/* Diálogo de Nueva/Editar Tarjeta */}
      <Dialog open={isAddCardDialogOpen || isEditCardDialogOpen} onOpenChange={(open) => { if(!open) { setIsAddCardDialogOpen(false); setIsEditCardDialogOpen(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{cardForm.id ? "Editar Tarjeta" : "Nueva Tarjeta"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveCard} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nombre Personalizado (Opcional)</Label>
              <Input placeholder="Ej. Mi Tarjeta Principal" value={cardForm.name} onChange={e => setCardForm({...cardForm, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Banco</Label>
              <Input placeholder="Ej. BBVA, Santander..." value={cardForm.bank_name} onChange={e => setCardForm({...cardForm, bank_name: e.target.value})} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>Últimos 4 dígitos</Label>
                <Input maxLength={4} value={cardForm.last_four_digits} onChange={e => setCardForm({...cardForm, last_four_digits: e.target.value})} required />
              </div>
              <div className="grid gap-2">
                <Label>Expira (MM/AA)</Label>
                <Input maxLength={5} placeholder="12/28" value={cardForm.expiration_date} onChange={e => setCardForm({...cardForm, expiration_date: e.target.value})} required />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Tipo de Tarjeta</Label>
              <Select value={cardForm.type} onValueChange={(v: any) => setCardForm({...cardForm, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="debit">Débito</SelectItem><SelectItem value="credit">Crédito</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{cardForm.id ? "Saldo Inicial (Referencia)" : "Saldo Inicial"}</Label>
              <Input value={cardForm.initial_balance} onChange={e => setCardForm({...cardForm, initial_balance: e.target.value})} required />
            </div>
            {cardForm.type === "credit" && (
              <>
                <div className="grid gap-2">
                  <Label>Límite de Crédito</Label>
                  <Input value={cardForm.credit_limit} onChange={e => setCardForm({...cardForm, credit_limit: e.target.value})} required />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-2">
                    <Label>Día de Corte</Label>
                    <Input type="number" min="1" max="31" value={cardForm.cut_off_day} onChange={e => setCardForm({...cardForm, cut_off_day: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Días para pagar</Label>
                    <Input type="number" value={cardForm.days_to_pay_after_cut_off} onChange={e => setCardForm({...cardForm, days_to_pay_after_cut_off: e.target.value})} />
                  </div>
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label>Color de la Tarjeta</Label>
              <ColorPicker selectedColor={cardForm.color} onSelectColor={c => setCardForm({...cardForm, color: c})} />
            </div>
            <DialogFooter><Button type="submit">{cardForm.id ? "Actualizar" : "Guardar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cards;