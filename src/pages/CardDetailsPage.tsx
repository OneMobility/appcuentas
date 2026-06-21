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
import { DollarSign, ArrowLeft, FileDown, FileText, ChevronLeft, ChevronRight, Scale, Search, Filter, Trash2, Edit, Image as ImageIcon, CalendarDays, Eye } from "lucide-react";
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
import { getLocalDateString, getUpcomingCutOffDate, getUpcomingPaymentDueDate, getStatementPeriod } from "@/utils/date-helpers";
import CardReconciliationDialog from "@/components/CardReconciliationDialog";
import ImageUpload from "@/components/ImageUpload";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

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

  // Estados para diferir compras
  const [isDeferred, setIsDeferred] = useState(false);
  const [deferredType, setDeferredType] = useState<"msi" | "interest">("msi");
  const [installmentsCount, setInstallmentsCount] = useState("3");
  const [totalWithInterest, setTotalWithInterest] = useState("");

  const fetchCardDetails = async () => {
    if (!user || !cardId) return;
    setIsLoading(true);
    const { data, error } = await supabase.from('cards').select('*, card_transactions(*)').eq('id', cardId).single();
    if (error) { showError('Error al cargar tarjeta'); navigate('/cards'); return; }
    const { data: pockets } = await supabase.from('card_pockets').select('*').eq('card_id', cardId);
    setCard({ ...data, card_pockets: pockets || [] });
    setIsLoading(false);
  };

  useEffect(() => {
    if (user && !isLoadingCategories) fetchCardDetails();
  }, [cardId, user, isLoadingCategories]);

  // Obtener el rango de fechas para filtrar (periodo de facturación para crédito, mes calendario para débito)
  const filterInterval = useMemo(() => {
    if (!card) return { start: new Date(), end: new Date() };
    if (card.type === "credit" && card.cut_off_day) {
      return getStatementPeriod(card.cut_off_day, currentViewDate);
    } else {
      return {
        start: startOfMonth(currentViewDate),
        end: endOfMonth(currentViewDate)
      };
    }
  }, [card, currentViewDate]);

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
    return transactionsWithBalance.filter((tx: any) => {
      const matchesDate = isWithinInterval(parseISO(tx.date), filterInterval);
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      return matchesDate && matchesSearch && matchesType;
    });
  }, [transactionsWithBalance, filterInterval, searchTerm, filterType]);

  // Calcular la deuda o saldo del periodo seleccionado
  const periodMetrics = useMemo(() => {
    if (!card) return { charges: 0, payments: 0, net: 0 };
    const periodTxs = (card.card_transactions || []).filter((tx: any) => 
      isWithinInterval(parseISO(tx.date), filterInterval)
    );
    const charges = periodTxs.filter((tx: any) => tx.type === "charge").reduce((sum: number, tx: any) => sum + tx.amount, 0);
    const payments = periodTxs.filter((tx: any) => tx.type === "payment").reduce((sum: number, tx: any) => sum + tx.amount, 0);
    return {
      charges,
      payments,
      net: card.type === "credit" ? (charges - payments) : (payments - charges)
    };
  }, [card, filterInterval]);

  const handleOpenEdit = (tx: any) => {
    setEditingTransaction(tx);
    setTransactionForm({
      type: tx.type,
      amount: tx.amount.toString(),
      description: tx.description,
      selectedCategoryId: tx.income_category_id || tx.expense_category_id || "",
      imageUrl: tx.image_url || "",
    });
    setIsDeferred(false);
    setIsAddTransactionDialogOpen(true);
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !card) return;

    const baseAmount = evaluateExpression(transactionForm.amount) || 0;
    if (baseAmount <= 0) { showError("Monto inválido"); return; }

    const isCreditCard = card.type === "credit";
    const isCharge = transactionForm.type === "charge";

    // Lógica para diferir compras
    if (isCreditCard && isCharge && isDeferred && !editingTransaction) {
      const count = parseInt(installmentsCount);
      if (isNaN(count) || count < 2) {
        showError("El número de meses debe ser al menos 2.");
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
            card_id: card.id,
            type: "charge",
            amount: monthlyInstallmentAmount,
            description: `${transactionForm.description} (Mensualidad ${i + 1}/${count})`,
            date: installmentDateStr,
            installments_total_amount: totalAmountToCharge,
            installments_count: count,
            installment_number: i + 1,
            expense_category_id: transactionForm.selectedCategoryId || null,
            image_url: transactionForm.imageUrl || null,
          });
        }

        // Insertar todas las mensualidades
        const { error: txsError } = await supabase
          .from('card_transactions')
          .insert(transactionInserts);

        if (txsError) throw txsError;

        // Actualizar el saldo de la tarjeta con la deuda total diferida
        const newBalance = card.current_balance + totalAmountToCharge;
        const { error: cardError } = await supabase
          .from('cards')
          .update({ current_balance: newBalance })
          .eq('id', card.id);

        if (cardError) throw cardError;

        showSuccess(`Compra diferida a ${count} meses registrada exitosamente.`);
        setIsAddTransactionDialogOpen(false);
        fetchCardDetails();
      } catch (err: any) {
        showError("Error al registrar compra diferida: " + err.message);
      }
      return;
    }

    // Lógica normal no diferida (o edición)
    let newBalance = card.current_balance;
    if (editingTransaction) {
      if (card.type === "debit") newBalance = editingTransaction.type === "charge" ? newBalance + editingTransaction.amount : newBalance - editingTransaction.amount;
      else newBalance = editingTransaction.type === "charge" ? newBalance - editingTransaction.amount : newBalance + editingTransaction.amount;
    }
    if (card.type === "debit") newBalance = transactionForm.type === "charge" ? newBalance - baseAmount : newBalance + baseAmount;
    else newBalance = transactionForm.type === "charge" ? newBalance + baseAmount : newBalance - baseAmount;

    const txData = {
      user_id: user?.id, card_id: card.id, type: transactionForm.type, amount: baseAmount, description: transactionForm.description,
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
      showSuccess("Movimiento guardado");
      setIsAddTransactionDialogOpen(false);
      fetchCardDetails();
    } else showError("Error al guardar movimiento");
  };

  const handleDeleteTransaction = async (tx: any) => {
    if (!user || !card) return;
    try {
      let newBalance = card.current_balance;
      
      if (card.type === "debit") {
        newBalance = tx.type === "charge" ? newBalance + tx.amount : newBalance - tx.amount;
      } else {
        newBalance = tx.type === "charge" ? newBalance - tx.amount : newBalance + tx.amount;
      }

      const { error: deleteError } = await supabase
        .from('card_transactions')
        .delete()
        .eq('id', tx.id);

      if (deleteError) throw deleteError;

      const { error: cardUpdateError } = await supabase
        .from('cards')
        .update({ current_balance: newBalance })
        .eq('id', card.id);

      if (cardUpdateError) throw cardUpdateError;

      showSuccess("Movimiento eliminado exitosamente");
      fetchCardDetails();
    } catch (error: any) {
      showError("Error al eliminar movimiento: " + error.message);
    }
  };

  const upcomingCutOffDate = useMemo(() => {
    if (card?.type === "credit" && card?.cut_off_day) {
      return getUpcomingCutOffDate(card.cut_off_day);
    }
    return null;
  }, [card]);

  const upcomingPaymentDueDate = useMemo(() => {
    if (card?.type === "credit" && card?.cut_off_day && card?.days_to_pay_after_cut_off) {
      return getUpcomingPaymentDueDate(card.cut_off_day, card.days_to_pay_after_cut_off);
    }
    return null;
  }, [card]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="flex flex-col gap-4 p-1 md:p-4">
      <div className="flex items-center gap-3 px-1">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cards')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl md:text-3xl font-bold truncate">{card.name}</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cn("lg:col-span-2 flex flex-col gap-4", card.type !== "debit" && "lg:col-span-3")}>
          
          {/* Tarjeta de Información Principal */}
          <Card className="p-4 md:p-6 text-white shadow-xl border-none mx-1" style={{ backgroundColor: card.color }}>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] md:text-sm opacity-80 uppercase font-bold">
                  {card.type === "credit" ? "Crédito Disponible" : "Saldo Disponible"}
                </p>
                <p className="text-2xl md:text-3xl font-black">
                  ${(card.type === "credit" ? (card.credit_limit - card.current_balance) : card.current_balance).toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] md:text-sm font-bold opacity-80">{card.bank_name}</p>
                <p className="text-xs font-black">**** {card.last_four_digits}</p>
              </div>
            </div>

            {/* Deuda Global vs Deuda del Periodo */}
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/20 text-xs">
              <div>
                <p className="opacity-75 text-[10px] uppercase font-bold">Deuda Global</p>
                <p className="text-lg font-black">
                  ${card.type === "credit" ? card.current_balance.toFixed(2) : "0.00"}
                </p>
              </div>
              <div>
                <p className="opacity-75 text-[10px] uppercase font-bold">
                  {card.type === "credit" ? "Deuda del Periodo" : "Flujo del Periodo"}
                </p>
                <p className="text-lg font-black">
                  ${card.type === "credit" ? periodMetrics.net.toFixed(2) : periodMetrics.net.toFixed(2)}
                </p>
              </div>
            </div>

            {card.type === "credit" && (
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/10 text-xs opacity-90">
                {upcomingCutOffDate && (
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <div>
                      <p className="opacity-75 text-[10px] uppercase">Próximo Corte</p>
                      <p className="font-bold">{format(upcomingCutOffDate, "dd 'de' MMM", { locale: es })}</p>
                    </div>
                  </div>
                )}
                {upcomingPaymentDueDate && (
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <div>
                      <p className="opacity-75 text-[10px] uppercase">Límite de Pago</p>
                      <p className="font-bold">{format(upcomingPaymentDueDate, "dd 'de' MMM", { locale: es })}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Tabla de Movimientos con Filtro de Periodo */}
          <Card className="border-none shadow-sm mx-1 overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/10 gap-2">
              <div className="flex flex-col">
                <CardTitle className="text-sm font-bold">Movimientos del Periodo</CardTitle>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {format(filterInterval.start, "dd 'de' MMM", { locale: es })} - {format(filterInterval.end, "dd 'de' MMM, yyyy", { locale: es })}
                </span>
              </div>
              
              {/* Navegación de Periodos */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-background rounded-lg p-0.5 border">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentViewDate(subMonths(currentViewDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="px-2 text-[10px] font-bold min-w-[80px] text-center capitalize">{format(currentViewDate, "MMM yyyy", { locale: es })}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentViewDate(addMonths(currentViewDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setIsReconcileDialogOpen(true)}><Scale className="h-4 w-4" /></Button>
                <Button variant="default" size="icon" className="h-8 w-8" onClick={() => { setEditingTransaction(null); setIsDeferred(false); setTransactionForm({ type: "charge", amount: "", description: "", selectedCategoryId: "", imageUrl: "" }); setIsAddTransactionDialogOpen(true); }}><DollarSign className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Fecha</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead className="text-right pr-4">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-xs">
                        Sin movimientos registrados en este periodo.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((tx: any) => (
                      <TableRow key={tx.id}>
                        <TableCell className="pl-4 text-[10px]">{format(parseISO(tx.date), "dd/MM")}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-xs">
                              {tx.description}
                              {tx.installments_count && (
                                <span className="ml-1.5 text-[9px] text-primary font-black bg-primary/10 px-1.5 py-0.5 rounded-full">
                                  {tx.installment_number}/{tx.installments_count}
                                </span>
                              )}
                            </span>
                            <span className="text-[9px] text-muted-foreground">{getCategoryById(tx.income_category_id || tx.expense_category_id)?.name || "Sin cat."}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-2">
                            <span className={cn("font-black text-xs", tx.type === "charge" ? "text-red-600" : "text-green-600")}>
                              {tx.type === "charge" ? "-" : "+"}${tx.amount.toFixed(2)}
                            </span>
                            {tx.image_url && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(tx.image_url, '_blank')}>
                                <ImageIcon className="h-3 w-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenEdit(tx)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="w-[90vw] rounded-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Se ajustará el saldo de la tarjeta automáticamente.
                                    {tx.installments_count && (
                                      <p className="mt-2 text-red-500 font-semibold">
                                        Nota: Esta es una mensualidad diferida. Eliminarla solo borrará esta mensualidad en particular.
                                      </p>
                                    )}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction className="rounded-xl" onClick={() => handleDeleteTransaction(tx)}>
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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

            {/* Opciones de diferido para tarjetas de crédito en cargos */}
            {card?.type === "credit" && transactionForm.type === "charge" && !editingTransaction && (
              <div className="border-t pt-4 mt-2 space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="defer-purchase-details" 
                    checked={isDeferred} 
                    onCheckedChange={(v) => setIsDeferred(!!v)} 
                  />
                  <Label htmlFor="defer-purchase-details" className="font-semibold cursor-pointer">¿Diferir esta compra?</Label>
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
                          <SelectItem value="3">3 meses</SelectItem>
                          <SelectItem value="6">6 meses</SelectItem>
                          <SelectItem value="9">9 meses</SelectItem>
                          <SelectItem value="12">12 meses</SelectItem>
                          <SelectItem value="18">18 meses</SelectItem>
                          <SelectItem value="24">24 meses</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Vista previa del cálculo */}
                    <div className="text-xs text-muted-foreground border-t pt-2 mt-1">
                      {(() => {
                        const count = parseInt(installmentsCount);
                        const base = evaluateExpression(transactionForm.amount) || 0;
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