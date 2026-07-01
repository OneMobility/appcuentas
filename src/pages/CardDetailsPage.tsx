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
import { DollarSign, ArrowLeft, FileDown, FileText, ChevronLeft, ChevronRight, Scale, Search, Filter, Trash2, Edit, Image as ImageIcon, CalendarDays, Eye, FastForward, PiggyBank, Wallet, Coins } from "lucide-react";
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
import { getContrastColor } from "@/utils/color-helpers";
import CardReconciliationDialog from "@/components/CardReconciliationDialog";
import ImageUpload from "@/components/ImageUpload";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchUsdToMxnRate } from "@/utils/currency-helper";

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
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);
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

  // Monedas y conversión
  const [currency, setCurrency] = useState<"MXN" | "USD">("MXN");
  const [usdToMxnRate, setUsdToMxnRate] = useState<number>(20.00);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const rate = await fetchUsdToMxnRate();
        setUsdToMxnRate(rate);
      } catch (e) {
        console.error("No se pudo obtener la tasa en detalles de tarjeta:", e);
      }
    };
    fetchRate();
  }, [isAddTransactionDialogOpen]);

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

  // Obtener todas las mensualidades diferidas futuras (que vencen después del periodo actual)
  const futureInstallments = useMemo(() => {
    if (!card || card.type !== "credit") return [];
    return (card.card_transactions || [])
      .filter((tx: any) => tx.type === "charge" && tx.installments_count && parseISO(tx.date) > filterInterval.end)
      .sort((a: any, b: any) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  }, [card, filterInterval]);

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
    setCurrency("MXN");
    setIsDeferred(false);
    setIsAddTransactionDialogOpen(true);
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !card) return;

    let baseAmount = evaluateExpression(transactionForm.amount) || 0;
    if (baseAmount <= 0) { showError("Monto inválido"); return; }

    // Convertir de USD a MXN si es necesario
    let finalAmount = baseAmount;
    let finalDescription = transactionForm.description;
    if (currency === "USD" && !editingTransaction) {
      finalAmount = baseAmount * usdToMxnRate;
      finalDescription += ` (Reg: $${baseAmount.toFixed(2)} USD a tasa $${usdToMxnRate.toFixed(2)} MXN)`;
    }

    const isCreditCard = card.type === "credit";
    const isCharge = transactionForm.type === "charge";

    // Lógica para diferir compras
    if (isCreditCard && isCharge && isDeferred && !editingTransaction) {
      const count = parseInt(installmentsCount);
      if (isNaN(count) || count < 1) {
        showError("El número de meses debe ser al menos 1.");
        return;
      }

      let totalAmountToCharge = finalAmount;
      let monthlyInstallmentAmount = finalAmount / count;

      if (deferredType === "interest") {
        let rawInterest: number;
        if (totalWithInterest.startsWith('=')) {
          rawInterest = evaluateExpression(totalWithInterest.substring(1)) || 0;
        } else {
          rawInterest = parseFloat(totalWithInterest);
        }
        
        let interestVal = currency === "USD" ? rawInterest * usdToMxnRate : rawInterest;
        if (interestVal <= 0 || interestVal < finalAmount) {
          showError("El monto total con intereses debe ser mayor al monto original.");
          return;
        }
        totalAmountToCharge = interestVal;
        monthlyInstallmentAmount = interestVal / count;
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
            description: `${finalDescription} (Mensualidad ${i + 1}/${count})`,
            date: installmentDateStr,
            installments_total_amount: totalAmountToCharge,
            installments_count: count,
            installment_number: i + 1,
            expense_category_id: transactionForm.selectedCategoryId || null,
            image_url: transactionForm.imageUrl || null,
          });
        }

        const { error: txsError } = await supabase
          .from('card_transactions')
          .insert(transactionInserts);

        if (txsError) throw txsError;

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
    if (card.type === "debit") newBalance = transactionForm.type === "charge" ? newBalance - finalAmount : newBalance + finalAmount;
    else newBalance = transactionForm.type === "charge" ? newBalance + finalAmount : newBalance - finalAmount;

    const txData = {
      user_id: user?.id, card_id: card.id, type: transactionForm.type, amount: finalAmount, description: finalDescription,
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

  // Adelantar una mensualidad futura al periodo actual
  const handleAdvanceInstallment = async (tx: any) => {
    if (!user || !card) return;
    try {
      const todayStr = getLocalDateString(new Date());
      
      // Cambiar la fecha de la transacción para que caiga en el periodo actual
      const { error: updateTxError } = await supabase
        .from('card_transactions')
        .update({ date: todayStr })
        .eq('id', tx.id);

      if (updateTxError) throw updateTxError;

      showSuccess("Mensualidad adelantada al periodo actual.");
      fetchCardDetails();
    } catch (error: any) {
      showError('Error al adelantar mensualidad: ' + error.message);
    }
  };

  const handleExport = (formatType: 'csv' | 'pdf') => {
    if (!card) return;
    const data = filteredTransactions.map(tx => ({
      Fecha: format(parseISO(tx.date), "dd/MM/yyyy"),
      Tipo: tx.type === "charge" ? "Gasto" : "Abono",
      Descripción: tx.description,
      Monto: tx.amount.toFixed(2),
      Saldo: tx.runningBalance.toFixed(2)
    }));
    if (formatType === 'csv') exportToCsv(`historial_${card.name}.csv`, data);
    else exportToPdf(`historial_${card.name}.pdf`, `Historial: ${card.name}`, ["Fecha", "Tipo", "Descripción", "Monto", "Saldo"], data.map(d => Object.values(d)));
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

  // Obtener el logo del banco correspondiente usando los archivos exactos subidos por el usuario
  const bankLogoUrl = useMemo(() => {
    if (!card) return null;
    const name = card.bank_name.toLowerCase();
    if (name.includes("nu") || name.includes("nubank")) {
      return "dyad-media://media/appcuentas2/.dyad/media/97ec6769a1b8e18c52f8ddfced925ceb4163fb17149e7b167f77324ac11196b1.png";
    }
    if (name.includes("stori")) {
      return "dyad-media://media/appcuentas2/.dyad/media/87a3632f0be04bf1e1865a178608f63a9919586732604f61bc983ef21f1aa434.png";
    }
    if (name.includes("mercado") || name.includes("pago")) {
      return "dyad-media://media/appcuentas2/.dyad/media/79595b1ae3313cc2db5165d413c5c99e042cdb3129ff6e1d69814d489987b96a.png";
    }
    if (name.includes("didi")) {
      return "dyad-media://media/appcuentas2/.dyad/media/d475efd7a9684af3e1beb06bf0f256578ccffbe5e9e66093dc64b6e90c160e81.png";
    }
    if (name.includes("plata")) {
      return "dyad-media://media/appcuentas2/.dyad/media/8a612b7fa45260f208cf1ddd45d87454980d4025b07216b3d09ff8fbba1b1aef.png";
    }
    if (name.includes("bbva")) {
      return "dyad-media://media/appcuentas2/.dyad/media/a2a2feb7f1ba2ca79b46f12ca4d740cacb3d1c13e5009686f881a187083cdaac.png";
    }
    return null;
  }, [card?.bank_name]);

  const isVisa = useMemo(() => {
    if (!card) return true;
    return parseInt(card.last_four_digits) % 2 === 0;
  }, [card?.last_four_digits]);

  const networkLogoUrl = useMemo(() => {
    return isVisa 
      ? "dyad-media://media/appcuentas2/.dyad/media/871ca618ef91fce40699c8478faf0f9f0d05a828b899b8e84349ab3e6c0be6a2.png"
      : "dyad-media://media/appcuentas2/.dyad/media/5f361a174a286c7611adb5860e3f3390a33f3958c2329e451f071a4c5af9962a.png";
  }, [isVisa]);

  const pocketsBalance = useMemo(() => {
    if (!card) return 0;
    return (card.card_pockets || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  }, [card]);

  const availableCredit = useMemo(() => {
    if (!card || card.type !== "credit") return 0;
    return (card.credit_limit || 0) - card.current_balance;
  }, [card]);

  // Calcular colores de contraste dinámicos
  const textColor = useMemo(() => card ? getContrastColor(card.color) : "#FFFFFF", [card?.color]);
  const isDarkText = textColor === "#0F172A";
  const badgeBg = isDarkText ? "bg-black/10" : "bg-white/20";
  const borderStyle = isDarkText ? "border-black/10" : "border-white/10";
  const opacityClass = isDarkText ? "opacity-80" : "opacity-90";
  const subOpacityClass = isDarkText ? "opacity-60" : "opacity-75";

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="flex flex-col gap-4 p-1 md:p-4">
      <div className="flex items-center gap-3 px-1">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cards')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl md:text-3xl font-bold truncate">{card.name}</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cn("lg:col-span-2 flex flex-col gap-4", card.type !== "debit" && "lg:col-span-3")}>
          
          {/* Tarjeta de Información Principal (Diseño Realista de Tarjeta Física) */}
          <div className="w-full max-w-sm h-[240px] relative rounded-2xl shadow-2xl overflow-hidden mx-auto md:mx-1" style={{ backgroundColor: card.color }}>
            {/* Brillo de plástico de tarjeta */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/20 pointer-events-none rounded-2xl" />
            
            {/* Chip de la tarjeta */}
            <div className="absolute top-12 left-6 w-10 h-8 bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-300 rounded-md opacity-90 shadow-inner flex items-center justify-center overflow-hidden border border-yellow-600/30">
              <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0.5 p-1 opacity-40">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-black/30 rounded-sm" />
                ))}
              </div>
            </div>

            {/* Contenido de la Tarjeta */}
            <div className="p-5 flex flex-col h-full justify-between relative z-10" style={{ color: textColor }}>
              {/* Encabezado */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  {bankLogoUrl ? (
                    <img 
                      src={bankLogoUrl} 
                      alt={card.bank_name} 
                      className={cn(
                        "h-7 object-contain max-w-[100px] drop-shadow-md",
                        isDarkText ? "brightness-0" : "brightness-0 invert"
                      )}
                    />
                  ) : (
                    <span className="text-sm font-black tracking-wider uppercase drop-shadow-md">
                      {card.bank_name}
                    </span>
                  )}
                </div>
                <span className={cn("text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-full backdrop-blur-sm", badgeBg)}>
                  {card.type === "credit" ? "CRÉDITO" : "DÉBITO"}
                </span>
              </div>

              {/* Saldo / Crédito */}
              <div className="space-y-1 mt-2">
                {card.type === "credit" ? (
                  <>
                    <div className="flex justify-between items-baseline">
                      <span className={cn("text-[10px] uppercase tracking-wider font-medium", subOpacityClass)}>Crédito Disp.</span>
                      <span className="text-2xl font-black tracking-tight drop-shadow-md">
                        ${availableCredit.toFixed(2)}
                      </span>
                    </div>
                    <div className={cn("flex justify-between items-center text-[10px] border-t pt-1", borderStyle, subOpacityClass)}>
                      <span>Deuda Actual:</span>
                      <span className="font-bold">${card.current_balance.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-baseline">
                      <span className={cn("text-[10px] uppercase tracking-wider font-medium", subOpacityClass)}>Saldo Disp.</span>
                      <span className="text-2xl font-black tracking-tight drop-shadow-md">
                        ${card.current_balance.toFixed(2)}
                      </span>
                    </div>
                    <div className={cn("flex justify-between items-center text-[10px] border-t pt-1", borderStyle, subOpacityClass)}>
                      <span>Saldo en Apartados:</span>
                      <span className="font-bold">${pocketsBalance.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Número de Tarjeta y Fechas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm tracking-widest drop-shadow-md opacity-90">
                    ••••  ••••  ••••  {card.last_four_digits}
                  </p>
                  <svg className="h-4 w-4 text-white/80 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.53c-.26-.81-1-1.4-1.9-1.4h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.4z"/>
                  </svg>
                </div>

                {/* Fila Inferior: Nombre, Expiración y Red de Pago */}
                <div className="flex justify-between items-end border-t border-white/10 pt-2">
                  <div className="text-[9px] uppercase tracking-wider opacity-80">
                    <p className="font-bold truncate max-w-[120px]">{card.name || "Oinkash Member"}</p>
                    <p className="opacity-60">Vence: {card.expiration_date}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <img 
                      src={networkLogoUrl} 
                      alt="Network" 
                      className="h-6 object-contain max-w-[45px] filter brightness-0 invert drop-shadow-md"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Resumen del Periodo / Fechas (Crédito y Débito) */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mx-1 p-4 bg-muted/30 rounded-2xl border text-xs">
            {card.type === "credit" ? (
              <>
                {upcomingCutOffDate && (
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase font-bold">Próximo Corte</p>
                      <p className="font-black text-sm">{format(upcomingCutOffDate, "dd 'de' MMM", { locale: es })}</p>
                    </div>
                  </div>
                )}
                {upcomingPaymentDueDate && (
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase font-bold">Límite de Pago</p>
                      <p className="font-black text-sm">{format(upcomingPaymentDueDate, "dd 'de' MMM", { locale: es })}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 col-span-2 md:col-span-1">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase font-bold">Saldo del Mes (Pago)</p>
                    <p className="font-black text-sm text-green-600">
                      ${Math.max(0, periodMetrics.net).toFixed(2)}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase font-bold">Ingresos del Mes</p>
                    <p className="font-black text-sm text-green-600">${periodMetrics.payments.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase font-bold">Gastos del Mes</p>
                    <p className="font-black text-sm text-red-600">${periodMetrics.charges.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 col-span-2 md:col-span-1">
                  <PiggyBank className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase font-bold">Flujo Neto del Mes</p>
                    <p className={cn("font-black text-sm", periodMetrics.net >= 0 ? "text-green-600" : "text-red-600")}>
                      {periodMetrics.net >= 0 ? "+" : ""}${periodMetrics.net.toFixed(2)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

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
                {card.type === "credit" && futureInstallments.length > 0 && (
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs font-bold" onClick={() => setIsAdvanceDialogOpen(true)}>
                    <FastForward className="h-3.5 w-3.5" /> Adelantar ({futureInstallments.length})
                  </Button>
                )}
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setIsReconcileDialogOpen(true)}><Scale className="h-4 w-4" /></Button>
                <Button variant="default" size="icon" className="h-8 w-8" onClick={() => { setEditingTransaction(null); setIsDeferred(false); setCurrency("MXN"); setTransactionForm({ type: "charge", amount: "", description: "", selectedCategoryId: "", imageUrl: "" }); setIsAddTransactionDialogOpen(true); }}><DollarSign className="h-4 w-4" /></Button>
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
        onClose={() => { setIsReconcileDialogOpen(false); }}
        card={{
          ...card,
          transactions: card?.card_transactions || []
        }}
        onReconciliationSuccess={fetchCardDetails}
        onNoAdjustmentSuccess={() => showSuccess("El saldo ya está cuadrado.")}
      />

      {/* Diálogo para Adelantar Mensualidades */}
      <Dialog open={isAdvanceDialogOpen} onOpenChange={setIsAdvanceDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[500px] rounded-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FastForward className="h-5 w-5 text-primary" /> Adelantar Mensualidades
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-xs text-muted-foreground mb-4">
              Selecciona una mensualidad diferida futura para traerla al periodo de facturación actual. Esto sumará el cargo a tu pago de este mes.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Detalle</TableHead>
                    <TableHead>Fecha Programada</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {futureInstallments.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs truncate max-w-[150px]">{tx.description}</span>
                          <span className="text-[9px] text-primary font-black bg-primary/10 px-1.5 py-0.5 rounded-full w-fit mt-1">
                            {tx.installment_number}/{tx.installments_count}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs capitalize">
                        {format(parseISO(tx.date), "MMM yyyy", { locale: es })}
                      </TableCell>
                      <TableCell className="text-right font-bold text-xs">
                        ${tx.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="xs" 
                          variant="outline" 
                          className="h-7 text-[10px] font-bold gap-1"
                          onClick={() => handleAdvanceInstallment(tx)}
                        >
                          <FastForward className="h-3 w-3" /> Adelantar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdvanceDialogOpen(false)} className="w-full rounded-xl">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label>Monto</Label>
                <div className="flex bg-muted p-0.5 rounded-lg text-xs gap-1">
                  <button type="button" onClick={() => setCurrency("MXN")} className={cn("px-2 py-1 rounded-md font-bold transition-all", currency === "MXN" ? "bg-white text-indigo-900 shadow-sm" : "text-muted-foreground")}>MXN</button>
                  <button type="button" onClick={() => setCurrency("USD")} className={cn("px-2 py-1 rounded-md font-bold transition-all", currency === "USD" ? "bg-white text-indigo-900 shadow-sm" : "text-muted-foreground")}>USD</button>
                </div>
              </div>
              <div className="relative">
                <Input value={transactionForm.amount} onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})} className="rounded-xl pr-12" placeholder="0.00" required />
                <span className="absolute right-3.5 top-2.5 text-xs text-muted-foreground font-black">{currency}</span>
              </div>
              {currency === "USD" && transactionForm.amount && (
                <p className="text-[10px] text-indigo-700 font-bold flex items-center gap-1">
                  <Coins className="h-3 w-3 animate-pulse" /> Equivale a ~ ${(parseFloat(transactionForm.amount) * usdToMxnRate || 0).toFixed(2)} MXN (tasa: ${usdToMxnRate.toFixed(2)})
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Input value={transactionForm.description} onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} className="rounded-xl" required />
            </div>
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