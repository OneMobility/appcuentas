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
import { DollarSign, ArrowLeft, FileDown, FileText, ChevronLeft, ChevronRight, Scale, Search, Filter, Trash2, Edit } from "lucide-react";
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
      const matchesDate = isWithinInterval(txDate, { start, end });
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      
      return matchesDate && matchesSearch && matchesType;
    });
  }, [transactionsWithBalance, currentViewDate, searchTerm, filterType]);

  const handleOpenAdd = () => {
    setEditingTransaction(null);
    setTransactionForm({ type: "charge", amount: "", description: "", selectedCategoryId: "" });
    setIsAddTransactionDialogOpen(true);
  };

  const handleOpenEdit = (tx: any) => {
    setEditingTransaction(tx);
    setTransactionForm({
      type: tx.type,
      amount: tx.amount.toString(),
      description: tx.description,
      selectedCategoryId: tx.income_category_id || tx.expense_category_id || "",
    });
    setIsAddTransactionDialogOpen(true);
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = evaluateExpression(transactionForm.amount) || 0;
    if (amount <= 0) return;

    let newBalance = card.current_balance;
    
    // Revertir efecto de la transacción anterior si estamos editando
    if (editingTransaction) {
      if (card.type === "debit") {
        newBalance = editingTransaction.type === "charge" ? newBalance + editingTransaction.amount : newBalance - editingTransaction.amount;
      } else {
        newBalance = editingTransaction.type === "charge" ? newBalance - editingTransaction.amount : newBalance + editingTransaction.amount;
      }
    }

    // Aplicar nuevo efecto
    if (card.type === "debit") {
      newBalance = transactionForm.type === "charge" ? newBalance - amount : newBalance + amount;
    } else {
      newBalance = transactionForm.type === "charge" ? newBalance + amount : newBalance - amount;
    }

    const txData = {
      user_id: user?.id,
      card_id: card.id,
      type: transactionForm.type,
      amount,
      description: transactionForm.description,
      date: editingTransaction ? editingTransaction.date : getLocalDateString(new Date()),
      income_category_id: transactionForm.type === "payment" ? transactionForm.selectedCategoryId : null,
      expense_category_id: transactionForm.type === "charge" ? transactionForm.selectedCategoryId : null,
    };

    let error;
    if (editingTransaction) {
      const { error: updateError } = await supabase.from('card_transactions').update(txData).eq('id', editingTransaction.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('card_transactions').insert(txData);
      error = insertError;
    }

    if (!error) {
      await supabase.from('cards').update({ current_balance: newBalance }).eq('id', card.id);
      showSuccess(editingTransaction ? "Transacción actualizada" : "Transacción registrada");
      setIsAddTransactionDialogOpen(false);
      setEditingTransaction(null);
      fetchCardDetails();
    } else {
      showError("Error al guardar: " + error.message);
    }
  };

  const handleDeleteTransaction = async (tx: any) => {
    try {
      let newBalance = card.current_balance;
      if (card.type === "debit") {
        newBalance = tx.type === "charge" ? newBalance + tx.amount : newBalance - tx.amount;
      } else {
        newBalance = tx.type === "charge" ? newBalance - tx.amount : newBalance + tx.amount;
      }

      const { error: deleteError } = await supabase.from('card_transactions').delete().eq('id', tx.id);
      if (deleteError) throw deleteError;

      const { error: updateError } = await supabase.from('cards').update({ current_balance: newBalance }).eq('id', card.id);
      if (updateError) throw updateError;

      showSuccess("Movimiento eliminado");
      fetchCardDetails();
    } catch (error: any) {
      showError("Error al eliminar: " + error.message);
    }
  };

  const handleExport = (formatType: 'csv' | 'pdf') => {
    const dataToExport = filteredTransactions.map(tx => ({
      Fecha: format(parseISO(tx.date), "dd/MM/yyyy"),
      Descripción: tx.description,
      Categoría: getCategoryById(tx.income_category_id || tx.expense_category_id)?.name || "Sin categoría",
      Tipo: tx.type === "charge" ? "Cargo" : "Abono",
      Monto: tx.amount.toFixed(2),
      Saldo: tx.runningBalance.toFixed(2)
    }));

    const filename = `movimientos_${card.name}_${format(new Date(), "yyyyMMdd")}`;
    const headers = ["Fecha", "Descripción", "Categoría", "Tipo", "Monto", "Saldo"];

    if (formatType === 'csv') {
      exportToCsv(`${filename}.csv`, dataToExport);
    } else {
      exportToPdf(`${filename}.pdf`, `Movimientos: ${card.name}`, headers, dataToExport.map(d => Object.values(d)));
    }
    showSuccess(`Exportado a ${formatType.toUpperCase()}`);
  };

  if (isLoading) return <LoadingSpinner />;
  if (!card) return null;

  return (
    <div className="flex flex-col gap-4 md:gap-6 p-1 md:p-4 max-w-full overflow-x-hidden">
      <div className="flex items-center gap-3 px-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/cards')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl md:text-3xl font-bold truncate">{card.name}</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 w-full">
        <div className={cn("lg:col-span-2 flex flex-col gap-4 md:gap-6", card.type !== "debit" && "lg:col-span-3")}>
          <Card className="p-4 md:p-6 text-white shadow-xl border-none mx-1" style={{ backgroundColor: card.color }}>
            <div className="flex justify-between items-start mb-4 md:mb-6">
              <div className="space-y-1">
                {card.type === "credit" ? (
                  <>
                    <p className="text-[10px] md:text-sm opacity-80 uppercase font-bold">Crédito Disponible</p>
                    <p className="text-2xl md:text-3xl font-black">${((card.credit_limit || 0) - card.current_balance).toFixed(2)}</p>
                    <p className="text-[10px] md:text-xs font-bold border-t border-white/20 pt-1 mt-1">Deuda: ${card.current_balance.toFixed(2)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] md:text-sm opacity-80 uppercase font-bold">Saldo Disponible</p>
                    <p className="text-2xl md:text-3xl font-black">${card.current_balance.toFixed(2)}</p>
                    <p className="text-[10px] md:text-xs font-bold border-t border-white/20 pt-1 mt-1">Total: ${(card.current_balance + (card.card_pockets || []).reduce((s:any,p:any)=>s+p.amount,0)).toFixed(2)}</p>
                  </>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] md:text-sm opacity-80 font-bold">{card.bank_name}</p>
                <p className="text-xs md:text-base font-black">**** {card.last_four_digits}</p>
              </div>
            </div>
          </Card>

          <Card className="border-none shadow-sm mx-1 overflow-hidden">
            <CardHeader className="p-4 space-y-4 bg-muted/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Movimientos</CardTitle>
                  <div className="flex items-center bg-background rounded-lg p-0.5 border">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentViewDate(subMonths(currentViewDate, 1))}><ChevronLeft className="h-3 w-3" /></Button>
                    <span className="px-1 text-[10px] font-bold min-w-[70px] text-center capitalize">{format(currentViewDate, "MMM yy", { locale: es })}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentViewDate(addMonths(currentViewDate, 1))}><ChevronRight className="h-3 w-3" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setIsReconcileDialogOpen(true)} title="Cuadrar"><Scale className="h-4 w-4" /></Button>
                  <Button variant="default" size="icon" className="h-8 w-8 rounded-xl" onClick={handleOpenAdd} title="Nuevo"><DollarSign className="h-4 w-4" /></Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl"><FileDown className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExport('csv')}><FileText className="mr-2 h-4 w-4" /> CSV</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('pdf')}><FileText className="mr-2 h-4 w-4" /> PDF</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="relative w-full">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar..." className="pl-8 h-9 rounded-xl text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                  <SelectTrigger className="w-full h-9 rounded-xl text-sm">
                    <Filter className="mr-2 h-3 w-3" />
                    <SelectValue placeholder="Filtrar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="charge">Cargos</SelectItem>
                    <SelectItem value="payment">Abonos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto scrollbar-hide">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 text-[10px] uppercase font-bold w-[60px]">Fecha</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">Detalle</TableHead>
                      <TableHead className="hidden sm:table-cell text-[10px] uppercase font-bold">Categoría</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-bold">Monto</TableHead>
                      <TableHead className="text-right pr-4 text-[10px] uppercase font-bold">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">Sin movimientos.</TableCell></TableRow>
                    ) : (
                      filteredTransactions.map((tx: any) => {
                        const category = getCategoryById(tx.income_category_id || tx.expense_category_id);
                        return (
                          <TableRow key={tx.id}>
                            <TableCell className="pl-4 text-[10px] font-medium">{format(parseISO(tx.date), "dd/MM")}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs truncate max-w-[100px]">{tx.description}</span>
                                <span className="sm:hidden text-[9px] text-muted-foreground truncate">{category?.name || "Sin cat."}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {category && <div className="flex items-center gap-1 text-xs"><DynamicLucideIcon iconName={category.icon || "Tag"} className="h-3 w-3" /> {category.name}</div>}
                            </TableCell>
                            <TableCell className={cn("text-right font-black text-xs", tx.type === "charge" ? "text-red-600" : "text-green-600")}>
                              {tx.type === "charge" ? "-" : "+"}${tx.amount.toFixed(0)}
                            </TableCell>
                            <TableCell className="text-right pr-4 flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(tx)}><Edit className="h-3.5 w-3.5" /></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="w-[90vw] rounded-2xl">
                                  <AlertDialogHeader><AlertDialogTitle>¿Eliminar?</AlertDialogTitle><AlertDialogDescription>Se ajustará el saldo.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl">No</AlertDialogCancel>
                                    <AlertDialogAction className="rounded-xl" onClick={() => handleDeleteTransaction(tx)}>Sí</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
        {card.type === "debit" && (
          <div className="mx-1">
            <CardPocketsManager cardId={card.id} cardBalance={card.current_balance} onUpdate={fetchCardDetails} />
          </div>
        )}
      </div>

      <CardReconciliationDialog
        isOpen={isReconcileDialogOpen}
        onClose={() => setIsReconcileDialogOpen(false)}
        card={{ ...card, transactions: card.card_transactions || [] }}
        onReconciliationSuccess={fetchCardDetails}
        onNoAdjustmentSuccess={() => showSuccess("Saldo cuadrado.")}
      />

      <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-3xl p-6">
          <DialogHeader><DialogTitle>{editingTransaction ? "Editar Transacción" : "Nueva Transacción"}</DialogTitle></DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={transactionForm.type} onValueChange={(v: any) => setTransactionForm({...transactionForm, type: v})}>
                <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="charge">Gasto</SelectItem>
                  <SelectItem value="payment">Abono</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Monto</Label>
              <Input value={transactionForm.amount} onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})} className="rounded-xl h-10" placeholder="0.00" required />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Input value={transactionForm.description} onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} className="rounded-xl h-10" placeholder="Detalle..." required />
            </div>
            <div className="grid gap-2">
              <Label>Categoría</Label>
              <Select value={transactionForm.selectedCategoryId} onValueChange={(v) => setTransactionForm({...transactionForm, selectedCategoryId: v})}>
                <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {(transactionForm.type === "charge" ? expenseCategories : incomeCategories).map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2"><DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-4 w-4" /> {cat.name}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" className="w-full rounded-xl font-bold h-11">Guardar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CardDetailsPage;