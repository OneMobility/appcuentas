"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PlusCircle, DollarSign, Trash2, Edit, CalendarIcon, FileText, FileDown, PiggyBank, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, isAfter, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import ColorPicker from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FeedbackOverlay from "@/components/FeedbackOverlay";
import RandomSavingTipCard from "@/components/RandomSavingTipCard";
import FixedSavingTipCard from "@/components/FixedSavingTipCard";
import { getLocalDateString } from "@/utils/date-helpers";
import { evaluateExpression } from "@/utils/math-helpers";

const META_PIGGY = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Meta%202.png";

const Savings: React.FC = () => {
  const { user } = useSession();
  const [savings, setSavings] = useState<Saving[]>([]);
  const [isAddSavingDialogOpen, setIsAddSavingDialogOpen] = useState(false);
  const [isEditSavingDialogOpen, setIsEditSavingDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [selectedSavingId, setSelectedSavingId] = useState<string | null>(null);
  const [editingSaving, setEditingSaving] = useState<Saving | null>(null);
  const [newSaving, setNewSaving] = useState({
    name: "",
    initial_balance: "",
    target_amount: "",
    target_date: undefined as Date | undefined,
    color: "#22C55E",
  });
  const [newTransaction, setNewTransaction] = useState({
    type: "deposit" as "deposit" | "withdrawal",
    amount: "",
    description: "",
  });
  const [feedbackOverlay, setFeedbackOverlay] = useState<{
    isVisible: boolean;
    message: string;
    imageSrc: string;
    bgColor: string;
    textColor: string;
  } | null>(null);


  const [searchTerm, setSearchTerm] = useState("");

  const fetchSavings = async () => {
    if (!user) {
      setSavings([]);
      return;
    }

    const { data, error } = await supabase
      .from('savings')
      .select('*, challenge_id') 
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      showError('Error al cargar ahorros: ' + error.message);
    } else {
      setSavings(data || []);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSavings();
    }
  }, [user]);

  const totalSavingsBalance = savings.reduce((sum, saving) => sum + saving.current_balance, 0);

  const handleNewSavingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewSaving((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewSavingDateChange = (date: Date | undefined) => {
    setNewSaving((prev) => ({ ...prev, target_date: date }));
  };

  const handleNewSavingColorSelect = (color: string) => {
    setNewSaving((prev) => ({ ...prev, color }));
  };

  const handleSubmitNewSaving = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("Debes iniciar sesión para añadir cuentas de ahorro.");
      return;
    }

    let initialBalance: number;
    if (newSaving.initial_balance.startsWith('=')) {
      const expression = newSaving.initial_balance.substring(1);
      const result = evaluateExpression(expression);
      if (result !== null) {
        initialBalance = parseFloat(result.toFixed(2));
      } else {
        showError("Expresión matemática inválida para el saldo inicial.");
        return;
      }
    } else {
      initialBalance = parseFloat(newSaving.initial_balance);
    }

    if (isNaN(initialBalance) || initialBalance < 0) {
      showError("El saldo inicial debe ser un número positivo o cero.");
      return;
    }
    if (!newSaving.name.trim()) {
      showError("El nombre de la cuenta de ahorro no puede estar vacío.");
      return;
    }

    let targetAmount: number | undefined = undefined;
    if (newSaving.target_amount) {
      if (newSaving.target_amount.startsWith('=')) {
        const expression = newSaving.target_amount.substring(1);
        const result = evaluateExpression(expression);
        if (result !== null) {
          targetAmount = parseFloat(result.toFixed(2));
        } else {
          showError("Expresión matemática inválida para el monto objetivo.");
          return;
        }
      } else {
        targetAmount = parseFloat(newSaving.target_amount);
      }

      if (isNaN(targetAmount) || targetAmount <= 0) {
        showError("El monto objetivo debe ser un número positivo.");
        return;
      }
    }

    const { data, error } = await supabase
      .from('savings')
      .insert({
        user_id: user.id,
        name: newSaving.name.trim(),
        current_balance: initialBalance,
        target_amount: targetAmount,
        target_date: newSaving.target_date ? getLocalDateString(newSaving.target_date) : null,
        color: newSaving.color,
        completion_date: null,
      })
      .select();

    if (error) {
      showError('Error al registrar cuenta de ahorro: ' + error.message);
    } else {
      setSavings((prev) => [...prev, data[0]]);
      setNewSaving({ name: "", initial_balance: "", target_amount: "", target_date: undefined, color: "#22C55E" });
      setIsAddSavingDialogOpen(false);
      showSuccess("Cuenta de ahorro registrada exitosamente.");
      setFeedbackOverlay({
        isVisible: true,
        message: "¡Muy bien! ¡Cumpliremos esa meta!",
        imageSrc: "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/cochinito%20amor.png",
        bgColor: "bg-pink-100",
        textColor: "text-pink-800",
      });
    }
  };

  const handleDeleteSaving = async (savingId: string) => {
    if (!user) {
      showError("Debes iniciar sesión para eliminar cuentas de ahorro.");
      return;
    }

    const { error } = await supabase
      .from('savings')
      .delete()
      .eq('id', savingId)
      .eq('user_id', user.id);

    if (error) {
      showError('Error al eliminar cuenta de ahorro: ' + error.message);
    } else {
      setSavings((prev) => prev.filter((saving) => saving.id !== savingId));
      showSuccess("Cuenta de ahorro eliminada exitosamente.");
    }
  };

  const handleOpenEditSavingDialog = (saving: Saving) => {
    setEditingSaving(saving);
    setNewSaving({
      name: saving.name,
      initial_balance: saving.current_balance.toString(),
      target_amount: saving.target_amount?.toString() || "",
      target_date: saving.target_date ? parseISO(saving.target_date) : undefined,
      color: saving.color,
    });
    setIsEditSavingDialogOpen(true);
  };

  const handleUpdateSaving = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingSaving) {
      showError("Debes iniciar sesión para actualizar la cuenta de ahorro.");
      return;
    }

    if (!newSaving.name.trim()) {
      showError("El nombre de la cuenta de ahorro no puede estar vacío.");
      return;
    }

    let targetAmount: number | undefined = undefined;
    if (newSaving.target_amount) {
      if (newSaving.target_amount.startsWith('=')) {
        const expression = newSaving.target_amount.substring(1);
        const result = evaluateExpression(expression);
        if (result !== null) {
          targetAmount = parseFloat(result.toFixed(2));
        } else {
          showError("Expresión matemática inválida para el monto objetivo.");
          return;
        }
      } else {
        targetAmount = parseFloat(newSaving.target_amount);
      }

      if (isNaN(targetAmount) || targetAmount <= 0) {
        showError("El monto objetivo debe ser un número positivo.");
        return;
      }
    }

    const { data, error } = await supabase
      .from('savings')
      .update({ 
        name: newSaving.name.trim(),
        target_amount: targetAmount,
        target_date: newSaving.target_date ? getLocalDateString(newSaving.target_date) : null,
        color: newSaving.color,
      })
      .eq('id', editingSaving.id)
      .eq('user_id', user.id)
      .select();

    if (error) {
      showError('Error al actualizar cuenta de ahorro: ' + error.message);
    } else {
      const updatedSaving = data[0];
      
      setSavings((prev) =>
        prev.map((saving) => (saving.id === editingSaving.id ? updatedSaving : saving))
      );
      setEditingSaving(null);
      setNewSaving({ name: "", initial_balance: "", target_amount: "", target_date: undefined, color: "#22C55E" });
      setIsEditSavingDialogOpen(false);
      showSuccess("Cuenta de ahorro actualizada exitosamente.");

      if (updatedSaving.target_amount && updatedSaving.current_balance >= updatedSaving.target_amount && !updatedSaving.completion_date) {
        const todayFormatted = getLocalDateString(new Date());
        const { data: updatedSavingWithCompletionDate, error: dateUpdateError } = await supabase
          .from('savings')
          .update({ completion_date: todayFormatted })
          .eq('id', updatedSaving.id)
          .eq('user_id', user.id)
          .select()
          .single();
        if (dateUpdateError) {
          console.error("Error updating saving completion_date:", dateUpdateError.message);
          showError("Error al actualizar la fecha de cumplimiento del ahorro.");
        } else {
          setSavings((prev) =>
            prev.map((saving) => (saving.id === updatedSaving.id ? updatedSavingWithCompletionDate : saving))
          );
          setFeedbackOverlay({
            isVisible: true,
            message: "¡Lo has logrado! ¡Felicidades por alcanzar tu meta!",
            imageSrc: "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Meta%202.png",
            bgColor: "bg-green-100",
            textColor: "text-green-800",
          });
        }
      }
    }
  };

  const handleOpenTransactionDialog = (savingId: string) => {
    setSelectedSavingId(savingId);
    setNewTransaction({ type: "deposit", amount: "", description: "" });
    setIsTransactionDialogOpen(true);
  };

  const handleTransactionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewTransaction((prev) => ({ ...prev, [name]: value }));
  };

  const handleTransactionTypeChange = (value: "deposit" | "withdrawal") => {
    setNewTransaction((prev) => ({ ...prev, type: value }));
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedSavingId) {
      showError("Debes iniciar sesión o la cuenta de ahorro no está seleccionada.");
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
      showError("El monto de la transacción debe ser un número positivo.");
      return;
    }

    const currentSaving = savings.find(s => s.id === selectedSavingId);
    if (!currentSaving) {
      showError("Cuenta de ahorro no encontrada.");
      return;
    }

    let newBalance = currentSaving.current_balance;
    const transactionType = newTransaction.type;

    if (transactionType === "deposit") {
      newBalance += amount;
    } else {
      if (newBalance < amount) {
        showError("Saldo insuficiente en la cuenta de ahorro para este retiro.");
        return;
      }
      newBalance -= amount;
    }

    let updatedCompletionDate = currentSaving.completion_date;
    const todayFormatted = getLocalDateString(new Date());

    if (currentSaving.target_amount && newBalance >= currentSaving.target_amount && !currentSaving.completion_date) {
      updatedCompletionDate = todayFormatted;
    } else if (currentSaving.target_amount && newBalance < currentSaving.target_amount && currentSaving.completion_date) {
      updatedCompletionDate = null;
    }


    const { data, error } = await supabase
      .from('savings')
      .update({ 
        current_balance: newBalance,
        completion_date: updatedCompletionDate,
      })
      .eq('id', selectedSavingId)
      .eq('user_id', user.id)
      .select();

    if (error) {
      showError('Error al registrar transacción: ' + error.message);
    } else {
      let updatedSaving = data[0];
      
      setSavings((prev) =>
        prev.map((saving) => (saving.id === selectedSavingId ? updatedSaving : saving))
      );
      setNewTransaction({ type: "deposit", amount: "", description: "" });
      setSelectedSavingId(null);
      setIsTransactionDialogOpen(false);
      showSuccess("Transacción registrada exitosamente.");

      if (transactionType === "deposit") {
        setFeedbackOverlay({
          isVisible: true,
          message: "¡Felicidades! ¡Un paso más cerca de tus metas!",
          imageSrc: "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro.png",
          bgColor: "bg-pink-100",
          textColor: "text-pink-800",
        });
        if (updatedSaving.target_amount && updatedSaving.current_balance >= updatedSaving.target_amount) {
          setFeedbackOverlay({
            isVisible: true,
            message: "¡Lo has logrado! ¡Felicidades por alcanzar tu meta!",
            imageSrc: "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Meta%202.png",
            bgColor: "bg-green-100",
            textColor: "text-green-800",
          });
        }
      } else {
        setFeedbackOverlay({
          isVisible: true,
          message: "Pensé que éramos amigos... ¡No te rindas!",
          imageSrc: "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro%20Triste.png",
          bgColor: "bg-blue-100",
          textColor: "text-blue-800",
        });
      }
    }
  };

  const handleFeedbackClose = () => {
    setFeedbackOverlay(null);
  };

  const filteredSavings = savings.filter((saving) =>
    saving.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = (formatType: 'csv' | 'pdf') => {
    const dataToExport = filteredSavings.map(saving => ({
      Nombre: saving.name,
      "Saldo Actual": saving.current_balance.toFixed(2),
      "Monto Objetivo": saving.target_amount?.toFixed(2) || "N/A",
      "Fecha Objetivo": saving.target_date ? format(parseISO(saving.target_date), "dd/MM/yyyy", { locale: es }) : "N/A",
      "Fecha Cumplimiento": saving.completion_date ? format(parseISO(saving.completion_date), "dd/MM/yyyy", { locale: es }) : "N/A",
      "Progreso (%)": saving.target_amount ? ((saving.current_balance / saving.target_amount) * 100).toFixed(2) : "N/A",
    }));

    const filename = `ahorros_${format(new Date(), "yyyyMMdd_HHmmss")}`;
    const title = "Reporte de Cuentas de Ahorro";
    const headers = ["Nombre", "Saldo Actual", "Monto Objetivo", "Fecha Objetivo", "Fecha Cumplimiento", "Progreso (%)"];
    const pdfData = dataToExport.map(row => Object.values(row));

    if (formatType === 'csv') {
      exportToCsv(`${filename}.csv`, dataToExport);
      showSuccess("Cuentas de ahorro exportadas a CSV.");
    } else {
      exportToPdf(`${filename}.pdf`, title, headers, pdfData);
      showSuccess("Cuentas de ahorro exportadas a PDF.");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <header className="relative">
        <div className="absolute inset-0 bg-yellow-100/50 blur-3xl rounded-full -z-10" />
        <Card className="bg-yellow-600 text-white rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
          <div className="p-8 space-y-4 relative">
            <div className="absolute top-0 right-0 p-4 opacity-30">
              <img src={META_PIGGY} alt="Metas" className="h-32 w-32 object-contain rotate-6" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-100">Tus Metas de Ahorro 🐷</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tighter">
                ${totalSavingsBalance.toLocaleString()}
              </span>
              <span className="text-xl font-bold opacity-60">MXN</span>
            </div>
            <p className="text-xs font-medium text-yellow-50/80">¡Pequeños pasos construyen grandes imperios!</p>
          </div>
        </Card>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <RandomSavingTipCard />
        <FixedSavingTipCard />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mis Cuentas de Ahorro</CardTitle>
        <div className="flex gap-2">
            <Dialog open={isAddSavingDialogOpen} onOpenChange={setIsAddSavingDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Añadir Ahorro
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Añadir Nueva Cuenta de Ahorro</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmitNewSaving} className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Nombre
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={newSaving.name}
                      onChange={handleNewSavingChange}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="initial_balance" className="text-right">
                      Saldo Inicial
                    </Label>
                    <Input
                      id="initial_balance"
                      name="initial_balance"
                      type="text"
                      step="0.01"
                      value={newSaving.initial_balance}
                      onChange={handleNewSavingChange}
                      className="col-span-3"
                      required
                      placeholder="Ej. 100 o =50+20*2"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="target_amount" className="text-right">
                      Monto Objetivo (Opcional)
                    </Label>
                    <Input
                      id="target_amount"
                      name="target_amount"
                      type="text"
                      step="0.01"
                      value={newSaving.target_amount}
                      onChange={handleNewSavingChange}
                      className="col-span-3"
                      placeholder="Ej. 1000 o =500*2"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="target_date" className="text-right">
                      Fecha Objetivo (Opcional)
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "col-span-3 justify-start text-left font-normal",
                            !newSaving.target_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newSaving.target_date ? format(newSaving.target_date, "dd/MM/yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newSaving.target_date}
                          onSelect={handleNewSavingDateChange}
                          initialFocus
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="savingColor" className="text-right">
                      Color de Cuenta
                    </Label>
                    <div className="col-span-3">
                      <ColorPicker selectedColor={newSaving.color} onSelectColor={handleNewSavingColorSelect} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Guardar Ahorro</Button>
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
          <div className="mb-4">
            <Input
              placeholder="Buscar cuenta de ahorro por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Saldo Actual</TableHead>
                  <TableHead>Monto Objetivo</TableHead>
                  <TableHead>Fecha Objetivo</TableHead>
                  <TableHead>Fecha Cumplimiento</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSavings.map((saving) => {
                  const progress = saving.target_amount ? (saving.current_balance / saving.target_amount) * 100 : 0;
                  const isLinkedToActiveChallenge = false; 

                  return (
                    <TableRow key={saving.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: saving.color }} />
                          <span>{saving.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>${saving.current_balance.toFixed(2)}</TableCell>
                      <TableCell>${saving.target_amount?.toFixed(2) || "N/A"}</TableCell>
                      <TableCell>{saving.target_date ? format(parseISO(saving.target_date), "dd/MM/yyyy", { locale: es }) : "N/A"}</TableCell>
                      <TableCell>{saving.completion_date ? format(parseISO(saving.completion_date), "dd/MM/yyyy", { locale: es }) : "N/A"}</TableCell>
                      <TableCell>
                        {saving.target_amount ? (
                          <div className="flex items-center gap-2">
                            <Progress value={progress} className="w-[100px]" style={{ backgroundColor: saving.color }} />
                            <span className="text-sm">{progress.toFixed(0)}%</span>
                          </div>
                        ) : "N/A"}
                      </TableCell>
                      <TableCell className="text-right flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenTransactionDialog(saving.id)}
                          className="h-8 gap-1"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                          Transacción
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditSavingDialog(saving)}
                          className="h-8 w-8 p-0"
                          disabled={isLinkedToActiveChallenge}
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
                              disabled={isLinkedToActiveChallenge}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Esto eliminará permanentemente la cuenta de ahorro 
                                **{saving.name}** y todos sus registros.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteSaving(saving.id)} disabled={isLinkedToActiveChallenge}>
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

          <Dialog open={isEditSavingDialogOpen} onOpenChange={setIsEditSavingDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Editar Cuenta de Ahorro: {editingSaving?.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateSaving} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editName" className="text-right">
                    Nombre
                  </Label>
                  <Input
                    id="editName"
                    name="name"
                    value={newSaving.name}
                    onChange={handleNewSavingChange}
                    className="col-span-3"
                    required
                    disabled={!!editingSaving?.challenge_id}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editTargetAmount" className="text-right">
                    Monto Objetivo (Opcional)
                  </Label>
                  <Input
                    id="editTargetAmount"
                    name="target_amount"
                    type="text"
                    step="0.01"
                    value={newSaving.target_amount}
                    onChange={handleNewSavingChange}
                    className="col-span-3"
                    placeholder="Ej. 1000 o =500*2"
                    disabled={!!editingSaving?.challenge_id}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editTargetDate" className="text-right">
                    Fecha Objetivo (Opcional)
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "col-span-3 justify-start text-left font-normal",
                          !newSaving.target_date && "text-muted-foreground"
                        )}
                        disabled={!!editingSaving?.challenge_id}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newSaving.target_date ? format(newSaving.target_date, "dd/MM/yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newSaving.target_date}
                        onSelect={handleNewSavingDateChange}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editSavingColor" className="text-right">
                    Color de Cuenta
                  </Label>
                  <div className="col-span-3">
                    <ColorPicker selectedColor={newSaving.color} onSelectColor={handleNewSavingColorSelect} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={!!editingSaving?.challenge_id}>Actualizar Ahorro</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Registrar Transacción para {savings.find(s => s.id === selectedSavingId)?.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitTransaction} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="transactionType" className="text-right">
                    Tipo
                  </Label>
                  <Select value={newTransaction.type} onValueChange={handleTransactionTypeChange}>
                    <SelectTrigger id="transactionType" className="col-span-3">
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit">Depósito</SelectItem>
                      <SelectItem value="withdrawal">Retiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="transactionAmount" className="text-right">
                    Monto
                  </Label>
                  <Input
                    id="transactionAmount"
                    name="amount"
                    type="text"
                    step="0.01"
                    value={newTransaction.amount}
                    onChange={handleTransactionInputChange}
                    className="col-span-3"
                    required
                    placeholder="Ej. 100 o =50+20*2"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Registrar Transacción</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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

export default Savings;