"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PlusCircle, Trash2, Edit, CalendarIcon, FileText, FileDown, Trophy, CheckCircle, XCircle, Clock } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, isAfter, isBefore, isSameDay, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToCsv, exportToPdf } from "@/utils/export";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RandomChallengeBanner from "@/components/RandomChallengeBanner";
import { getLocalDateString } from "@/utils/date-helpers";

interface Challenge {
  id: string;
  name: string;
  description?: string;
  challenge_template_id: string; // ID del template de reto (ej. 'no-spend-week', 'save-x-amount')
  status: "active" | "completed" | "failed" | "regular";
  start_date: string;
  end_date: string;
  target_amount?: number; // Para retos de ahorro
  forbidden_category_ids?: string[]; // Para retos de no gasto
  user_id?: string;
  created_at: string;
  savings?: { // Vinculación a una cuenta de ahorro
    id: string;
    name: string;
    current_balance: number;
    target_amount?: number;
    target_date?: string;
    completion_date?: string;
  } | null;
}

interface SavingAccount {
  id: string;
  name: string;
  current_balance: number;
  target_amount?: number;
  target_date?: string;
  completion_date?: string;
}

const challengeTemplates = [
  { id: "save-x-amount", name: "Ahorrar una cantidad específica", description: "Establece una meta de ahorro y una fecha límite." },
  { id: "no-spend-week", name: "Semana sin gastos", description: "Evita gastos en categorías específicas por una semana." },
  // Puedes añadir más templates aquí
];

const Challenges: React.FC = () => {
  const { user } = useSession();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [savingAccounts, setSavingAccounts] = useState<SavingAccount[]>([]);
  const [isAddChallengeDialogOpen, setIsAddChallengeDialogOpen] = useState(false);
  const [isEditChallengeDialogOpen, setIsEditChallengeDialogOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [newChallenge, setNewChallenge] = useState({
    name: "",
    description: "",
    challenge_template_id: "",
    start_date: new Date() as Date | undefined,
    end_date: undefined as Date | undefined,
    target_amount: "",
    selectedSavingAccountId: "" as string | null,
  });

  const [searchTerm, setSearchTerm] = useState("");

  const fetchChallengesAndSavings = async () => {
    if (!user) {
      setChallenges([]);
      setSavingAccounts([]);
      return;
    }

    // Fetch challenges
    const { data: challengesData, error: challengesError } = await supabase
      .from('challenges')
      .select('*, savings(id, name, current_balance, target_amount, target_date, completion_date)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (challengesError) {
      showError('Error al cargar retos: ' + challengesError.message);
    } else {
      setChallenges(challengesData || []);
    }

    // Fetch saving accounts
    const { data: savingsData, error: savingsError } = await supabase
      .from('savings')
      .select('id, name, current_balance, target_amount, target_date, completion_date')
      .eq('user_id', user.id);

    if (savingsError) {
      showError('Error al cargar cuentas de ahorro: ' + savingsError.message);
    } else {
      setSavingAccounts(savingsData || []);
    }
  };

  useEffect(() => {
    if (user) {
      fetchChallengesAndSavings();
    }
  }, [user]);

  const handleNewChallengeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewChallenge((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewChallengeDateChange = (field: "start_date" | "end_date", date: Date | undefined) => {
    setNewChallenge((prev) => ({ ...prev, [field]: date }));
  };

  const handleTemplateSelect = (templateId: string) => {
    setNewChallenge((prev) => ({ ...prev, challenge_template_id: templateId }));
  };

  const handleSavingAccountSelect = (savingId: string) => {
    setNewChallenge((prev) => ({ ...prev, selectedSavingAccountId: savingId }));
  };

  const handleSubmitNewChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("Debes iniciar sesión para añadir retos.");
      return;
    }

    if (!newChallenge.name.trim()) {
      showError("El nombre del reto no puede estar vacío.");
      return;
    }
    if (!newChallenge.challenge_template_id) {
      showError("Por favor, selecciona un tipo de reto.");
      return;
    }
    if (!newChallenge.start_date || !newChallenge.end_date) {
      showError("Por favor, selecciona una fecha de inicio y fin para el reto.");
      return;
    }
    if (isAfter(newChallenge.start_date, newChallenge.end_date)) {
      showError("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }

    let targetAmount: number | undefined = undefined;
    if (newChallenge.target_amount) {
      targetAmount = parseFloat(newChallenge.target_amount);
      if (isNaN(targetAmount) || targetAmount <= 0) {
        showError("El monto objetivo debe ser un número positivo.");
        return;
      }
    }

    let savingAccountIdToLink: string | null = null;
    if (newChallenge.selectedSavingAccountId) {
      savingAccountIdToLink = newChallenge.selectedSavingAccountId;
      // Si se vincula a una cuenta de ahorro, actualizar su target_amount y target_date
      const selectedSaving = savingAccounts.find(s => s.id === savingAccountIdToLink);
      if (selectedSaving) {
        const { error: updateSavingError } = await supabase
          .from('savings')
          .update({
            target_amount: targetAmount,
            target_date: newChallenge.end_date ? getLocalDateString(newChallenge.end_date) : null,
          })
          .eq('id', savingAccountIdToLink)
          .eq('user_id', user.id);
        if (updateSavingError) {
          showError('Error al actualizar la cuenta de ahorro vinculada: ' + updateSavingError.message);
          return;
        }
      }
    }

    const { data, error } = await supabase
      .from('challenges')
      .insert({
        user_id: user.id,
        name: newChallenge.name.trim(),
        description: newChallenge.description.trim(),
        challenge_template_id: newChallenge.challenge_template_id,
        status: "active",
        start_date: getLocalDateString(newChallenge.start_date),
        end_date: getLocalDateString(newChallenge.end_date),
        target_amount: targetAmount,
        savings_id: savingAccountIdToLink, // Guardar el ID de la cuenta de ahorro vinculada
      })
      .select('*, savings(id, name, current_balance, target_amount, target_date, completion_date)');

    if (error) {
      showError('Error al registrar reto: ' + error.message);
    } else {
      setChallenges((prev) => [...prev, data[0]]);
      setNewChallenge({
        name: "",
        description: "",
        challenge_template_id: "",
        start_date: new Date(),
        end_date: undefined,
        target_amount: "",
        selectedSavingAccountId: null,
      });
      setIsAddChallengeDialogOpen(false);
      showSuccess("Reto registrado exitosamente.");
      fetchChallengesAndSavings(); // Refrescar datos para asegurar que las cuentas de ahorro vinculadas se actualicen
    }
  };

  const handleDeleteChallenge = async (challengeId: string) => {
    if (!user) {
      showError("Debes iniciar sesión para eliminar retos.");
      return;
    }

    const { error } = await supabase
      .from('challenges')
      .delete()
      .eq('id', challengeId)
      .eq('user_id', user.id);

    if (error) {
      showError('Error al eliminar reto: ' + error.message);
    } else {
      setChallenges((prev) => prev.filter((challenge) => challenge.id !== challengeId));
      showSuccess("Reto eliminado exitosamente.");
    }
  };

  const handleOpenEditChallengeDialog = (challenge: Challenge) => {
    setEditingChallenge(challenge);
    setNewChallenge({
      name: challenge.name,
      description: challenge.description || "",
      challenge_template_id: challenge.challenge_template_id,
      start_date: parseISO(challenge.start_date),
      end_date: parseISO(challenge.end_date),
      target_amount: challenge.target_amount?.toString() || "",
      selectedSavingAccountId: challenge.savings?.id || null,
    });
    setIsEditChallengeDialogOpen(true);
  };

  const handleUpdateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingChallenge) {
      showError("Debes iniciar sesión para actualizar el reto.");
      return;
    }

    if (!newChallenge.name.trim()) {
      showError("El nombre del reto no puede estar vacío.");
      return;
    }
    if (!newChallenge.challenge_template_id) {
      showError("Por favor, selecciona un tipo de reto.");
      return;
    }
    if (!newChallenge.start_date || !newChallenge.end_date) {
      showError("Por favor, selecciona una fecha de inicio y fin para el reto.");
      return;
    }
    if (isAfter(newChallenge.start_date, newChallenge.end_date)) {
      showError("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }

    let targetAmount: number | undefined = undefined;
    if (newChallenge.target_amount) {
      targetAmount = parseFloat(newChallenge.target_amount);
      if (isNaN(targetAmount) || targetAmount <= 0) {
        showError("El monto objetivo debe ser un número positivo.");
        return;
      }
    }

    let savingAccountIdToLink: string | null = null;
    if (newChallenge.selectedSavingAccountId) {
      savingAccountIdToLink = newChallenge.selectedSavingAccountId;
      // Si se vincula a una cuenta de ahorro, actualizar su target_amount y target_date
      const selectedSaving = savingAccounts.find(s => s.id === savingAccountIdToLink);
      if (selectedSaving) {
        const { error: updateSavingError } = await supabase
          .from('savings')
          .update({
            target_amount: targetAmount,
            target_date: newChallenge.end_date ? getLocalDateString(newChallenge.end_date) : null,
          })
          .eq('id', savingAccountIdToLink)
          .eq('user_id', user.id);
        if (updateSavingError) {
          showError('Error al actualizar la cuenta de ahorro vinculada: ' + updateSavingError.message);
          return;
        }
      }
    }

    const { data, error } = await supabase
      .from('challenges')
      .update({
        name: newChallenge.name.trim(),
        description: newChallenge.description.trim(),
        challenge_template_id: newChallenge.challenge_template_id,
        start_date: getLocalDateString(newChallenge.start_date),
        end_date: getLocalDateString(newChallenge.end_date),
        target_amount: targetAmount,
        savings_id: savingAccountIdToLink,
      })
      .eq('id', editingChallenge.id)
      .eq('user_id', user.id)
      .select('*, savings(id, name, current_balance, target_amount, target_date, completion_date)');

    if (error) {
      showError('Error al actualizar reto: ' + error.message);
    } else {
      setChallenges((prev) =>
        prev.map((challenge) => (challenge.id === editingChallenge.id ? data[0] : challenge))
      );
      setEditingChallenge(null);
      setNewChallenge({
        name: "",
        description: "",
        challenge_template_id: "",
        start_date: new Date(),
        end_date: undefined,
        target_amount: "",
        selectedSavingAccountId: null,
      });
      setIsEditChallengeDialogOpen(false);
      showSuccess("Reto actualizado exitosamente.");
      fetchChallengesAndSavings(); // Refrescar datos
    }
  };

  const filteredChallenges = challenges.filter((challenge) =>
    challenge.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    challenge.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = (formatType: 'csv' | 'pdf') => {
    const dataToExport = filteredChallenges.map(challenge => ({
      Nombre: challenge.name,
      Descripción: challenge.description || "N/A",
      "Tipo de Reto": challengeTemplates.find(t => t.id === challenge.challenge_template_id)?.name || "Desconocido",
      Estado: challenge.status,
      "Fecha Inicio": format(parseISO(challenge.start_date), "dd/MM/yyyy", { locale: es }),
      "Fecha Fin": format(parseISO(challenge.end_date), "dd/MM/yyyy", { locale: es }),
      "Monto Objetivo": challenge.target_amount?.toFixed(2) || "N/A",
      "Cuenta de Ahorro Vinculada": challenge.savings?.name || "N/A",
    }));

    const filename = `retos_${format(new Date(), "yyyyMMdd_HHmmss")}`;
    const title = "Reporte de Retos de Ahorro";
    const headers = [
      "Nombre", "Descripción", "Tipo de Reto", "Estado", "Fecha Inicio",
      "Fecha Fin", "Monto Objetivo", "Cuenta de Ahorro Vinculada"
    ];
    const pdfData = dataToExport.map(row => Object.values(row));

    if (formatType === 'csv') {
      exportToCsv(`${filename}.csv`, dataToExport);
      showSuccess("Retos exportados a CSV.");
    } else {
      exportToPdf(`${filename}.pdf`, title, headers, pdfData);
      showSuccess("Retos exportados a PDF.");
    }
  };

  const getChallengeStatusDisplay = (challenge: Challenge) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = parseISO(challenge.end_date);
    endDate.setHours(0, 0, 0, 0);

    if (challenge.status === "completed") {
      return <span className="flex items-center text-green-600"><CheckCircle className="h-4 w-4 mr-1" /> Completado</span>;
    }
    if (challenge.status === "failed") {
      return <span className="flex items-center text-red-600"><XCircle className="h-4 w-4 mr-1" /> Fallido</span>;
    }
    if (isAfter(today, endDate)) {
      return <span className="flex items-center text-red-600"><XCircle className="h-4 w-4 mr-1" /> Finalizado (No completado)</span>;
    }
    return <span className="flex items-center text-blue-600"><Clock className="h-4 w-4 mr-1" /> Activo</span>;
  };

  const getChallengeProgress = (challenge: Challenge) => {
    if (challenge.challenge_template_id === "save-x-amount" && challenge.target_amount && challenge.savings) {
      const progress = (challenge.savings.current_balance / challenge.target_amount) * 100;
      return (
        <div className="flex items-center gap-2">
          <Progress value={progress} className="w-[100px]" />
          <span className="text-sm">{progress.toFixed(0)}%</span>
        </div>
      );
    }
    return "N/A";
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Retos de Ahorro</h1>

      <RandomChallengeBanner />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mis Retos</CardTitle>
          <div className="flex gap-2">
            <Dialog open={isAddChallengeDialogOpen} onOpenChange={setIsAddChallengeDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Añadir Reto
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Añadir Nuevo Reto</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmitNewChallenge} className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Nombre
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={newChallenge.name}
                      onChange={handleNewChallengeChange}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">
                      Descripción (Opcional)
                    </Label>
                    <Input
                      id="description"
                      name="description"
                      value={newChallenge.description}
                      onChange={handleNewChallengeChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="challenge_template_id" className="text-right">
                      Tipo de Reto
                    </Label>
                    <Select value={newChallenge.challenge_template_id} onValueChange={handleTemplateSelect}>
                      <SelectTrigger id="challenge_template_id" className="col-span-3">
                        <SelectValue placeholder="Selecciona un tipo de reto" />
                      </SelectTrigger>
                      <SelectContent>
                        {challengeTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {newChallenge.challenge_template_id === "save-x-amount" && (
                    <>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="target_amount" className="text-right">
                          Monto Objetivo
                        </Label>
                        <Input
                          id="target_amount"
                          name="target_amount"
                          type="number"
                          step="0.01"
                          value={newChallenge.target_amount}
                          onChange={handleNewChallengeChange}
                          className="col-span-3"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="saving_account" className="text-right">
                          Vincular a Cuenta de Ahorro
                        </Label>
                        <Select value={newChallenge.selectedSavingAccountId || ""} onValueChange={handleSavingAccountSelect}>
                          <SelectTrigger id="saving_account" className="col-span-3">
                            <SelectValue placeholder="Selecciona una cuenta de ahorro" />
                          </SelectTrigger>
                          <SelectContent>
                            {savingAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name} (${account.current_balance.toFixed(2)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="start_date" className="text-right">
                      Fecha Inicio
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "col-span-3 justify-start text-left font-normal",
                            !newChallenge.start_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newChallenge.start_date ? format(newChallenge.start_date, "dd/MM/yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newChallenge.start_date}
                          onSelect={(date) => handleNewChallengeDateChange("start_date", date)}
                          initialFocus
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="end_date" className="text-right">
                      Fecha Fin
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "col-span-3 justify-start text-left font-normal",
                            !newChallenge.end_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newChallenge.end_date ? format(newChallenge.end_date, "dd/MM/yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newChallenge.end_date}
                          onSelect={(date) => handleNewChallengeDateChange("end_date", date)}
                          initialFocus
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Guardar Reto</Button>
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
              placeholder="Buscar reto por nombre o descripción..."
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead>Fechas</TableHead>
                  <TableHead>Cuenta Vinculada</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChallenges.map((challenge) => (
                  <TableRow key={challenge.id}>
                    <TableCell className="font-medium">{challenge.name}</TableCell>
                    <TableCell>{challengeTemplates.find(t => t.id === challenge.challenge_template_id)?.name || "Desconocido"}</TableCell>
                    <TableCell>{getChallengeStatusDisplay(challenge)}</TableCell>
                    <TableCell>{getChallengeProgress(challenge)}</TableCell>
                    <TableCell>
                      {format(parseISO(challenge.start_date), "dd/MM/yyyy", { locale: es })} -{" "}
                      {format(parseISO(challenge.end_date), "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>{challenge.savings?.name || "N/A"}</TableCell>
                    <TableCell className="text-right flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditChallengeDialog(challenge)}
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
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Esto eliminará permanentemente el reto 
                              **{challenge.name}** y sus registros.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteChallenge(challenge.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Dialog open={isEditChallengeDialogOpen} onOpenChange={setIsEditChallengeDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Editar Reto: {editingChallenge?.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateChallenge} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editName" className="text-right">
                    Nombre
                  </Label>
                  <Input
                    id="editName"
                    name="name"
                    value={newChallenge.name}
                    onChange={handleNewChallengeChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editDescription" className="text-right">
                    Descripción (Opcional)
                  </Label>
                  <Input
                    id="editDescription"
                    name="description"
                    value={newChallenge.description}
                    onChange={handleNewChallengeChange}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editChallenge_template_id" className="text-right">
                    Tipo de Reto
                  </Label>
                  <Select value={newChallenge.challenge_template_id} onValueChange={handleTemplateSelect}>
                    <SelectTrigger id="editChallenge_template_id" className="col-span-3">
                      <SelectValue placeholder="Selecciona un tipo de reto" />
                    </SelectTrigger>
                    <SelectContent>
                      {challengeTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {newChallenge.challenge_template_id === "save-x-amount" && (
                  <>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="editTarget_amount" className="text-right">
                        Monto Objetivo
                      </Label>
                      <Input
                        id="editTarget_amount"
                        name="target_amount"
                        type="number"
                        step="0.01"
                        value={newChallenge.target_amount}
                        onChange={handleNewChallengeChange}
                        className="col-span-3"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="editSaving_account" className="text-right">
                        Vincular a Cuenta de Ahorro
                      </Label>
                      <Select value={newChallenge.selectedSavingAccountId || ""} onValueChange={handleSavingAccountSelect}>
                        <SelectTrigger id="editSaving_account" className="col-span-3">
                          <SelectValue placeholder="Selecciona una cuenta de ahorro" />
                        </SelectTrigger>
                        <SelectContent>
                          {savingAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name} (${account.current_balance.toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editStart_date" className="text-right">
                    Fecha Inicio
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "col-span-3 justify-start text-left font-normal",
                          !newChallenge.start_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newChallenge.start_date ? format(newChallenge.start_date, "dd/MM/yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newChallenge.start_date}
                        onSelect={(date) => handleNewChallengeDateChange("start_date", date)}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editEnd_date" className="text-right">
                    Fecha Fin
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "col-span-3 justify-start text-left font-normal",
                          !newChallenge.end_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newChallenge.end_date ? format(newChallenge.end_date, "dd/MM/yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newChallenge.end_date}
                        onSelect={(date) => handleNewChallengeDateChange("end_date", date)}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <DialogFooter>
                  <Button type="submit">Actualizar Reto</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default Challenges;