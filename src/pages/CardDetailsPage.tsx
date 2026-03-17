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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DollarSign, History, Trash2, Edit, CalendarIcon, ArrowLeft, FileDown, FileText, ChevronLeft, ChevronRight } from "lucide-react";
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

const CardDetailsPage: React.FC = () => {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { getCategoryById, isLoadingCategories } = useCategoryContext();
  
  const [card, setCard] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  
  const [newTransaction, setNewTransaction] = useState({
    type: "charge" as "charge" | "payment",
    amount: "",
    description: "",
    date: new Date(),
    imageUrl: null as string | null,
  });

  const fetchCardDetails = async () => {
    if (!user || !cardId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('cards')
      .select('*, card_transactions(*), card_pockets(*)')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      showError('Error al cargar detalles');
      navigate('/cards');
    } else {
      setCard(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (user && !isLoadingCategories) fetchCardDetails();
  }, [cardId, user, isLoadingCategories]);

  const pocketsBalance = useMemo(() => 
    (card?.card_pockets || []).reduce((s: number, p: any) => s + Number(p.amount), 0)
  , [card]);

  const filteredTransactions = useMemo(() => {
    if (!card) return [];
    const start = startOfMonth(currentViewDate);
    const end = endOfMonth(currentViewDate);

    return (card.card_transactions || [])
      .filter((tx: any) => {
        const txDate = parseISO(tx.date);
        return isWithinInterval(txDate, { start, end });
      })
      .sort((a: any, b: any) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [card, currentViewDate]);

  const handleExport = (formatType: 'csv' | 'pdf') => {
    const data = filteredTransactions.map((tx: any) => ({
      Fecha: format(parseISO(tx.date), "dd/MM/yyyy"),
      Descripción: tx.description,
      Tipo: tx.type === "charge" ? "Cargo" : "Abono",
      Monto: tx.amount.toFixed(2),
      Categoría: getCategoryById(tx.income_category_id || tx.expense_category_id)?.name || "Sin categoría"
    }));

    const filename = `movimientos_${card.name}_${format(currentViewDate, "MM_yyyy")}`;
    if (formatType === 'csv') exportToCsv(`${filename}.csv`, data);
    else exportToPdf(`${filename}.pdf`, `Movimientos: ${card.name}`, ["Fecha", "Descripción", "Tipo", "Monto", "Categoría"], data.map(d => Object.values(d)));
  };

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
      date: format(newTransaction.date, "yyyy-MM-dd")
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
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="p-6 text-white shadow-xl" style={{ backgroundColor: card.color }}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-sm opacity-80">Saldo Disponible</p>
                <p className="text-4xl font-black">${card.current_balance.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-80">{card.bank_name}</p>
                <p className="font-bold">**** {card.last_four_digits}</p>
              </div>
            </div>
            {pocketsBalance > 0 && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                <div>
                  <p className="text-xs opacity-70">En Apartados</p>
                  <p className="text-lg font-bold">${pocketsBalance.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-70">Saldo Total</p>
                  <p className="text-lg font-bold">${(card.current_balance + pocketsBalance).toFixed(2)}</p>
                </div>
              </div>
            )}
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm"><FileDown className="h-4 w-4 mr-1" /> Exportar</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport('csv')}><FileText className="h-4 w-4 mr-2" /> CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('pdf')}><FileText className="h-4 w-4 mr-2" /> PDF</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <CardPocketsManager cardId={card.id} cardBalance={card.current_balance} onUpdate={fetchCardDetails} />
        </div>
      </div>

      <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Transacción</DialogTitle></DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-4 py-4">
            <Select value={newTransaction.type} onValueChange={(v: any) => setNewTransaction({...newTransaction, type: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="charge">Cargo (Gasto)</SelectItem><SelectItem value="payment">Abono (Ingreso)</SelectItem></SelectContent>
            </Select>
            <Input placeholder="Monto" value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} required />
            <Input placeholder="Descripción" value={newTransaction.description} onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} required />
            <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CardDetailsPage;