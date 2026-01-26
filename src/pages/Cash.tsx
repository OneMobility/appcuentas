"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PlusCircle, CalendarIcon, Edit, FileText, FileDown, Trash2, ArrowRightLeft, Scale, Image as ImageIcon } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { useCategoryContext } from "@/context/CategoryContext";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { getLocalDateString } from "@/utils/date-helpers";
import CardTransferDialog from "@/components/CardTransferDialog";
import { evaluateExpression } from "@/utils/math-helpers";
import CashReconciliationDialog from "@/components/CashReconciliationDialog";
import FeedbackOverlay from "@/components/FeedbackOverlay";
import ImageUpload from "@/components/ImageUpload"; // Importar ImageUpload

interface Transaction {
  id: string;
  type: "ingreso" | "egreso";
  amount: number;
  description: string;
  date: string;
  created_at: string; // Add created_at
  income_category_id?: string | null;
  expense_category_id?: string | null;
  user_id?: string;
  image_url?: string | null; // Nuevo campo
}

interface CardData {
  id: string;
  name: string;
  bank_name: string;
  last_four_digits: string;
  type: "credit" | "debit";
  current_balance: number;
  credit_limit?: number;
}

const Cash = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, getCategoryById, isLoadingCategories } = useCategoryContext();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<CardData[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isReconciliationDialogOpen, setIsReconciliationDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [newTransaction, setNewTransaction] = useState({
    type: "ingreso" as "ingreso" | "egreso",
    amount: "",
    description: "",
    date: new Date() as Date | undefined,
    selectedCategoryId: "",
    selectedCategoryType: "" as "income" | "expense" | "",
    imageUrl: null as string | null, // Nuevo estado para la URL de la imagen
  });
  const [feedbackOverlay, setFeedbackOverlay] = useState<{
    isVisible: boolean;
    message: string;
    imageSrc: string;
    bgColor: string;
    textColor: string;
  } | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "ingreso" | "egreso">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const fetchTransactions = async () => {
    if (!user) {
      setTransactions([]);
      setBalance(0);
      return;
    }

    const { data, error } = await supabase
      .from('cash_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      showError('Error al cargar transacciones: ' + error.message);
    } else {
      const fetchedTransactions: Transaction[] = data || [];
      setTransactions(fetchedTransactions);
      const currentBalance = fetchedTransactions.reduce((sum, tx) => {
        return tx.type === "ingreso" ? sum + tx.amount : sum - tx.amount;
      }, 0);
      setBalance(currentBalance);
    }
  };

  const fetchCards = async () => {
    if (!user) {
      setCards([]);
      return;
    }
    const { data, error } = await supabase
      .from('cards')
      .select('id, name, bank_name, last_four_digits, type, current_balance, credit_limit')
      .eq('user_id', user.id);

    if (error) {
      showError('Error al cargar tarjetas: ' + error.message);
    } else {
      setCards(data || []);
    }
  };

  useEffect(() => {
    if (user && !isLoadingCategories) {
      fetchTransactions();
      fetchCards();
    }
  }, [user, isLoadingCategories]);

  const handleTransferSuccess = () => {
    fetchTransactions();
    fetchCards();
  };

  const handleReconciliationSuccess = () => {
    fetchTransactions();
    setFeedbackOverlay({
      isVisible: true,
      message: "¡Saldo ajustado exitosamente!",
      imageSrc: "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro.png",
      bgColor: "bg-green-100",
      textColor: "text-green-800",
    });
  };

  const handleNoAdjustmentSuccess = () => {
    setFeedbackOverlay({
      isVisible: true,
      message: "¡El saldo en efectivo ya está cuadrado!",
      imageSrc: "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Conchinito%20feliz.png",
      bgColor: "bg-green-100",
      textColor: "text-green-800",
    });
  };

  const handleFeedbackClose = () => {
    setFeedbackOverlay(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewTransaction((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date: Date | undefined) => {
    setNewTransaction((prev) => ({ ...prev, date: date }));
  };

  const handleSelectChange = (value: "ingreso" | "egreso") => {
    setNewTransaction((prev) => ({ ...prev, type: value, selectedCategoryId: "", selectedCategoryType: "" }));
  };

  const handleCategorySelectChange = (value: string) => {
    const category = [...incomeCategories, ...expenseCategories].find(cat => cat.id === value);
    if (category) {
      setNewTransaction((prev) => ({
        ...prev,
        selectedCategoryId: value,
        selectedCategoryType: incomeCategories.some(c => c.id === value) ? "income" : "expense",
      }));
    } else {
      setNewTransaction((prev) => ({ ...prev, selectedCategoryId: value, selectedCategoryType: "" }));
    }
  };

  const handleImageUploadSuccess = (url: string) => {
    setNewTransaction((prev) => ({ ...prev, imageUrl: url }));
  };

  const handleImageRemove = () => {
    setNewTransaction((prev) => ({ ...prev, imageUrl: null }));
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("Debes iniciar sesión para registrar transacciones.");
      return;
    }

    let amount: number;
    if (newTransaction.amount.startsWith('=')) {
      const expression = newTransaction.amount.substring(1);
      const result = evaluateExpression(expression);
      if (result !== null) {
        amount = parseFloat(result.toFixed(2));
      } else {
        showError("Expresión matemática inválida para el monto.");
        return;
      }
    } else {
      amount = parseFloat(newTransaction.amount);
    }

    if (isNaN(amount) || amount <= 0) {
      showError("El monto debe ser un número positivo.");
      return;
    }
    if (!newTransaction.selectedCategoryId) {
      showError("Por favor, selecciona una categoría.");
      return;
    }
    if (!newTransaction.date) {
      showError("Por favor, selecciona una fecha para la transacción.");
      return;
    }

    let incomeCategoryIdToInsert: string | null = null;
    let expenseCategoryIdToInsert: string | null = null;

    if (newTransaction.selectedCategoryType === "income") {
      incomeCategoryIdToInsert = newTransaction.selectedCategoryId;
    } else if (newTransaction.selectedCategoryType === "expense") {
      expenseCategoryIdToInsert = newTransaction.selectedCategoryId;
    } else {
      showError("Tipo de categoría no válido.");
      return;
    }

    const { data, error } = await supabase
      .from('cash_transactions')
      .insert({
        user_id: user.id,
        type: newTransaction.type,
        amount,
        description: newTransaction.description,
        income_category_id: incomeCategoryIdToInsert,
        expense_category_id: expenseCategoryIdToInsert,
        date: getLocalDateString(newTransaction.date),
        image_url: newTransaction.imageUrl, // Incluir URL de la imagen
      })
      .select();

    if (error) {
      showError('Error al registrar transacción: ' + error.message);
    } else {
      const newTx = data[0];
      setTransactions((prev) => [newTx, ...prev]);
      setBalance((prev) =>
        newTx.type === "ingreso" ? prev + newTx.amount : prev - newTx.amount
      );
      setNewTransaction({ type: "ingreso", amount: "", description: "", date: new Date(), selectedCategoryId: "", selectedCategoryType: "", imageUrl: null });
      setIsAddDialogOpen(false);
      showSuccess("Transacción registrada exitosamente.");
    }
  };

  const handleOpenEditDialog = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    const categoryId = transaction.income_category_id || transaction.expense_category_id || "";
    const categoryType = transaction.income_category_id ? "income" : (transaction.expense_category_id ? "expense" : "");

    setNewTransaction({
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description,
      date: parseISO(transaction.date),
      selectedCategoryId: categoryId,
      selectedCategoryType: categoryType as "income" | "expense" | "",
      imageUrl: transaction.image_url || null, // Cargar URL de la imagen existente
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingTransaction) {
      showError("Debes iniciar sesión para actualizar transacciones.");
      return;
    }

    const oldAmount = editingTransaction.amount;
    const oldType = editingTransaction.type;
    
    let newAmount: number;
    if (newTransaction.amount.startsWith('=')) {
      const expression = newTransaction.amount.substring(1);
      const result = evaluateExpression(expression);
      if (result !== null) {
        newAmount = parseFloat(result.toFixed(2));
      } else {
        showError("Expresión matemática inválida para el monto.");
        return;
      }
    } else {
      newAmount = parseFloat(newTransaction.amount);
    }

    const newType = newTransaction.type;

    if (isNaN(newAmount) || newAmount <= 0) {
      showError("El monto debe ser un número positivo.");
      return;
    }
    if (!newTransaction.selectedCategoryId) {
      showError("Por favor, selecciona una categoría.");
      return;
    }
    if (!newTransaction.date) {
      showError("Por favor, selecciona una fecha para la transacción.");
      return;
    }

    let incomeCategoryIdToUpdate: string | null = null;
    let expenseCategoryIdToUpdate: string | null = null;

    if (newTransaction.selectedCategoryId) {
      if (newTransaction.selectedCategoryType === "income") {
        incomeCategoryIdToUpdate = newTransaction.selectedCategoryId;
      } else if (newTransaction.selectedCategoryType === "expense") {
        expenseCategoryIdToUpdate = newTransaction.selectedCategoryId;
      } else {
        showError("Tipo de categoría no válido.");
        return;
      }
    }

    const { data, error } = await supabase
      .from('cash_transactions')
      .update({
        type: newType,
        amount: newAmount,
        description: newTransaction.description,
        income_category_id: incomeCategoryIdToUpdate,
        expense_category_id: expenseCategoryIdToUpdate,
        date: getLocalDateString(newTransaction.date),
        image_url: newTransaction.imageUrl, // Actualizar URL de la imagen
      })
      .eq('id', editingTransaction.id)
      .eq('user_id', user.id)
      .select();

    if (error) {
      showError('Error al actualizar transacción: ' + error.message);
    } else {
      const updatedTx = data[0];
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === updatedTx.id ? updatedTx : tx))
      );

      setBalance((prev) => {
        let tempBalance = prev;
        tempBalance = oldType === "ingreso" ? tempBalance - oldAmount : tempBalance + oldAmount;
        tempBalance = newType === "ingreso" ? tempBalance + newAmount : tempBalance - newAmount;
        return tempBalance;
      });

      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      setNewTransaction({ type: "ingreso", amount: "", description: "", date: new Date(), selectedCategoryId: "", selectedCategoryType: "", imageUrl: null });
      showSuccess("Transacción actualizada exitosamente.");
    }
  };

  const handleDeleteTransaction = async (transactionId: string, transactionAmount: number, transactionType: "ingreso" | "egreso") => {
    if (!user) {
      showError("Debes iniciar sesión para eliminar transacciones.");
      return;
    }

    const { error } = await supabase
      .from('cash_transactions')
      .delete()
      .eq('id', transactionId)
      .eq('user_id', user.id);

    if (error) {
      showError('Error al eliminar transacción: ' + error.message);
    } else {
      setTransactions((prev) => prev.filter((tx) => tx.id !== transactionId));
      setBalance((prev) =>
        transactionType === "ingreso" ? prev - transactionAmount : prev + transactionAmount
      );
      showSuccess("Transacción eliminada exitosamente.");
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || tx.type === filterType;
    
    const categoryId = tx.income_category_id || tx.expense_category_id;
    const category = getCategoryById(categoryId);
    const categoryName = category?.name || "";
    const matchesCategory = filterCategory === "all" || categoryId === filterCategory || categoryName.toLowerCase().includes(filterCategory.toLowerCase());
    
    const txDate = parseISO(tx.date);
    const matchesDate = !dateRange?.from || (txDate >= dateRange.from && (!dateRange.to || txDate <= dateRange.to));

    return matchesSearch && matchesType && matchesCategory && matchesDate;
  });

  const availableCategories = newTransaction.type === "ingreso" ? incomeCategories : expenseCategories;
  const allCategories = [...incomeCategories, ...expenseCategories];

  const handleExport = (formatType: 'csv' | 'pdf') => {
    const dataToExport = filteredTransactions.map(tx => {
      const category = getCategoryById(tx.income_category_id || tx.expense_category_id);
      return {
        Fecha: format(parseISO(tx.date), "dd/MM/yyyy", { locale: es }),
        Tipo: tx.type === "ingreso" ? "Ingreso" : "Egreso",
        Categoria: category?.name || "Desconocida",
        Descripcion: tx.description,
        Monto: `${tx.type === "ingreso" ? "+" : "-"}${tx.amount.toFixed(2)}`,
        "URL Imagen": tx.image_url || "N/A",
      };
    });

    const filename = `transacciones_efectivo_${format(new Date(), "yyyyMMdd_HHmmss")}`;
    const title = "Reporte de Transacciones de Efectivo";
    const headers = ["Fecha", "Tipo", "Categoría", "Descripción", "Monto", "URL Imagen"];
    const pdfData = dataToExport.map(row => Object.values(row));

    if (formatType === 'csv') {
      exportToCsv(`${filename}.csv`, dataToExport);
      showSuccess("Transacciones exportadas a CSV.");
    } else {
      exportToPdf(`${filename}.pdf`, title, headers, pdfData);
      showSuccess("Transacciones exportadas a PDF.");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Lo que tienes</h1>

      <Card className="border-l-4 border-primary bg-primary/10 text-primary-foreground">
        <CardHeader>
          <CardTitle>Saldo Actual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">${balance.toFixed(2)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Transacciones Recientes</CardTitle>
          <div className="flex gap-2">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Nueva Transacción
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Registrar Transacción</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmitTransaction} className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="type" className="text-right">
                      Tipo
                    </Label>
                    <Select value={newTransaction.type} onValueChange={handleSelectChange}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Selecciona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ingreso">Ingreso</SelectItem>
                        <SelectItem value="egreso">Egreso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="category_id" className="text-right">
                      Categoría
                    </Label>
                    <Select value={newTransaction.selectedCategoryId} onValueChange={handleCategorySelectChange}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Selecciona categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map((cat) => (
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
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="amount" className="text-right">
                      Monto
                    </Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="text" // Cambiado a text para permitir '='
                      value={newTransaction.amount}
                      onChange={handleInputChange}
                      className="col-span-3"
                      required
                      placeholder="Ej. 100 o =50+20*2"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">
                      Descripción
                    </Label>
                    <Input
                      id="description"
                      name="description"
                      value={newTransaction.description}
                      onChange={handleInputChange}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="transactionDate" className="text-right">
                      Fecha
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "col-span-3 justify-start text-left font-normal",
                            !newTransaction.date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newTransaction.date ? format(newTransaction.date, "dd/MM/yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newTransaction.date}
                          onSelect={handleDateChange}
                          initialFocus
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="col-span-4">
                    <Label className="text-left mb-2 block">Adjuntar Ticket (Opcional)</Label>
                    <ImageUpload
                      onUploadSuccess={handleImageUploadSuccess}
                      onRemove={handleImageRemove}
                      folder="cash_tickets"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Guardar Transacción</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button size="sm" className="h-8 gap-1" onClick={() => setIsTransferDialogOpen(true)}>
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Transferir
              </span>
            </Button>
            <Button size="sm" className="h-8 gap-1" onClick={() => setIsReconciliationDialogOpen(true)}>
              <Scale className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Cuadre
              </span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <FileDown className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Exportar
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  <FileText className="mr-2 h-4 w-4" /> Exportar a CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>
                  <FileText className="mr-2 h-4 w-4" /> Exportar a PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <Input
              placeholder="Buscar por descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={filterType} onValueChange={(value: "all" | "ingreso" | "egreso") => setFilterType(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ingreso">Ingreso</SelectItem>
                <SelectItem value="egreso">Egreso</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={(value: string) => setFilterCategory(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Categorías</SelectItem>
                {allCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-4 w-4" />
                      {cat.name} ({cat.is_fixed ? "Fija" : "Personal"})
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[300px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yyyy", { locale: es })} -{" "}
                        {format(dateRange.to, "dd/MM/yyyy", { locale: es })}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy", { locale: es })
                    )
                  ) : (
                    <span>Filtrar por fecha</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Ticket</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => {
                  const category = getCategoryById(tx.income_category_id || tx.expense_category_id);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>{format(parseISO(tx.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                      <TableCell className={tx.type === "ingreso" ? "text-green-600" : "text-red-600"}>
                        {tx.type === "ingreso" ? "Ingreso" : "Egreso"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DynamicLucideIcon iconName={category?.icon || "Tag"} className="h-4 w-4" />
                          {category?.name || "Desconocida"}
                        </div>
                      </TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell className="text-right">
                        {tx.type === "ingreso" ? "+" : "-"}${tx.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {tx.image_url ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 w-7 p-0"
                            onClick={() => window.open(tx.image_url!, '_blank')}
                          >
                            <ImageIcon className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditDialog(tx)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Eliminar</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Esto eliminará permanentemente la transacción de {tx.type} por ${tx.amount.toFixed(2)}: "{tx.description}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteTransaction(tx.id, tx.amount, tx.type)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Editar Transacción</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateTransaction} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editType" className="text-right">
                    Tipo
                  </Label>
                  <Select value={newTransaction.type} onValueChange={handleSelectChange}>
                    <SelectTrigger id="editType" className="col-span-3">
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingreso">Ingreso</SelectItem>
                      <SelectItem value="egreso">Egreso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editCategory" className="text-right">
                    Categoría
                  </Label>
                  <Select value={newTransaction.selectedCategoryId} onValueChange={handleCategorySelectChange}>
                    <SelectTrigger id="editCategory" className="col-span-3">
                      <SelectValue placeholder="Selecciona categoría" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableCategories.map((cat) => (
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
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editAmount" className="text-right">
                    Monto
                  </Label>
                  <Input
                    id="editAmount"
                    name="amount"
                    type="text" // Cambiado a text para permitir '='
                    value={newTransaction.amount}
                    onChange={handleInputChange}
                    className="col-span-3"
                    required
                    placeholder="Ej. 100 o =50+20*2"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editDescription" className="text-right">
                    Descripción
                  </Label>
                  <Input
                    id="editDescription"
                    name="description"
                    value={newTransaction.description}
                    onChange={handleInputChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editTransactionDate" className="text-right">
                    Fecha
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "col-span-3 justify-start text-left font-normal",
                          !newTransaction.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newTransaction.date ? format(newTransaction.date, "dd/MM/yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newTransaction.date}
                        onSelect={handleDateChange}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="col-span-4">
                    <Label className="text-left mb-2 block">Adjuntar Ticket (Opcional)</Label>
                    <ImageUpload
                      onUploadSuccess={handleImageUploadSuccess}
                      initialUrl={editingTransaction?.image_url || null}
                      onRemove={handleImageRemove}
                      folder="cash_tickets"
                    />
                  </div>
                <DialogFooter>
                  <Button type="submit">Actualizar Transacción</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <CardTransferDialog
            isOpen={isTransferDialogOpen}
            onClose={() => setIsTransferDialogOpen(false)}
            cards={cards}
            cashBalance={balance}
            onTransferSuccess={handleTransferSuccess}
          />
          <CashReconciliationDialog
            isOpen={isReconciliationDialogOpen}
            onClose={() => setIsReconciliationDialogOpen(false)}
            appBalance={balance}
            transactionCount={transactions.length}
            onReconciliationSuccess={handleReconciliationSuccess}
            onNoAdjustmentSuccess={handleNoAdjustmentSuccess}
          />
        </CardContent>
      </Card>
      {feedbackOverlay?.isVisible && (
        <FeedbackOverlay
          message={feedbackOverlay.message}
          imageSrc={feedbackOverlay.imageSrc}
          bgColor={feedbackOverlay.bgColor}
          textColor={feedbackOverlay.textColor}
          onClose={handleFeedbackClose}
        />
      )}
    </div>
  );
};

export default Cash;