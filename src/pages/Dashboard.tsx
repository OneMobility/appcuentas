"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Home, Users, DollarSign, CreditCard, RefreshCw, PiggyBank, CheckCircle2, CalendarIcon, AlertCircle } from "lucide-react";
import { useCategoryContext } from "@/context/CategoryContext";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { format, isBefore, isSameDay, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUpcomingPaymentDueDate, isPaymentDoneForCurrentStatement, getLocalDateString } from "@/utils/date-helpers";
import { Button } from "@/components/ui/button";
import GroupedPaymentDueDatesCard from "@/components/GroupedPaymentDueDatesCard";
import { cn } from "@/lib/utils";
import CreditCardsChart from "@/components/CreditCardsChart";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  user_id?: string;
}

const Dashboard = () => {
  const { user } = useSession();
  const { isLoadingCategories } = useCategoryContext();

  const [cards, setCards] = useState<CardData[]>([]);
  const [cashTransactions, setCashTransactions] = useState<any[]>([]);
  const [debtors, setDebtors] = useState<any[]>([]);
  const [creditors, setCreditors] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedCardForPayment, setSelectedCardForPayment] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [manualPayments, setManualPayments] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem('oinkash_manual_payments');
    if (saved) {
      try { setManualPayments(JSON.parse(saved)); } catch (e) { setManualPayments({}); }
    }
  }, [refreshKey]);

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      const [cardsRes, cashRes, debtorsRes, creditorsRes] = await Promise.all([
        supabase.from('cards').select('*').eq('user_id', user.id),
        supabase.from('cash_transactions').select('*').eq('user_id', user.id),
        supabase.from('debtors').select('*').eq('user_id', user.id),
        supabase.from('creditors').select('*').eq('user_id', user.id)
      ]);
      setCards(cardsRes.data || []);
      setCashTransactions(cashRes.data || []);
      setDebtors(debtorsRes.data || []);
      setCreditors(creditorsRes.data || []);
    } catch (error: any) {
      showError('Error al cargar datos');
    }
  };

  useEffect(() => {
    if (user && !isLoadingCategories) fetchDashboardData();
  }, [user, isLoadingCategories, refreshKey]);

  const handleMarkAsPaid = () => {
    if (!selectedCardForPayment) return;
    setIsSubmittingPayment(true);
    const updatedPayments = { ...manualPayments, [selectedCardForPayment]: getLocalDateString(paymentDate) };
    localStorage.setItem('oinkash_manual_payments', JSON.stringify(updatedPayments));
    setManualPayments(updatedPayments);
    showSuccess("Pago marcado.");
    setIsPaymentDialogOpen(false);
    setIsSubmittingPayment(false);
    setRefreshKey(prev => prev + 1);
  };

  const totals = useMemo(() => {
    const cash = cashTransactions.reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0);
    const debt = debtors.reduce((s, d) => s + d.current_balance, 0);
    const cred = creditors.reduce((s, c) => s + c.current_balance, 0);
    const debitCards = cards.filter(c => c.type === "debit").reduce((s, c) => s + c.current_balance, 0);
    const creditDebt = cards.filter(c => c.type === "credit").reduce((s, c) => s + c.current_balance, 0);
    return { cash, debt, cred, debitCards, creditDebt, total: cash + debt + debitCards - cred - creditDebt };
  }, [cashTransactions, debtors, creditors, cards]);

  const cardHealth = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoDays = addDays(today, 2);
    const issues: string[] = [];
    let status: "all_good" | "warning" | "critical" = "all_good";

    cards.forEach(c => {
      if (c.type === "credit") {
        if (c.credit_limit && c.current_balance >= c.credit_limit) {
          status = "critical";
          issues.push(`${c.name}: Límite alcanzado`);
        }
        if (c.cut_off_day && c.days_to_pay_after_cut_off && !isPaymentDoneForCurrentStatement(manualPayments[c.id], c.cut_off_day, c.days_to_pay_after_cut_off)) {
          const due = getUpcomingPaymentDueDate(c.cut_off_day, c.days_to_pay_after_cut_off, today);
          if (isBefore(due, today) && !isSameDay(due, today)) {
            status = "critical";
            issues.push(`${c.name}: Pago vencido`);
          } else if (isBefore(due, twoDays) || isSameDay(due, twoDays)) {
            if (status !== "critical") status = "warning";
            issues.push(`${c.name}: Pago próximo`);
          }
        }
      } else if (c.current_balance < 0) {
        status = "critical";
        issues.push(`${c.name}: Saldo negativo`);
      }
    });
    return { status, issues };
  }, [cards, manualPayments]);

  const userFirstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'Usuario';

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl md:text-3xl font-bold tracking-tight">Hola, {userFirstName}</h1>
        <Button variant="outline" size="icon" onClick={() => setRefreshKey(k => k + 1)} className="rounded-full h-8 w-8 md:h-10 md:w-10">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {cardHealth.status !== "all_good" && (
        <Card className={cn(
          "relative overflow-hidden border-none shadow-lg mx-1",
          cardHealth.status === "critical" ? "bg-blue-600 text-white" : "bg-orange-500 text-white"
        )}>
          <CardContent className="p-4 md:p-6 flex flex-col md:flex-row items-center gap-4 md:gap-6">
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg md:text-xl font-bold mb-1 md:mb-2">
                {cardHealth.status === "critical" ? "¡Atención con tus saldos!" : "Algo requiere tu atención"}
              </h3>
              <ul className="text-xs md:text-sm opacity-90 space-y-0.5">
                {cardHealth.issues.map((msg, i) => <li key={i} className="flex items-center justify-center md:justify-start gap-2"><AlertCircle className="h-3 w-3" /> {msg}</li>)}
              </ul>
              <Button 
                variant="secondary" 
                size="sm" 
                className="mt-3 md:mt-4 rounded-full font-bold h-8 text-xs"
                onClick={() => setIsPaymentDialogOpen(true)}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Ya pagué
              </Button>
            </div>
            <img 
              src={cardHealth.status === "critical" ? "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Fuego.png" : "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Conchinito%20feliz.png"} 
              alt="Status" 
              className="h-24 w-24 md:h-32 md:w-32 object-contain"
            />
          </CardContent>
        </Card>
      )}

      <div className="px-1">
        <GroupedPaymentDueDatesCard cards={cards} />
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 px-1">
        {[
          { label: "TU DINERITO", val: totals.cash, icon: Home, color: "text-green-600", bg: "bg-green-50" },
          { label: "TE DEBEN", val: totals.debt, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "DEBES", val: totals.cred, icon: DollarSign, color: "text-red-600", bg: "bg-red-50" },
          { label: "BALANCE", val: totals.total, icon: PiggyBank, color: "text-pink-600", bg: "bg-pink-50" },
        ].map((item, i) => (
          <Card key={i} className={cn("border-none shadow-sm", item.bg)}>
            <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider opacity-70">{item.label}</CardTitle>
              <item.icon className={cn("h-3.5 w-3.5", item.color)} />
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="text-base md:text-xl font-bold">${item.val.toFixed(2)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-sm overflow-hidden mx-1">
        <CardHeader className="bg-muted/30 p-4"><CardTitle className="text-base md:text-lg">Resumen de Créditos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-hide">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 text-xs">Tarjeta</TableHead>
                  <TableHead className="text-xs">Deuda</TableHead>
                  <TableHead className="text-xs">Disponible</TableHead>
                  <TableHead className="pr-4 text-xs text-right">Próx. Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.filter(c => c.type === "credit").map((card) => {
                  const avail = (card.credit_limit || 0) - card.current_balance;
                  const isPaid = isPaymentDoneForCurrentStatement(manualPayments[card.id], card.cut_off_day!, card.days_to_pay_after_cut_off!);
                  return (
                    <TableRow key={card.id}>
                      <TableCell className="pl-4 font-medium text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: card.color }} />
                          <span className="truncate max-w-[80px]">{card.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">${card.current_balance.toFixed(0)}</TableCell>
                      <TableCell className={cn("text-xs", avail < 0 ? "text-red-600 font-bold" : "")}>${avail.toFixed(0)}</TableCell>
                      <TableCell className="pr-4 text-right">
                        {isPaid ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0">Pagado</Badge> : (card.cut_off_day ? <span className="text-xs">{format(getUpcomingPaymentDueDate(card.cut_off_day, card.days_to_pay_after_cut_off!), "dd/MM")}</span> : "N/A")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm mx-1">
        <CardHeader className="p-4"><CardTitle className="text-base md:text-lg">Uso de Crédito</CardTitle></CardHeader>
        <CardContent className="p-2 md:p-4"><CreditCardsChart cards={cards} /></CardContent>
      </Card>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle>Confirmar Pago</DialogTitle>
            <DialogDescription>Marca una tarjeta como pagada para este ciclo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tarjeta</Label>
              <Select value={selectedCardForPayment} onValueChange={setSelectedCardForPayment}>
                <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {cards.filter(c => c.type === "credit" && c.current_balance > 0).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal rounded-xl h-10">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(paymentDate, "PPP", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={paymentDate} onSelect={(d) => d && setPaymentDate(d)} locale={es} /></PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleMarkAsPaid} disabled={!selectedCardForPayment || isSubmittingPayment} className="w-full rounded-xl font-bold h-11">Confirmar Pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;