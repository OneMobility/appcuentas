"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DollarSign, Trash2, Edit, ArrowLeft, FileDown, History, AlertCircle, Search, Filter, FileText, Share2, Copy, MessageSquare } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useCategoryContext } from "@/context/CategoryContext";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";
import { Badge } from "@/components/ui/badge";

interface DebtorTransaction {
  id: string;
  type: "charge" | "payment";
  amount: number;
  description: string;
  date: string;
  created_at: string;
}

interface Debtor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  phone?: string;
  due_date?: string;
  debtor_transactions: DebtorTransaction[];
}

const DebtorDetailsPage: React.FC = () => {
  const { debtorId } = useParams<{ debtorId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { incomeCategories } = useCategoryContext();
  
  const [debtor, setDebtor] = useState<Debtor | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "charge" | "payment">("all");

  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [skipLinkedTransaction, setSkipLinkedTransaction] = useState(false);

  const [sharePhone, setSharePhone] = useState("");

  const [transactionForm, setTransactionForm] = useState({
    type: "payment" as "charge" | "payment",
    amount: "",
    description: "",
    destinationAccountId: "cash",
    selectedIncomeCategoryId: "",
  });

  const fetchData = async () => {
    if (!user || !debtorId) return;
    setIsLoading(true);
    try {
      const { data: debtorData, error: debtorError } = await supabase
        .from('debtors')
        .select('*, debtor_transactions(*)')
        .eq('id', debtorId)
        .eq('user_id', user.id)
        .single();

      if (debtorError) throw debtorError;
      setDebtor(debtorData);
      setSharePhone(debtorData.phone || "");

      const { data: cardsData } = await supabase.from('cards').select('*').eq('user_id', user.id);
      setCards(cardsData || []);

      const { data: cashTxData } = await supabase.from('cash_transactions').select('type, amount').eq('user_id', user.id);
      setCashBalance((cashTxData || []).reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0));

      if (!transactionForm.selectedIncomeCategoryId && incomeCategories.length > 0) {
        setTransactionForm(prev => ({ ...prev, selectedIncomeCategoryId: incomeCategories[0].id }));
      }
    } catch (error: any) {
      showError('Error al cargar detalles');
      navigate('/debtors');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [debtorId, user, incomeCategories]);

  // Auto-sincronizar el saldo actual en la base de datos si no coincide con la suma de transacciones
  useEffect(() => {
    if (!debtor) return;
    const totalCharges = debtor.debtor_transactions
      .filter(t => t.type === 'charge')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalPayments = debtor.debtor_transactions
      .filter(t => t.type === 'payment')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expectedBalance = debtor.initial_balance + totalCharges - totalPayments;

    if (Math.abs(debtor.current_balance - expectedBalance) > 0.01) {
      const syncBalance = async () => {
        await supabase
          .from('debtors')
          .update({ current_balance: expectedBalance })
          .eq('id', debtor.id);
        fetchData();
      };
      syncBalance();
    }
  }, [debtor]);

  // Cálculo de Saldo Acumulado calculando hacia adelante desde la deuda inicial
  const transactionsWithBalance = useMemo(() => {
    if (!debtor) return [];
    
    // Ordenar por fecha de creación ascendente (el más antiguo primero) para calcular hacia adelante
    const sortedAsc = [...debtor.debtor_transactions].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let current = debtor.initial_balance;
    const computedAsc = sortedAsc.map(tx => {
      if (tx.type === "charge") {
        current += tx.amount;
      } else {
        current -= tx.amount;
      }
      return { ...tx, runningBalance: current };
    });

    // Devolver en orden descendente (el más nuevo primero) para la tabla
    return computedAsc.reverse();
  }, [debtor]);

  const filteredTransactions = useMemo(() => {
    return transactionsWithBalance.filter(tx => {
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [transactionsWithBalance, searchTerm, filterType]);

  const handleOpenAdd = () => {
    setEditingTransaction(null);
    setTransactionForm({
      type: (debtor?.current_balance || 0) <= 0 ? "charge" : "payment",
      amount: "",
      description: "",
      destinationAccountId: "cash",
      selectedIncomeCategoryId: incomeCategories[0]?.id || "",
    });
    setSkipLinkedTransaction(false);
    setIsTransactionDialogOpen(true);
  };

  const handleOpenEdit = (tx: any) => {
    setEditingTransaction(tx);
    setTransactionForm({
      type: tx.type,
      amount: tx.amount.toString(),
      description: tx.description,
      destinationAccountId: "cash",
      selectedIncomeCategoryId: incomeCategories[0]?.id || "",
    });
    setSkipLinkedTransaction(true);
    setIsTransactionDialogOpen(true);
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !debtor) return;

    const amount = evaluateExpression(transactionForm.amount) || 0;
    if (amount <= 0) { showError("Monto inválido"); return; }

    try {
      if (editingTransaction) {
        const { error: updateTxError } = await supabase
          .from('debtor_transactions')
          .update({ 
            type: transactionForm.type, 
            amount, 
            description: transactionForm.description 
          })
          .eq('id', editingTransaction.id);
        
        if (updateTxError) throw updateTxError;
      } else {
        const { error: insertTxError } = await supabase
          .from('debtor_transactions')
          .insert({ 
            user_id: user.id, 
            debtor_id: debtor.id, 
            type: transactionForm.type, 
            amount, 
            description: transactionForm.description, 
            date: getLocalDateString(new Date()) 
          });
        
        if (insertTxError) throw insertTxError;

        // Manejar transacción vinculada si es un abono y no se omite
        if (transactionForm.type === "payment" && !skipLinkedTransaction) {
          const linkedDesc = `Abono de ${debtor.name}: ${transactionForm.description}`;
          if (transactionForm.destinationAccountId === "cash") {
            await supabase.from('cash_transactions').insert({ 
              user_id: user.id, 
              type: "ingreso", 
              amount, 
              description: linkedDesc, 
              date: getLocalDateString(new Date()), 
              income_category_id: transactionForm.selectedIncomeCategoryId || null 
            });
          } else {
            const card = cards.find(c => c.id === transactionForm.destinationAccountId);
            if (card) {
              const newCardBalance = card.type === "credit" ? card.current_balance - amount : card.current_balance + amount;
              await supabase.from('cards').update({ current_balance: newCardBalance }).eq('id', card.id);
              await supabase.from('card_transactions').insert({ 
                user_id: user.id, 
                card_id: card.id, 
                type: "payment", 
                amount, 
                description: linkedDesc, 
                date: getLocalDateString(new Date()), 
                income_category_id: transactionForm.selectedIncomeCategoryId || null 
              });
            }
          }
        }
      }

      // Recalcular el saldo basado en todas las transacciones existentes
      const { data: txs, error: fetchError } = await supabase
        .from('debtor_transactions')
        .select('type, amount')
        .eq('debtor_id', debtor.id);
      
      if (fetchError) throw fetchError;

      const totalCharges = (txs || [])
        .filter(t => t.type === 'charge')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalPayments = (txs || [])
        .filter(t => t.type === 'payment')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const newBalance = debtor.initial_balance + totalCharges - totalPayments;

      const { error: updateError } = await supabase
        .from('debtors')
        .update({ current_balance: newBalance })
        .eq('id', debtor.id);

      if (updateError) throw updateError;

      showSuccess(editingTransaction ? "Movimiento actualizado" : "Movimiento registrado");
      setIsTransactionDialogOpen(false);
      
      // Enviar mensaje de WhatsApp si tiene teléfono
      if (!editingTransaction && debtor.phone) {
        if (window.confirm("¿Enviar comprobante por WhatsApp?")) {
          const typeLabel = transactionForm.type === "charge" ? "Cargo" : "Abono";
          const msg = `Hola ${debtor.name}, se registró un ${typeLabel} por $${amount.toFixed(2)}. Saldo actual: $${newBalance.toFixed(2)}.`;
          const cleanPhone = debtor.phone.replace(/\D/g, '');
          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        }
      }

      fetchData();
    } catch (error: any) {
      showError('Error: ' + error.message);
    }
  };

  const handleDeleteTransaction = async (tx: any) => {
    if (!user || !debtor) return;
    try {
      const { error: deleteError } = await supabase
        .from('debtor_transactions')
        .delete()
        .eq('id', tx.id);

      if (deleteError) throw deleteError;

      // Recalcular el saldo basado en las transacciones restantes
      const { data: txs, error: fetchError } = await supabase
        .from('debtor_transactions')
        .select('type, amount')
        .eq('debtor_id', debtor.id);
      
      if (fetchError) throw fetchError;

      const totalCharges = (txs || [])
        .filter(t => t.type === 'charge')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalPayments = (txs || [])
        .filter(t => t.type === 'payment')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const newBalance = debtor.initial_balance + totalCharges - totalPayments;

      const { error: updateError } = await supabase
        .from('debtors')
        .update({ current_balance: newBalance })
        .eq('id', debtor.id);

      if (updateError) throw updateError;

      showSuccess("Movimiento eliminado");
      fetchData();
    } catch (error: any) {
      showError('Error al eliminar: ' + error.message);
    }
  };

  const handleExport = (formatType: 'csv' | 'pdf') => {
    if (!debtor) return;
    const data = filteredTransactions.map(tx => ({
      Fecha: format(parseISO(tx.date), "dd/MM/yyyy"),
      Tipo: tx.type === "charge" ? "Cargo" : "Abono",
      Descripción: tx.description,
      Monto: tx.amount.toFixed(2),
      Saldo: tx.runningBalance.toFixed(2)
    }));
    if (formatType === 'csv') exportToCsv(`historial_${debtor.name}.csv`, data);
    else exportToPdf(`historial_${debtor.name}.pdf`, `Historial: ${debtor.name}`, ["Fecha", "Tipo", "Descripción", "Monto", "Saldo"], data.map(d => Object.values(d)));
  };

  // Generar el texto del estado de cuenta formateado
  const generateStatementText = () => {
    if (!debtor) return "";

    const totalCharges = debtor.debtor_transactions
      .filter(t => t.type === 'charge')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalPayments = debtor.debtor_transactions
      .filter(t => t.type === 'payment')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    let text = `📄 *ESTADO DE CUENTA - OINKASH*\n\n`;
    text += `Hola *${debtor.name}*, aquí tienes el resumen de tu cuenta:\n`;
    text += `----------------------------------\n`;
    text += `💰 *Deuda Inicial:* $${debtor.initial_balance.toFixed(2)}\n`;
    text += `➕ *Cargos Adicionales:* $${totalCharges.toFixed(2)}\n`;
    text += `➖ *Abonos Realizados:* $${totalPayments.toFixed(2)}\n`;
    text += `📉 *Saldo Pendiente:* $${debtor.current_balance.toFixed(2)}\n`;
    if (debtor.due_date) {
      text += `📅 *Fecha de Vencimiento:* ${format(parseISO(debtor.due_date), "dd 'de' MMMM, yyyy", { locale: es })}\n`;
    }
    text += `----------------------------------\n\n`;

    // Agregar los últimos 5 movimientos
    const lastTxs = [...debtor.debtor_transactions]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    if (lastTxs.length > 0) {
      text += `📝 *Últimos Movimientos:*\n`;
      lastTxs.forEach(tx => {
        const sign = tx.type === "charge" ? "+" : "-";
        text += `• ${format(parseISO(tx.date), "dd/MM")}: ${tx.description} (${sign}$${tx.amount.toFixed(2)})\n`;
      });
      text += `\n----------------------------------\n`;
    }

    text += `¡Gracias por tu puntualidad! 😊`;
    return text;
  };

  const handleCopyStatement = () => {
    const text = generateStatementText();
    navigator.clipboard.writeText(text);
    showSuccess("Estado de cuenta copiado al portapapeles.");
    setIsShareDialogOpen(false);
  };

  const handleSendWhatsAppStatement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharePhone.trim()) {
      showError("Por favor, ingresa un número de teléfono.");
      return;
    }
    const text = generateStatementText();
    const cleanPhone = sharePhone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
    setIsShareDialogOpen(false);
  };

  if (isLoading) return <LoadingSpinner />;
  if (!debtor) return null;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/debtors')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-3xl font-bold">Deudor: {debtor.name}</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-yellow-800">Saldo Pendiente</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-yellow-900">${debtor.current_balance.toFixed(2)}</div></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Deuda Inicial</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">${debtor.initial_balance.toFixed(2)}</div></CardContent></Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Vencimiento</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{debtor.due_date ? format(parseISO(debtor.due_date), "dd/MM/yyyy") : "-"}</div></CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full md:max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar descripción..." className="pl-8 h-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-full sm:w-[140px] h-9">
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
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" className="h-9 gap-1" onClick={() => setIsShareDialogOpen(true)}>
            <Share2 className="h-4 w-4" /> Compartir Estado
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" title="Exportar"><FileDown className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}><FileText className="mr-2 h-4 w-4" /> CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}><FileText className="mr-2 h-4 w-4" /> PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="h-9 gap-1" onClick={handleOpenAdd}><DollarSign className="h-4 w-4" /> Nuevo</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Historial</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-xs">{format(parseISO(tx.date), "dd/MM/yy")}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-xs">{tx.description}</span>
                      <Badge variant="outline" className={cn("w-fit text-[9px] px-1 py-0", tx.type === "charge" ? "text-red-600 border-red-100" : "text-green-600 border-green-100")}>
                        {tx.type === "charge" ? "Cargo" : "Abono"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className={cn("text-right font-bold text-xs", tx.type === "charge" ? "text-red-600" : "text-green-600")}>
                    {tx.type === "charge" ? "+" : "-"}${tx.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-black text-xs">${tx.runningBalance.toFixed(2)}</TableCell>
                  <TableCell className="text-right flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(tx)}><Edit className="h-3.5 w-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle><AlertDialogDescription>Se ajustará el saldo.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>No</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTransaction(tx)}>Sí</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Diálogo de Transacción */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTransaction ? "Editar Movimiento" : "Registrar Movimiento"}</DialogTitle></DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={transactionForm.type} onValueChange={(v: any) => setTransactionForm({...transactionForm, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="payment">Pago (Abono a deuda)</SelectItem><SelectItem value="charge">Cargo (Debo más)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Monto</Label><Input value={transactionForm.amount} onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})} required /></div>
            <div className="grid gap-2"><Label>Descripción</Label><Input value={transactionForm.description} onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} required /></div>
            {transactionForm.type === "payment" && !editingTransaction && (
              <>
                <div className="flex items-center space-x-2 bg-blue-50 p-3 rounded-md border border-blue-100">
                  <Checkbox id="skip" checked={skipLinkedTransaction} onCheckedChange={(v) => setSkipLinkedTransaction(!!v)} />
                  <Label htmlFor="skip" className="text-xs">Ya registré este egreso manualmente</Label>
                </div>
                {!skipLinkedTransaction && (
                  <>
                    <div className="grid gap-2">
                      <Label>Origen del dinero</Label>
                      <Select value={transactionForm.sourceAccountId} onValueChange={(v) => setTransactionForm({...transactionForm, sourceAccountId: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Efectivo (${cashBalance.toFixed(2)})</SelectItem>
                          {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Categoría de gasto</Label>
                      <Select value={transactionForm.selectedExpenseCategoryId} onValueChange={(v) => setTransactionForm({...transactionForm, selectedExpenseCategoryId: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{expenseCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </>
            )}
            <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para Compartir Estado de Cuenta */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" /> Compartir Estado de Cuenta
            </DialogTitle>
            <DialogDescription>
              Envía un resumen detallado de la cuenta por WhatsApp o cópialo para enviarlo por otro medio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="border rounded-lg p-3 bg-muted/50 max-h-[200px] overflow-y-auto text-xs font-mono whitespace-pre-wrap">
              {generateStatementText()}
            </div>
            <form onSubmit={handleSendWhatsAppStatement} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sharePhone">Número de WhatsApp</Label>
                <Input
                  id="sharePhone"
                  placeholder="Ej. 521234567890"
                  value={sharePhone}
                  onChange={(e) => setSharePhone(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full gap-2">
                <MessageSquare className="h-4 w-4" /> Enviar por WhatsApp
              </Button>
            </form>
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-muted"></div>
              <span className="flex-shrink mx-4 text-muted-foreground text-xs">O</span>
              <div className="flex-grow border-t border-muted"></div>
            </div>
            <Button variant="outline" onClick={handleCopyStatement} className="w-full gap-2">
              <Copy className="h-4 w-4" /> Copiar al Portapapeles
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DebtorDetailsPage;