"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Home, Users, DollarSign, CreditCard, AlertTriangle, Meh, RefreshCw, PiggyBank, CheckCircle2, CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategoryContext } from "@/context/CategoryContext";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { format, isBefore, isSameDay, addDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { getUpcomingPaymentDueDate, isPaymentDoneForCurrentStatement, getLocalDateString } from "@/utils/date-helpers";
import { Button } from "@/components/ui/button";
import GroupedPaymentDueDatesCard from "@/components/GroupedPaymentDueDatesCard";
import { cn } from "@/lib/utils";
import CreditCardsChart from "@/components/CreditCardsChart";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const exchangeRates: { [key: string]: number } = {
  MXN: 1,
  USD: 19.0,
  EUR: 20.5,
  COP: 0.0045,
  BOB: 2.7,
};

interface CardTransaction {
  id: string;
  type: "charge" | "payment";
  amount: number;
  description: string;
  date: string;
  card_id?: string;
  user_id?: string;
  income_category_id?: string | null;
  expense_category_id?: string | null;
}

interface CardData {
  id: string;
  name: string;
  bank_name: string;
  last_four_digits: string;
  expiration_date: string;
  type: "credit" | "debit";
  initial_balance: number;
  current_balance: number;
  credit_limit?: number;
  cut_off_day?: number;
  days_to_pay_after_cut_off?: number;
  color: string;
  transactions: CardTransaction[];
  user_id?: string;
  last_payment_date?: string | null;
}

const Dashboard = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, isLoadingCategories } = useCategoryContext();
  const [amountToConvert, setAmountToConvert] = useState<string>("");
  const [fromCurrency, setFromCurrency] = useState<string>("USD");
  const [toCurrency, setToCurrency] = useState<string>("MXN");

  const [cards, setCards] = useState<CardData[]>([]);
  const [cashTransactions, setCashTransactions] = useState<any[]>([]);
  const [debtors, setDebtors] = useState<any[]>([]);
  const [creditors, setCreditors] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Estado para el diálogo de "Ya pagué"
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedCardForPayment, setSelectedCardForPayment] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select('*, card_transactions(*)')
        .eq('user_id', user.id);
      if (cardsError) throw cardsError;
      setCards(cardsData || []);

      const { data: cashTxData, error: cashTxError } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('user_id', user.id);
      if (cashTxError) throw cashTxError;
      setCashTransactions(cashTxData || []);

      const { data: debtorsData, error: debtorsError } = await supabase
        .from('debtors')
        .select('*')
        .eq('user_id', user.id);
      if (debtorsError) throw debtorsError;
      setDebtors(debtorsData || []);

      const { data: creditorsData, error: creditorError } = await supabase
        .from('creditors')
        .select('*')
        .eq('user_id', user.id);
      if (creditorError) throw creditorError;
      setCreditors(creditorsData || []);
    } catch (error: any) {
      showError('Error al cargar datos: ' + error.message);
    }
  };

  useEffect(() => {
    if (user && !isLoadingCategories) {
      fetchDashboardData();
    }
  }, [user, isLoadingCategories, refreshKey]);

  const handleRefreshData = () => {
    setRefreshKey(prevKey => prevKey + 1);
    showSuccess("Datos actualizados.");
  };

  const handleMarkAsPaid = async () => {
    if (!selectedCardForPayment || !user) return;
    
    setIsSubmittingPayment(true);
    try {
      const { error } = await supabase
        .from('cards')
        .update({ last_payment_date: getLocalDateString(paymentDate) })
        .eq('id', selectedCardForPayment)
        .eq('user_id', user.id);

      if (error) throw error;

      showSuccess("Pago registrado manualmente. Las alertas se actualizarán.");
      setIsPaymentDialogOpen(false);
      handleRefreshData();
    } catch (error: any) {
      showError("Error al registrar pago: " + error.message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const totalCashBalance = useMemo(() => {
    return cashTransactions.reduce((sum, tx) => tx.type === "ingreso" ? sum + tx.amount : sum - tx.amount, 0);
  }, [cashTransactions]);

  const totalDebtorsBalance = useMemo(() => debtors.reduce((sum, d) => sum + d.current_balance, 0), [debtors]);
  const totalCreditorsBalance = useMemo(() => creditors.reduce((sum, c) => sum + c.current_balance, 0), [creditors]);
  const totalDebitCardsBalance = useMemo(() => cards.filter(c => c.type === "debit").reduce((sum, c) => sum + c.current_balance, 0), [cards]);
  const totalCreditCardDebt = useMemo(() => cards.filter(c => c.type === "credit").reduce((sum, c) => sum + c.current_balance, 0), [cards]);
  const totalOverallBalance = useMemo(() => totalCashBalance + totalDebtorsBalance + totalDebitCardsBalance - totalCreditorsBalance - totalCreditCardDebt, [totalCashBalance, totalDebtorsBalance, totalDebitCardsBalance, totalCreditorsBalance, totalCreditCardDebt]);

  const cardHealthStatus = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoDaysFromNow = addDays(today, 2);

    let hasCriticalIssue = false;
    let hasWarningIssue = false;
    const criticalCards: string[] = [];
    const warningCards: string[] = [];

    for (const card of cards) {
      if (card.type === "credit") {
        if (card.credit_limit !== undefined && card.current_balance >= card.credit_limit) {
          hasCriticalIssue = true;
          criticalCards.push(`${card.name} (límite alcanzado)`);
        }

        if (card.cut_off_day !== undefined && card.days_to_pay_after_cut_off !== undefined) {
          // Verificar si ya se marcó como pagado para este ciclo
          const isPaidManually = isPaymentDoneForCurrentStatement(card.last_payment_date, card.cut_off_day, card.days_to_pay_after_cut_off);
          
          if (!isPaidManually && card.current_balance > 0) {
            const paymentDueDate = getUpcomingPaymentDueDate(card.cut_off_day, card.days_to_pay_after_cut_off, today);
            if (isBefore(paymentDueDate, today) && !isSameDay(paymentDueDate, today)) {
              hasCriticalIssue = true;
              criticalCards.push(`${card.name} (pago vencido el ${format(paymentDueDate, "dd/MM/yyyy")})`);
            } else if ((isBefore(paymentDueDate, twoDaysFromNow) || isSameDay(paymentDueDate, twoDaysFromNow))) {
              hasWarningIssue = true;
              warningCards.push(`${card.name} (pago próximo el ${format(paymentDueDate, "dd/MM/yyyy")})`);
            }
          }
        }
      } else if (card.current_balance < 0) {
        hasCriticalIssue = true;
        criticalCards.push(`${card.name} (saldo negativo)`);
      }
    }

    return { 
      status: hasCriticalIssue ? "critical" : (hasWarningIssue ? "warning" : "all_good"), 
      cards: [...criticalCards, ...warningCards] 
    };
  }, [cards]);

  const piggyBankImageSrc = cardHealthStatus.status === "critical"
    ? "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Fuego.png"
    : "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Conchinito%20feliz.png";

  const userFirstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'Usuario';

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Hola, {userFirstName}</h1>
        <Button variant="outline" size="sm" onClick={handleRefreshData}>
          <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
        </Button>
      </div>

      {cardHealthStatus.status !== "all_good" && (
        <Card className={cn(
          "relative overflow-hidden",
          cardHealthStatus.status === "critical" ? "border-blue-600 bg-blue-50 text-blue-800" : "border-orange-600 bg-orange-50 text-orange-800"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Estado de Tarjetas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pr-4 md:block md:pr-48">
            <img src={piggyBankImageSrc} alt="Cochinito" className="h-[180px] w-[180px] mb-4 mx-auto md:absolute md:top-[20px] md:right-[4px] md:z-10" />
            <div className="text-lg font-bold text-center md:text-left">
              {cardHealthStatus.status === "critical" ? "Oye, pon atención en tus saldos" : "Atención: Algo no cuadra"}
            </div>
            <div className="text-xs mt-1 text-center md:text-left">
              <ul className="list-disc pl-5 mt-1">
                {cardHealthStatus.cards.map((msg, index) => <li key={index}>{msg}</li>)}
              </ul>
            </div>
            <div className="mt-4 flex justify-center md:justify-start">
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-white/50 hover:bg-white border-current gap-2"
                onClick={() => setIsPaymentDialogOpen(true)}
              >
                <CheckCircle2 className="h-4 w-4" /> Ya pagué
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <GroupedPaymentDueDatesCard cards={cards} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-green-600 bg-green-50 text-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">TU DINERITO</CardTitle>
            <Home className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">${totalCashBalance.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-green-600 bg-green-50 text-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">QUIEN TE DEBE</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">${totalDebtorsBalance.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A QUIEN LE DEBES</CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">${totalCreditorsBalance.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-pink-500 bg-pink-50 text-pink-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">BALANCE TOTAL</CardTitle>
            <PiggyBank className="h-4 w-4 text-pink-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">${totalOverallBalance.toFixed(2)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Resumen de Créditos</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarjeta</TableHead>
                  <TableHead>Límite</TableHead>
                  <TableHead>Deuda</TableHead>
                  <TableHead>Disponible</TableHead>
                  <TableHead>Próx. Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.filter(c => c.type === "credit").map((card) => {
                  const available = (card.credit_limit || 0) - card.current_balance;
                  const dueDate = card.cut_off_day && card.days_to_pay_after_cut_off 
                    ? getUpcomingPaymentDueDate(card.cut_off_day, card.days_to_pay_after_cut_off) 
                    : null;
                  const isPaid = isPaymentDoneForCurrentStatement(card.last_payment_date, card.cut_off_day!, card.days_to_pay_after_cut_off!);

                  return (
                    <TableRow key={card.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: card.color }} />
                          {card.name}
                        </div>
                      </TableCell>
                      <TableCell>${card.credit_limit?.toFixed(2)}</TableCell>
                      <TableCell>${card.current_balance.toFixed(2)}</TableCell>
                      <TableCell className={available < 0 ? "text-red-600" : ""}>${available.toFixed(2)}</TableCell>
                      <TableCell>
                        {isPaid ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Pagado</Badge>
                        ) : (
                          dueDate ? format(dueDate, "dd/MM/yyyy") : "N/A"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Gráfico de Créditos</CardTitle></CardHeader>
        <CardContent><CreditCardsChart cards={cards} /></CardContent>
      </Card>

      {/* Diálogo de Ya Pagué */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirmar Pago de Tarjeta</DialogTitle>
            <DialogDescription>
              Si ya realizaste el pago pero aún no registras el movimiento, puedes marcarlo aquí para ocultar las alertas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>¿Qué tarjeta pagaste?</Label>
              <Select value={selectedCardForPayment} onValueChange={setSelectedCardForPayment}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tarjeta" />
                </SelectTrigger>
                <SelectContent>
                  {cards.filter(c => c.type === "credit" && c.current_balance > 0).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} (${c.current_balance.toFixed(2)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Fecha del Pago</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? format(paymentDate, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={paymentDate} onSelect={(d) => d && setPaymentDate(d)} initialFocus locale={es} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleMarkAsPaid} disabled={!selectedCardForPayment || isSubmittingPayment}>
              {isSubmittingPayment ? "Guardando..." : "Confirmar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;