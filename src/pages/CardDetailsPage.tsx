"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, History, ArrowLeft, FileDown, FileText, ChevronLeft, ChevronRight, Scale } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useCategoryContext } from "@/context/CategoryContext";
import { evaluateExpression } from "@/utils/math-helpers";
import CardPocketsManager from "@/components/CardPocketsManager";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { getLocalDateString } from "@/utils/date-helpers";
import CardReconciliationDialog from "@/components/CardReconciliationDialog";

const CardDetailsPage: React.FC = () => {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { incomeCategories, expenseCategories, getCategoryById, isLoadingCategories } = useCategoryContext();
  
  const [card, setCard] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [isReconcileDialogOpen, setIsReconcileDialogOpen] = useState(false);
  
  const [newTransaction, setNewTransaction] = useState({
    type: "charge" as "charge" | "payment",
    amount: "",
    description: "",
    selectedCategoryId: "",
  });

  const fetchCardDetails = async () => {
    if (!user || !cardId) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('cards')
      .select('*, card_transactions(*)')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      showError('Error al cargar detalles');
      navigate('/cards');
      return;
    }

    try {
      const { data: pockets } = await supabase
        .from('card_pockets')
        .select('*')
        .eq('card_id', cardId);
      
      setCard({ ...data, card_pockets: pockets || [] });
    } catch (e) {
      setCard({ ...data, card_pockets: [] });
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    if (user && !isLoadingCategories) fetchCardDetails();
  }, [cardId, user, isLoadingCategories]);

  const transactionsWithBalance = useMemo(() => {
    if (!card) return [];
    const sortedDesc = [...(card.card_transactions || [])].sort((a, b) => 
      parseISO(b.date).getTime() - parseISO(a.date).getTime() || 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    let currentRunningPoint = card.type === "debit" 
      ? card.current_balance 
      : (card.credit_limit || 0) - card.current_balance;

    return sortedDesc.map(tx => {
      const balanceAtThisPoint = currentRunningPoint;
      currentRunningPoint = tx.type === "charge" ? currentRunningPoint + tx.amount : currentRunningPoint - tx.amount;
      return { ...tx, runningBalance: balanceAtThisPoint };
    });
  }, [card]);

  const filteredTransactions = useMemo(() => {
    const start = startOfMonth(currentViewDate);
    const end = endOfMonth(currentViewDate);
    return transactionsWithBalance.filter((tx: any) => {
      const txDate = parseISO(tx.date);
      return isWithinInterval(txDate, { start, end });
    });
  }, [transactionsWithBalance, currentViewDate]);

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = evaluateExpression(newTransaction.amount) || 0;
    if (amount <= 0) return;

    let newBalance = card.current_balance;
    if (card.type === "debit") {
      newBalance = newTransaction.type === "charge" ? newBalance - amount : newBalance + amount;
    } else {
      newBalance = newTransaction.type === "charge" ? newBalance + amount : newBalance - amount;
    }

    const { error } = await supabase.from('card_transactions').insert({
      user_id: user?.id,
      card_id: card.id,
      type: newTransaction.type,
      amount,
      description: newTransaction.description,
      date: getLocalDateString(new Date()),
      income_category_id: newTransaction.type === "payment" ? newTransaction.selectedCategoryId : null,
      expense_category_id: newTransaction.type === "charge" ? newTransaction.selectedCategoryId : null,
    });

    if (!error) {
      await supabase.from('cards').update({ current_balance: newBalance }).eq('id', card.id);
      showSuccess("Transacción registrada");
      setIsAddTransactionDialogOpen(false);
      fetchCardDetails();
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!card) return null;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cards')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-3xl font-bold">{card.name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className={cn("lg:col-span-2 flex flex-col gap-6", card.type !== "debit" && "lg:col-span-3")}>
          <Card className="p-6 text-white shadow-xl" style={{ backgroundColor: card.color }}>
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-1">
                {card.type === "credit" ? (
                  <>
                    <p className="text-sm opacity-80">Crédito Disponible:</p>
                    <p className="text-2xl font-bold">${((card.credit_limit || 0) - card.current_balance).toFixed(2)}</p>
                    <p className="text-xs font-bold border-t border-white/20 pt-1">Deuda Actual: ${card.current_balance.toFixed(2)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm opacity-80">Saldo Disponible:</p>
                    <p className="text-2xl font-bold">${card.current_balance.toFixed(2)}</p>
                    <p className="text-xs font-bold border-t border-white/20 pt-1">Saldo Total: ${(card.current_balance + (card.card_pockets || []).reduce((s:any,p:any)=>s+p.amount,0)).toFixed(2)}</p>
                  </>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm opacity-80">{card.bank_name}</p>
                <p className="font-bold">**** {card.last_four_digits}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <CardTitle>Movimientos</CardTitle>
                <div className="flex items-center bg-muted rounded-lg p-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentViewDate(subMonths(currentViewDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="px-3 text-sm font-medium min-w-[120px] text-center capitalize">{format(currentViewDate, "MMMM yyyy", { locale: es })}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentViewDate(addMonths(currentViewDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsReconcileDialogOpen(true)}><Scale className="h-4 w-4 mr-1" /> Cuadrar</Button>
                <Button size="sm" onClick={() => setIsAddTransactionDialogOpen(true)}><DollarSign className="h-4 w-4 mr-1" /> Nuevo</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell>{format(parseISO(tx.date), "dd/MM")}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{tx.description}</span>
                          <span className="text-xs text-muted-foreground">{getCategoryById(tx.income_category_id || tx.expense_category_id)?.name || "Sin categoría"}</span>
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-right font-bold", tx.type === "charge" ? "text-red-600" : "text-green-600")}>
                        {tx.type === "charge" ? "-" : "+"}${tx.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">${tx.runningBalance.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        {card.type === "debit" && <CardPocketsManager cardId={card.id} cardBalance={card.current_balance} onUpdate={fetchCardDetails} />}
      </div>

      <CardReconciliationDialog
        isOpen={isReconcileDialogOpen}
        onClose={() => setIsReconcileDialogOpen(false)}
        card={{
          ...card,
          transactions: card.card_transactions || []
        }}
        onReconciliationSuccess={fetchCardDetails}
        onNoAdjustmentSuccess={() => showSuccess("El saldo ya está cuadrado.")}
      />

      <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Transacción</DialogTitle></DialogHeader>
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
            <Input placeholder="Monto" value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} required />
            <Input placeholder="Descripción" value={newTransaction.description} onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} required />
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
    </div>
  );
};

export default CardDetailsPage;