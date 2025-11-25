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
import { PlusCircle, CalendarIcon, Edit, FileText, FileDown } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { useCategoryContext } from "@/context/CategoryContext";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";

interface Transaction {
  id: string;
  type: "ingreso" | "egreso";
  amount: number;
  description: string;
  date: string;
  category_id: string;
  category_type: "income" | "expense";
  user_id?: string;
}

const Cash = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, getCategoryById, isLoadingCategories } = useCategoryContext();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [newTransaction, setNewTransaction] = useState({
    type: "ingreso" as "ingreso" | "egreso",
    amount: "",
    description: "",
    category_id: "",
  });

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
      .order('date', { ascending: false });

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

  useEffect(() => {
    if (user && !isLoadingCategories) {
      fetchTransactions();
    }
  }, [user, isLoadingCategories]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewTransaction((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value: "ingreso" | "egreso") => {
    setNewTransaction((prev) => ({ ...prev, type: value, category_id: "" }));
  };

  const handleCategorySelectChange = (value: string) => {
    setNewTransaction((prev) => ({ ...prev, category_id: value }));
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("Debes iniciar sesión para registrar transacciones.");
      return;
    }

    const amount = parseFloat(newTransaction.amount);
    if (isNaN(amount) || amount <= 0) {
      showError("El monto debe ser un número positivo.");
      return;
    }
    if (!newTransaction.category_id) {
      showError("Por favor, selecciona una categoría.");
      return;
    }

    const categoryType = newTransaction.category_id.startsWith("inc") ? "income" : "expense";

    const { data, error } = await supabase
      .from('cash_transactions')
      .insert({
        user_id: user.id,
        type: newTransaction.type,
        amount,
        description: newTransaction.description,
        category_id: newTransaction.category_id,
        category_type: categoryType,
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
      setNewTransaction({ type: "ingreso", amount: "", description: "", category_id: "" });
      setIsAddDialogOpen(false);
      showSuccess("Transacción registrada exitosamente.");
    }
  };

  const handleOpenEditDialog = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setNewTransaction({
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description,
      category_id: transaction.category_id,
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
    const newAmount = parseFloat(newTransaction.amount);
    const newType = newTransaction.type;

    if (isNaN(newAmount) || newAmount <= 0) {
      showError("El monto debe ser un número positivo.");
      return;
    }
    if (!newTransaction.category_id) {
      showError("Por favor, selecciona una categoría.");
      return;
    }

    const categoryType = newTransaction.category_id.startsWith("inc") ? "income" : "expense";

    const { data, error } = await supabase
      .from('cash_transactions')
      .update({
        type: newType,
        amount: newAmount,
        description: newTransaction.description,
        category_id: newTransaction.category_id,
        category_type: categoryType,
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
      setNewTransaction({ type: "ingreso", amount: "", description: "", category_id: "" });
      showSuccess("Transacción actualizada exitosamente.");
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || tx.type === filterType;
    
    const categoryName = getCategoryById(tx.category_id, tx.category_type)?.name || "";
    const matchesCategory = filterCategory === "all" || tx.category_id === filterCategory || categoryName.toLowerCase().includes(filterCategory.toLowerCase());
    
    const txDate = new Date(tx.date);
    const matchesDate = !dateRange?.from || (txDate >= dateRange.from && (!dateRange.to || txDate <= dateRange.to));

    return matchesSearch && matchesType && matchesCategory && matchesDate;
  });

  const availableCategories = newTransaction.type === "ingreso" ? incomeCategories : expenseCategories;
  const allCategories = [...incomeCategories, ...expenseCategories];

  const handleExport = (formatType: 'csv' | 'pdf') => {
    const dataToExport = filteredTransactions.map(tx => {
      const category = getCategoryById(tx.category_id, tx.category_type);
      return {
        Fecha: format(new Date(tx.date), "dd/MM/yyyy", { locale: es }),
        Tipo: tx.type === "ingreso" ? "Ingreso" : "Egreso",
        Categoria: category?.name || "Desconocida",
        Descripcion: tx.description,
        Monto: `${tx.type === "ingreso" ? "+" : "-"}${tx.amount.toFixed(2)}`,
      };
    });

    const filename = `transacciones_efectivo_${format(new Date(), "yyyyMMdd_HHmmss")}`;
    const title = "Reporte de Transacciones de Efectivo";
    const headers = ["Fecha", "Tipo", "Categoría", "Descripción", "Monto"];
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
      <h1 className="text-3xl font-bold">Gestión de Efectivo</h1>

      <Card>
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
                    <Select value={newTransaction.category_id} onValueChange={handleCategorySelectChange}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Selecciona categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
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
                      type="number"
                      step="0.01"
                      value={newTransaction.amount}
                      onChange={handleInputChange}
                      className="col-span-3"
                      required
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
                  <DialogFooter>
                    <Button type="submit">Guardar Transacción</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
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
                    {cat.name} ({cat.id.startsWith("inc") ? "Ingreso" : "Egreso"})
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
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => {
                  const category = getCategoryById(tx.category_id, tx.category_type);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>{format(new Date(tx.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                      <TableCell className={tx.type === "ingreso" ? "text-green-600" : "text-red-600"}>
                        {tx.type === "ingreso" ? "Ingreso" : "Egreso"}
                      </TableCell>
                      <TableCell>{category?.name || "Desconocida"}</TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell className="text-right">
                        {tx.type === "ingreso" ? "+" : "-"}${tx.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditDialog(tx)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span className="sr-only">Editar</span>
                        </Button>
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
                  <Select value={newTransaction.category_id} onValueChange={handleCategorySelectChange}>
                    <SelectTrigger id="editCategory" className="col-span-3">
                      <SelectValue placeholder="Selecciona categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
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
                    type="number"
                    step="0.01"
                    value={newTransaction.amount}
                    onChange={handleInputChange}
                    className="col-span-3"
                    required
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
                <DialogFooter>
                  <Button type="submit">Actualizar Transacción</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default Cash;