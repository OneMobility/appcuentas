"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, DollarSign, Search, Scale, ArrowRightLeft, Wallet, CreditCard, AlertCircle, PiggyBank } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { addMonths, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Cards = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, isLoadingCategories } = useCategoryContext();
  
  const [viewMode, setViewMode] = useState<"global" | "month">("global");
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
    type: "debit" as "credit" | "debit", initial_balance: "0", credit_limit: "",
    cut_off_day: "" as string, days_to_pay_after_cut_off: "" as string,
    color: "#3B82F6",
  });

  const [newTransaction, setNewTransaction] = useState({
    type: "charge" as "charge" | "payment",
    amount: "",
    description: "",
    selectedCategoryId: "",
  });

  // Estados para diferir compras
  const [isDeferred, setIsDeferred] = useState(false);
  const [deferredType, setDeferredType] = useState<"msi" | "interest">("msi");
  const [installmentsCount, setInstallmentsCount] = useState("3");
  const [totalWithInterest, setTotalWithInterest] = useState("");

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

    const cardDataToSave = {
      user_id: user.id,
      name: cardForm.name,
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
      const { error: updateError } = await supabase.from('cards').update(cardDataToSave).eq('id', cardForm.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('cards').insert({ ...cardDataToSave, current_balance: balance });
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

  const handleDeleteCard = async (cardId: string) => {
    if (!user) return;
    try {
      // Eliminar transacciones asociadas primero para evitar violaciones de clave foránea
      const { error: txError } = await supabase
        .from('card_transactions')
        .delete()
        .eq('card_id', cardId);
      if (txError) throw txError;

      // Eliminar apartados asociados
      const { error: pocketError } = await supabase
        .from('card_pockets')
        .delete()
        .eq('card_id', cardId);
      if (pocketError) throw pocketError;

      // Eliminar la tarjeta
      const { error: cardError } = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId)
        .eq('user_id', user.id);
      if (cardError) throw cardError;

      showSuccess("Tarjeta eliminada exitosamente.");
      fetchAllData();
    } catch (error: any) {
      showError("Error al eliminar la tarjeta: " + error.message);
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard || !user) return;
    
    const baseAmount = evaluateExpression(newTransaction.amount) || 0;
    if (baseAmount <= 0) { showError("Monto inválido"); return; }

    const isCreditCard = selectedCard.type === "credit";
    const isCharge = newTransaction.type === "charge";

    // Lógica para diferir compras
    if (isCreditCard && isCharge && isDeferred) {
      const count = parseInt(installmentsCount);
      if (isNaN(count) || count < 1) {
        showError("El número de meses debe ser al menos 1.");
        return;
      }

      let totalAmountToCharge = baseAmount;
      let monthlyInstallmentAmount = baseAmount / count;

      if (deferredType === "interest") {
        const totalInterestVal = evaluateExpression(totalWithInterest) || 0;
        if (totalInterestVal <= 0 || totalInterestVal < baseAmount) {
          showError("El monto total con intereses debe ser mayor al monto original.");
          return;
        }
        totalAmountToCharge = totalInterestVal;
        monthlyInstallmentAmount = totalInterestVal / count;
      }

      try {
        const today = new Date();
        const transactionInserts = [];

        for (let i = 0; i < count; i++) {
          const installmentDate = addMonths(today, i);
          const installmentDateStr = getLocalDateString(installmentDate);

          transactionInserts.push({
            user_id: user.id,
            card_id: selectedCard.id,
            type: "charge",
            amount: monthlyInstallmentAmount,
            description: `${newTransaction.description} (Mensualidad ${i + 1}/${count})`,
            date: installmentDateStr,
            installments_total_amount: totalAmountToCharge,
            installments_count: count,
            installment_number: i + 1,
            expense_category_id: newTransaction.selectedCategoryId || null,
          });
        }

        // Insertar todas las mensualidades
        const { error: txsError } = await supabase
          .from('card_transactions')
          .insert(transactionInserts);

        if (txsError) throw txsError;

        // Actualizar el saldo de la tarjeta con la deuda total diferida
        const newBalance = selectedCard.current_balance + totalAmountToCharge;
        const { error: cardError } = await supabase
          .from('cards')
          .update({ current_balance: newBalance })
          .eq('id', selectedCard.id);

        if (cardError) throw cardError;

        showSuccess(`Compra diferida a ${count} meses registrada exitosamente.`);
        setIsAddTransactionDialogOpen(false);
        fetchAllData();
      } catch (err: any) {
        showError("Error al registrar compra diferida: " + err.message);
      }
      return;
    }

    // Lógica normal no diferida
    let newBalance = selectedCard.current_balance;
    if (selectedCard.type === "debit") {
      newBalance = isCharge ? newBalance - baseAmount : newBalance + baseAmount;
    } else {
      newBalance = isCharge ? newBalance + baseAmount : newBalance - baseAmount;
    }

    const { error } = await supabase.from('card_transactions').insert({
      user_id: user.id,
      card_id: selectedCard.id,
      type: newTransaction.type,
      amount: baseAmount,
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

  const totals = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    if (viewMode === "month") {
      let monthlyDebit = 0;
      let monthlyCreditDebt = 0;
      let monthlyAvailable = 0;

      cards.forEach(card => {
        const txs = card.card_transactions || [];
        const monthlyTxs = txs.filter((t: any) => {
          const d = parseISO(t.date);
          return isWithinInterval(d, { start, end });
        });

        const charges = monthlyTxs.filter((t: any) => t.type === "charge").reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        const payments = monthlyTxs.filter((t: any) => t.type === "payment").reduce((sum: number, t: any) => sum + Number(t.amount), 0);

        if (card.type === "debit") {
          monthlyDebit += (payments - charges);
        } else {
          const debtChange = charges - payments;
          monthlyCreditDebt += debtChange;
          monthlyAvailable += ((card.credit_limit || 0) - debtChange);
        }
      });

      return {
        debit: monthlyDebit,
        creditDebt: monthlyCreditDebt,
        available: monthlyAvailable,
        net: monthlyDebit - monthlyCreditDebt
      };
    }

    // Global
    const debit = cards.filter(c => c.type === "debit").reduce((s, c) => s + c.current_balance, 0);
    const creditDebt = cards.filter(c => c.type === "credit").reduce((s, c) => s + c.current_balance, 0);
    const available = cards.filter(c => c.type === "credit").reduce((s, c) => s + ((c.credit_limit || 0) - c.current_balance), 0);
    return {
      debit,
      creditDebt,
      available,
      net: debit - creditDebt
    };
  }, [cards, viewMode]);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Tus Tarjetas</h1>
        <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-full max-w-[260px]">
          <TabsList className="grid w-full grid-cols-2 rounded-xl h-9">
            <TabsTrigger value="global" className="rounded-lg text-xs font-bold">Global</TabsTrigger>
            <TabsTrigger value="month" className="rounded-lg text-xs font-bold">Del Mes</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-green-600 bg-green-50 text-green-800">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium flex items-center gap-2"><Wallet className="h-3 w-3" /> SALDO EN DÉBITO</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${totals.debit.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium flex items-center gap-2"><CreditCard className="h-3 w-3" /> CRÉDITO DISPONIBLE</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${totals.available.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-red-600 bg-red-50 text-red-800">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium flex items-center gap-2"><AlertCircle className="h-3 w-3" /> DEUDA DE CRÉDITO</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${totals.creditDebt.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-blue-600 bg-blue-50 text-blue-800">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium flex items-center gap-2"><PiggyBank className="h-3 w-3" /> BALANCE NETO</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${totals.net.toFixed(2)}</div></CardContent>
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
            onAddTransaction={() => { 
              setSelectedCard(card); 
              setIsDeferred(false);
              setNewTransaction({ type: "charge", amount: "", description: "", selectedCategoryId: "" });
              setIsAddTransactionDialogOpen(true); 
            }}
            onDeleteCard={handleDeleteCard}
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
        <DialogContent className="w-[90vw] max-w-[400px] rounded-3xl">
          <DialogHeader><DialogTitle>Nuevo Movimiento: {selectedCard?.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={newTransaction.type} onValueChange={(v: any) => setNewTransaction({...newTransaction, type: v})}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="charge">Gasto</SelectItem>
                  <SelectItem value="payment">Abono/Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Monto</Label>
              <Input value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} className="rounded-xl" placeholder="0.00" required />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Input value={newTransaction.description} onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} className="rounded-xl" required />
            </div>
            <div className="grid gap-2">
              <Label>Categoría</Label>
              <Select value={newTransaction.selectedCategoryId} onValueChange={(v) => setNewTransaction({...newTransaction, selectedCategoryId: v})}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
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

            {/* Opciones de diferido para tarjetas de crédito en cargos */}
            {selectedCard?.type === "credit" && newTransaction.type === "charge" && (
              <div className="border-t pt-4 mt-2 space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="defer-purchase" 
                    checked={isDeferred} 
                    onCheckedChange={(v) => setIsDeferred(!!v)} 
                  />
                  <Label htmlFor="defer-purchase" className="font-semibold cursor-pointer">¿Diferir esta compra?</Label>
                </div>

                {isDeferred && (
                  <div className="bg-muted/50 p-3 rounded-2xl space-y-3 border">
                    <div className="grid gap-1.5">
                      <Label>Tipo de diferido</Label>
                      <Select value={deferredType} onValueChange={(v: any) => setDeferredType(v)}>
                        <SelectTrigger className="rounded-xl bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="msi">Meses sin intereses (MSI)</SelectItem>
                          <SelectItem value="interest">Con intereses</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {deferredType === "interest" && (
                      <div className="grid gap-1.5">
                        <Label>Monto total a pagar (con intereses)</Label>
                        <Input 
                          value={totalWithInterest} 
                          onChange={e => setTotalWithInterest(e.target.value)} 
                          placeholder="Ej. 630" 
                          className="rounded-xl bg-background"
                          required
                        />
                      </div>
                    )}

                    <div className="grid gap-1.5">
                      <Label>Número de meses</Label>
                      <Select value={installmentsCount} onValueChange={setInstallmentsCount}>
                        <SelectTrigger className="rounded-xl bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                            <SelectItem key={num} value={num.toString()}>{num} {num === 1 ? 'mes' : 'meses'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Vista previa del cálculo */}
                    <div className="text-xs text-muted-foreground border-t pt-2 mt-1">
                      {(() => {
                        const count = parseInt(installmentsCount);
                        const base = evaluateExpression(newTransaction.amount) || 0;
                        if (deferredType === "msi") {
                          const monthly = base / count;
                          return (
                            <p className="font-medium text-primary">
                              Pagarás <span className="font-bold">{count} mensualidades</span> de <span className="font-bold">${monthly.toFixed(2)}</span> cada una (Sin intereses).
                            </p>
                          );
                        } else {
                          const total = evaluateExpression(totalWithInterest) || 0;
                          const monthly = total / count;
                          return (
                            <p className="font-medium text-primary">
                              Pagarás <span className="font-bold">{count} mensualidades</span> de <span className="font-bold">${monthly.toFixed(2)}</span> cada una (Total con intereses: ${total.toFixed(2)}).
                            </p>
                          );
                        }
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter><Button type="submit" className="w-full h-11 rounded-xl">Guardar</Button></DialogFooter>
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