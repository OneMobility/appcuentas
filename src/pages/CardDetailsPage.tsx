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
import { DollarSign, ArrowLeft, FileDown, FileText, ChevronLeft, ChevronRight, Scale, Search, Filter, Trash2, Edit, Image as ImageIcon } from "lucide-react";
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
import ImageUpload from "@/components/ImageUpload";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "charge" | "payment">("all");

  const [transactionForm, setTransactionForm] = useState({
    type: "charge" as "charge" | "payment",
    amount: "",
    description: "",
    selectedCategoryId: "",
    imageUrl: "",
  });

  const fetchCardDetails = async () => {
    if (!user || !cardId) return;
    setIsLoading(true);
    const { data, error } = await supabase.from('cards').select('*, card_transactions(*)').eq('id', cardId).single();
    if (error) { showError('Error'); navigate('/cards'); return; }
    const { data: pockets } = await supabase.from('card_pockets').select('*').eq('card_id', cardId);
    setCard({ ...data, card_pockets: pockets || [] });
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
    let currentRunningPoint = card.type === "debit" ? card.current_balance : (card.credit_limit || 0) - card.current_balance;
    return sortedDesc.map(tx => {
      const bal = currentRunningPoint;
      currentRunningPoint = tx.type === "charge" ? currentRunningPoint + tx.amount : currentRunningPoint - tx.amount;
      return { ...tx, runningBalance: bal };
    });
  }, [card]);

  const filteredTransactions = useMemo(() => {
    const start = startOfMonth(currentViewDate);
    const end = endOfMonth(currentViewDate);
    return transactionsWithBalance.filter((tx: any) => {
      const matchesDate = isWithinInterval(parseISO(tx.date), { start, end });
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      return matchesDate && matchesSearch && matchesType;
    });
  }, [transactionsWithBalance, currentViewDate, searchTerm, filterType]);

  const handleOpenEdit = (tx: any) => {
    setEditingTransaction(tx);
    setTransactionForm({
      type: tx.type,
      amount: tx.amount.toString(),
      description: tx.description,
      selectedCategoryId: tx.income_category_id || tx.expense_category_id || "",
      imageUrl: tx.image_url || "",
    });
    setIsAddTransactionDialogOpen(true);
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = evaluateExpression(transactionForm.amount) || 0;
    if (amount <= 0) return;

    let newBalance = card.current_balance;
    if (editingTransaction) {
      if (card.type === "debit") newBalance = editingTransaction.type === "charge" ? newBalance + editingTransaction.amount : newBalance - editingTransaction.amount;
      else newBalance = editingTransaction.type === "charge" ? newBalance - editingTransaction.amount : newBalance + editingTransaction.amount;
    }
    if (card.type === "debit") newBalance = transactionForm.type === "charge" ? newBalance - amount : newBalance + amount;
    else newBalance = transactionForm.type === "charge" ? newBalance + amount : newBalance - amount;

    const txData = {
      user_id: user?.id, card_id: card.id, type: transactionForm.type, amount, description: transactionForm.description,
      date: editingTransaction ? editingTransaction.date : getLocalDateString(new Date()),
      income_category_id: transactionForm.type === "payment" ? transactionForm.selectedCategoryId : null,
      expense_category_id: transactionForm.type === "charge" ? transactionForm.selectedCategoryId : null,
      image_url: transactionForm.imageUrl,
    };

    const { error } = editingTransaction 
      ? await supabase.from('card_transactions').update(txData).eq('id', editingTransaction.id)
      : await supabase.from('card_transactions').insert(txData);

    if (!error) {
      await supabase.from('cards').update({ current_balance: newBalance }).eq('id', card.id);
      showSuccess("Guardado");
      setIsAddTransactionDialogOpen(false);
      fetchCardDetails();
    } else showError("Error");
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="flex flex-col gap-4 p-1 md:p-4">
      <div className="flex items-center gap-3 px-1">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cards')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl md:text-3xl font-bold truncate">{card.name}</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cn("lg:col-span-2 flex flex-col gap-4", card.type !== "debit" && "lg:col-span-3")}>
          <Card className="p-4 md:p-6 text-white shadow-xl border-none mx-1" style={{ backgroundColor: card.color }}>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] md:text-sm opacity-80 uppercase font-bold">{card.type === "credit" ? "Crédito Disponible" : "Saldo Disponible"}</p>
                <p className="text-2xl md:text-3xl font-black">${(card.type === "credit" ? (card.credit_limit - card.current_balance) : card.current_balance).toFixed(2)}</p>
              </div>
              <div className="text-right"><p className="text-[10px] md:text-sm font-bold opacity-80">{card.bank_name}</p><p className="text-xs font-black">**** {card.last_four_digits}</p></div>
            </div>
          </Card>

          <Card className="border-none shadow-sm mx-1 overflow-hidden">
            <CardHeader className="p-4 flex flex-row items-center justify-between bg-muted/10">
              <CardTitle className="text-sm">Movimientos</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setIsReconcileDialogOpen(true)}><Scale className="h-4 w-4" /></Button>
                <Button variant="default" size="icon" className="h-8 w-8" onClick={() => { setEditingTransaction(null); setTransactionForm({ type: "charge", amount: "", description: "", selectedCategoryId: "", imageUrl: "" }); setIsAddTransactionDialogOpen(true); }}><DollarSign className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead className="pl-4">Fecha</TableHead><TableHead>Detalle</TableHead><TableHead className="text-right pr-4">Monto</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="pl-4 text-[10px]">{format(parseISO(tx.date), "dd/MM")}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs">{tx.description}</span>
                          <span className="text-[9px] text-muted-foreground">{getCategoryById(tx.income_category_id || tx.expense_category_id)?.name || "Sin cat."}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-2">
                          <span className={cn("font-black text-xs", tx.type === "charge" ? "text-red-600" : "text-green-600")}>${tx.amount.toFixed(0)}</span>
                          {tx.image_url && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(tx.image_url, '_blank')}><ImageIcon className="h-3 w-3" /></Button>}
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenEdit(tx)}><Edit className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        {card.type === "debit" && <div className="mx-1"><CardPocketsManager cardId={card.id} cardBalance={card.current_balance} onUpdate={fetchCardDetails} /></div>}
      </div>

      <CardReconciliationDialog
        isOpen={isReconcileDialogOpen}
        onClose={() => setIsReconcileDialogOpen(false)}
        card={{
          ...card,
          transactions: card?.card_transactions || []
        }}
        onReconciliationSuccess={fetchCardDetails}
        onNoAdjustmentSuccess={() => showSuccess("El saldo ya está cuadrado.")}
      />

      <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-3xl">
          <DialogHeader><DialogTitle>{editingTransaction ? "Editar" : "Nuevo"} Movimiento</DialogTitle></DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={transactionForm.type} onValueChange={(v: any) => setTransactionForm({...transactionForm, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="charge">Gasto</SelectItem><SelectItem value="payment">Abono/Pago</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Monto</Label><Input value={transactionForm.amount} onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})} required /></div>
            <div className="grid gap-2"><Label>Descripción</Label><Input value={transactionForm.description} onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} required /></div>
            <div className="grid gap-2">
              <Label>Categoría</Label>
              <Select value={transactionForm.selectedCategoryId} onValueChange={(v) => setTransactionForm({...transactionForm, selectedCategoryId: v})}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>{(transactionForm.type === "charge" ? expenseCategories : incomeCategories).map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Imagen/Ticket</Label>
              <ImageUpload onUploadSuccess={(url) => setTransactionForm({...transactionForm, imageUrl: url})} initialUrl={transactionForm.imageUrl} onRemove={() => setTransactionForm({...transactionForm, imageUrl: ""})} folder="card_tickets" />
            </div>
            <DialogFooter><Button type="submit" className="w-full h-11 rounded-xl">Guardar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CardDetailsPage;