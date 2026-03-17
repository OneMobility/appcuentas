"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DollarSign, History, Trash2, Edit, CalendarIcon, ArrowLeft, FileDown, AlertTriangle, Scale, ArrowRightLeft, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, isWithinInterval, isAfter, startOfMonth, endOfMonth, addMonths, subMonths, getMonth, getYear } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getUpcomingPaymentDueDate, getRelevantStatementForPayment } from "@/utils/date-helpers";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useCategoryContext } from "@/context/CategoryContext";
import { toast } from "sonner";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { evaluateExpression } from "@/utils/math-helpers";
import CardReconciliationDialog from "@/components/CardReconciliationDialog";
import FeedbackOverlay from "@/components/FeedbackOverlay";
import CardTransferDialog from "@/components/CardTransferDialog";
import ImageUpload from "@/components/ImageUpload";
import CardPocketsManager from "@/components/CardPocketsManager";

interface CardTransaction {
  id: string;
  type: "charge" | "payment";
  amount: number;
  description: string;
  date: string;
  created_at: string;
  card_id?: string;
  user_id?: string;
  income_category_id?: string | null;
  expense_category_id?: string | null;
  is_adjustment?: boolean;
  image_url?: string | null;
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
}

const CardDetailsPage: React.FC = () => {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { incomeCategories, expenseCategories, getCategoryById, isLoadingCategories } = useCategoryContext();
  
  const [card, setCard] = useState<CardData | null>(null);
  const [allCards, setAllCards] = useState<CardData[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estado para el filtro mensual
  const [currentViewDate, setCurrentViewDate] = useState(new Date());

  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [isEditTransactionDialogOpen, setIsEditTransactionDialogOpen] = useState(false);
  const [isReconciliationDialogOpen, setIsReconciliationDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<CardTransaction | null>(null);
  
  const [newTransaction, setNewTransaction] = useState({
    type: "charge" as "charge" | "payment",
    amount: "",
    description: "",
    date: undefined as Date | undefined,
    selectedCategoryId: "",
    selectedCategoryType: "" as "income" | "expense" | "",
    imageUrl: null as string | null,
  });

  const [feedbackOverlay, setFeedbackOverlay] = useState<{
    isVisible: boolean;
    message: string;
    imageSrc: string;
    bgColor: string;
    textColor: string;
  } | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "charge" | "payment">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [isOverdue, setIsOverdue] = useState(false);

  const fetchCardDetails = async () => {
    if (!user || !cardId || isLoadingCategories) return;
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
    } else {
      setCard({ ...data, transactions: data.card_transactions || [] });
    }
    setIsLoading(false);
  };

  const fetchGlobalData = async () => {
    if (!user) return;
    const { data: allCardsData } = await supabase.from('cards').select('*').eq('user_id', user.id);
    setAllCards(allCardsData || []);
    const { data: cashTxData } = await supabase.from('cash_transactions').select('type, amount').eq('user_id', user.id);
    const currentCash = (cashTxData || []).reduce((sum, tx) => tx.type === "ingreso" ? sum + tx.amount : sum - tx.amount, 0);
    setCashBalance(currentCash);
  };

  useEffect(() => {
    fetchCardDetails();
    fetchGlobalData();
  }, [cardId, user, isLoadingCategories]);

  const filteredTransactions = useMemo(() => {
    if (!card) return [];
    const start = startOfMonth(currentViewDate);
    const end = endOfMonth(currentViewDate);

    return card.transactions
      .filter(tx => {
        const txDate = parseISO(tx.date);
        const matchesMonth = isWithinInterval(txDate, { start, end });
        const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === "all" || tx.type === filterType;
        const categoryId = tx.income_category_id || tx.expense_category_id;
        const matchesCategory = filterCategory === "all" || categoryId === filterCategory;
        return matchesMonth && matchesSearch && matchesType && matchesCategory;
      })
      .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [card, currentViewDate, searchTerm, filterType, filterCategory]);

  const handlePrevMonth = () => setCurrentViewDate(subMonths(currentViewDate, 1));
  const handleNextMonth = () => setCurrentViewDate(addMonths(currentViewDate, 1));

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !card) return;

    let amount = newTransaction.amount.startsWith('=') 
      ? evaluateExpression(newTransaction.amount.substring(1)) 
      : parseFloat(newTransaction.amount);

    if (!amount || amount <= 0) { showError("Monto inválido"); return; }
    if (!newTransaction.date) { showError("Selecciona una fecha"); return; }

    try {
      let newBalance = card.current_balance;
      if (card.type === "debit") {
        newBalance = newTransaction.type === "charge" ? newBalance - amount : newBalance + amount;
      } else {
        newBalance = newTransaction.type === "charge" ? newBalance + amount : newBalance - amount;
      }

      const { error: txError } = await supabase.from('card_transactions').insert({
        user_id: user.id,
        card_id: card.id,
        type: newTransaction.type,
        amount,
        description: newTransaction.description,
        date: format(newTransaction.date, "yyyy-MM-dd"),
        income_category_id: newTransaction.selectedCategoryType === "income" ? newTransaction.selectedCategoryId : null,
        expense_category_id: newTransaction.selectedCategoryType === "expense" ? newTransaction.selectedCategoryId : null,
        image_url: newTransaction.imageUrl
      });

      if (txError) throw txError;
      await supabase.from('cards').update({ current_balance: newBalance }).eq('id', card.id);

      showSuccess("Transacción registrada");
      setIsAddTransactionDialogOpen(false);
      fetchCardDetails();
    } catch (e: any) {
      showError("Error: " + e.message);
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
          <Card className="p-6 text-white" style={{ backgroundColor: card.color }}>
            <CardHeader className="p-0 mb-4">
              <CardTitle className="flex justify-between">
                <span>{card.bank_name}</span>
                <span className="text-sm opacity-80">{card.type.toUpperCase()}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-sm opacity-80">{card.type === "credit" ? "Crédito Disponible" : "Saldo Disponible"}</p>
              <p className="text-4xl font-extrabold">
                ${(card.type === "credit" ? (card.credit_limit! - card.current_balance) : card.current_balance).toFixed(2)}
              </p>
              <div className="mt-4 grid grid-cols-2 text-sm opacity-90">
                <div><p>Número</p><p className="font-bold">**** {card.last_four_digits}</p></div>
                <div className="text-right"><p>Expira</p><p className="font-bold">{card.expiration_date}</p></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <CardTitle>Movimientos</CardTitle>
                <div className="flex items-center bg-muted rounded-lg p-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="px-3 text-sm font-medium min-w-[120px] text-center capitalize">
                    {format(currentViewDate, "MMMM yyyy", { locale: es })}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
              <Button size="sm" onClick={() => setIsAddTransactionDialogOpen(true)}>
                <DollarSign className="h-4 w-4 mr-1" /> Nueva Transacción
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell>{format(parseISO(tx.date), "dd/MM")}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{tx.description}</span>
                            <span className="text-xs text-muted-foreground">
                              {getCategoryById(tx.income_category_id || tx.expense_category_id)?.name || "Sin categoría"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className={cn("text-right font-bold", tx.type === "charge" ? "text-red-600" : "text-green-600")}>
                          {tx.type === "charge" ? "-" : "+"}${tx.amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No hay movimientos en este mes.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <CardPocketsManager cardId={card.id} cardBalance={card.current_balance} onUpdate={fetchCardDetails} />
          
          {card.type === "credit" && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader><CardTitle className="text-sm text-blue-800">Información de Pago</CardTitle></CardHeader>
              <CardContent className="text-sm text-blue-900 space-y-2">
                <div className="flex justify-between"><span>Día de Corte:</span><span className="font-bold">{card.cut_off_day}</span></div>
                <div className="flex justify-between"><span>Límite:</span><span className="font-bold">${card.credit_limit?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Deuda Actual:</span><span className="font-bold text-red-600">${card.current_balance.toFixed(2)}</span></div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogo de Transacción */}
      <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Transacción</DialogTitle></DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={newTransaction.type} onValueChange={(v: any) => setNewTransaction({...newTransaction, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="charge">Cargo (Gasto)</SelectItem>
                  <SelectItem value="payment">Pago (Ingreso/Abono)</SelectItem>
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
              <Label>Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newTransaction.date ? format(newTransaction.date, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={newTransaction.date} onSelect={d => setNewTransaction({...newTransaction, date: d})} locale={es} />
                </PopoverContent>
              </Popover>
            </div>
            <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CardDetailsPage;