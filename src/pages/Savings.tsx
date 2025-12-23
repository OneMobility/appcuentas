"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PlusCircle, DollarSign, Trash2, Edit, CalendarIcon, FileText, FileDown, PiggyBank, ArrowUpCircle, ArrowDownCircle, Trophy, CheckCircle, XCircle, Clock } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, isAfter, isSameDay, parseISO, differenceInDays, isBefore } from "date-fns";
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
import RandomChallengeBanner from "@/components/RandomChallengeBanner"; // Importar el banner de retos
import { getLocalDateString } from "@/utils/date-helpers";
// import { Outlet, useLocation } from "react-router-dom"; // Outlet y useLocation ya no son necesarios aquí

interface Saving {
  id: string;
  name: string;
  current_balance: number;
  target_amount?: number;
  target_date?: string; // Fecha objetivo
  completion_date?: string; // Fecha de cumplimiento
  color: string;
  user_id?: string;
}

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

interface SavingAccountForChallenge {
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

const Savings: React.FC = () => {
  const { user } = useSession();
  // const location = useLocation(); // Ya no es necesario
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
    color: "#22C55E", // Default green color
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

  const [searchTermSavings, setSearchTermSavings] = useState(""); // Search term for savings
  
  // --- Challenge-related states and functions ---
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [savingAccountsForChallenges, setSavingAccountsForChallenges] = useState<SavingAccountForChallenge[]>([]);
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
  const [searchTermChallenges, setSearchTermChallenges] = useState(""); // Search term for challenges
  // --- End Challenge-related states and functions ---


  const fetchSavingsAndChallenges = async () => {
    if (!user) {
      setSavings([]);
      setChallenges([]);
      setSavingAccountsForChallenges([]);
      return;
    }

    // Fetch savings accounts
    const { data: savingsData, error: savingsError } = await supabase
      .from('savings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (savingsError) {
      showError('Error al cargar ahorros: ' + savingsError.message);
    } else {
      setSavings(savingsData || []);
      setSavingAccountsForChallenges(savingsData || []); // También para los retos
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
  };

  useEffect(() => {
    if (user) {
      fetchSavingsAndChallenges();
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

    const initialBalance = parseFloat(newSaving.initial_balance);
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
      targetAmount = parseFloat(newSaving.target_amount);
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
        target_date: newSaving.target_date ? getLocalDateString(newSaving.target_date) : null, // Usar getLocalDateString
        color: newSaving.color,
        completion_date: null, // Inicializar completion_date como null
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
        imageSrc: "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/cochinito%20amor.png", // Updated URL
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
      initial_balance: saving.current_balance.toString(), // Usar current_balance como initial_balance para edición
      target_amount: saving.target_amount?.toString() || "",
      target_date: saving.target_date ? parseISO(saving.target_date) : undefined, // Usar parseISO
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
      targetAmount = parseFloat(newSaving.target_amount);
      if (isNaN(targetAmount) || targetAmount <= 0) {
        showError("El monto objetivo debe ser un número positivo.");
        return;
      }
    }

    // No actualizamos current_balance ni completion_date desde aquí
    const { data, error } = await supabase
      .from('savings')
      .update({ 
        name: newSaving.name.trim(),
        target_amount: targetAmount,
        target_date: newSaving.target_date ? getLocalDateString(newSaving.target_date) : null, // Usar getLocalDateString
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

      // Check if goal is reached after update (only if target_amount is set and current_balance is already >= target_amount)
      if (updatedSaving.target_amount && updatedSaving.current_balance >= updatedSaving.target_amount && !updatedSaving.completion_date) {
        const todayFormatted = getLocalDateString(new Date()); // Usar getLocalDateString
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
            imageSrc: "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Meta%202.png", // Updated URL
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

    const amount = parseFloat(newTransaction.amount);
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
    } else { // withdrawal
      if (newBalance < amount) {
        showError("Saldo insuficiente en la cuenta de ahorro para este retiro.");
        return;
      }
      newBalance -= amount;
    }

    let updatedCompletionDate = currentSaving.completion_date;
    const todayFormatted = getLocalDateString(new Date()); // Usar getLocalDateString

    // Check if goal is reached after this transaction and set completion_date
    if (currentSaving.target_amount && newBalance >= currentSaving.target_amount && !currentSaving.completion_date) {
      updatedCompletionDate = todayFormatted;
    } else if (currentSaving.target_amount && newBalance < currentSaving.target_amount && currentSaving.completion_date) {
      // If balance drops below target after a withdrawal, clear completion_date
      updatedCompletionDate = null;
    }


    // Update saving balance and completion_date
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

      // Show feedback overlay based on transaction type
      if (transactionType === "deposit") {
        setFeedbackOverlay({
          isVisible: true,
          message: "¡Felicidades! ¡Un paso más cerca de tus metas!",
          imageSrc: "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro.png", // No change
          bgColor: "bg-pink-100",
          textColor: "text-pink-800",
        });
        // Check if goal is reached after deposit
        if (updatedSaving.target_amount && updatedSaving.current_balance >= updatedSaving.target_amount) {
          setFeedbackOverlay({
            isVisible: true,
            message: "¡Lo has logrado! ¡Felicidades por alcanzar tu meta!",
            imageSrc: "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Meta%202.png", // Updated URL
            bgColor: "bg-green-100",
            textColor: "text-green-800",
          });
        }
      } else { // withdrawal
        setFeedbackOverlay({
          isVisible: true,
          message: "Pensé que éramos amigos... ¡No te rindas!",
          imageSrc: "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro%20Triste.png", // No change
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
    saving.name.toLowerCase().includes(searchTermSavings.toLowerCase())
  );

  const handleExportSavings = (formatType: 'csv' | 'pdf') => {
    const dataToExport = filteredSavings.map(saving => ({
      Nombre: saving.name,
      "Saldo Actual": saving.current_balance.toFixed(2),
      "Monto Objetivo": saving.target_amount?.toFixed(2) || "N/A",
      "Fecha Objetivo": saving.target_date ? format(parseISO(saving.target_date), "dd/MM/yyyy", { locale: es }) : "N/A",
      "Fecha Cumplimiento": saving.completion_date ? format(parseISO(saving.completion_date), "dd/MM/yyyy", { locale: es }) : "N/A", // Añadido
      "Progreso (%)": saving.target_amount ? ((saving.current_balance / saving.target_amount) * 100).toFixed(2) : "N/A",
    }));

    const filename = `ahorros_${format(new Date(), "yyyyMMdd_HHmmss")}`;
    const title = "Reporte de Cuentas de Ahorro";
    const headers = ["Nombre", "Saldo Actual", "Monto Objetivo", "Fecha Objetivo", "Fecha Cumplimiento", "Progreso (%)"]; // Añadido
    const pdfData = dataToExport.map(row => Object.values(row));

    if (formatType === 'csv') {
      exportToCsv(`${filename}.csv`, dataToExport);
      showSuccess("Cuentas de ahorro exportadas a CSV.");
    } else {
      exportToPdf(`${filename}.pdf`, title, headers, pdfData);
      showSuccess("Cuentas de ahorro exportadas a PDF.");
    }
  };

  // --- Challenge-related functions (moved from Challenges.tsx) ---
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
      const selectedSaving = savingAccountsForChallenges.find(s => s.id === savingAccountIdToLink);
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
      fetchSavingsAndChallenges(); // Refrescar datos para asegurar que las cuentas de ahorro vinculadas se actualicen
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
      const selectedSaving = savingAccountsForChallenges.find(s => s.id === savingAccountIdToLink);
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
      fetchSavingsAndChallenges(); // Refrescar datos
    }
  };

  const filteredChallenges = challenges.filter((challenge) =>
    challenge.name.toLowerCase().includes(searchTermChallenges.toLowerCase()) ||
    challenge.description?.toLowerCase().includes(searchTermChallenges.toLowerCase())
  );

  const handleExportChallenges = (formatType: 'csv' | 'pdf') => {
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
  // --- End Challenge-related functions ---

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Ahorrando</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <RandomSavingTipCard />
        <FixedSavingTipCard />
      </div>

      <Card className="border-l-4 border-green-500 bg-green-50 text-green-800">
        <CardHeader>
          <CardTitle>Saldo Total de Ahorros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">${totalSavingsBalance.toFixed(2)}</div>
        </CardContent>
      </Card>

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
                      type="number"
                      step="0.01"
                      value={newSaving.initial_balance}
                      onChange={handleNewSavingChange}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="target_amount" className="text-right">
                      Monto Objetivo (Opcional)
                    </Label>
                    <Input
                      id="target_amount"
                      name="target_amount"
                      type="number"
                      step="0.01"
                      value={newSaving.target_amount}
                      onChange={handleNewSavingChange}
                      className="col-span-3"
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
                <DropdownMenuItem onClick={() => handleExportSavings('csv')}>
                  <FileText className="mr-2 h-4 w-4" /> Exportar a CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportSavings('pdf')}>
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
              value={searchTermSavings}
              onChange={(e) => setSearchTermSavings(e.target.value)}
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
                                Esta acción no se puede deshacer. Esto eliminará permanentemente la cuenta de ahorro 
                                **{saving.name}** y todos sus registros.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteSaving(saving.id)}>
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
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editTargetAmount" className="text-right">
                    Monto Objetivo (Opcional)
                  </Label>
                  <Input
                    id="editTargetAmount"
                    name="target_amount"
                    type="number"
                    step="0.01"
                    value={newSaving.target_amount}
                    onChange={handleNewSavingChange}
                    className="col-span-3"
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
                  <Button type="submit">Actualizar Ahorro</Button>
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
                    type="number"
                    step="0.01"
                    value={newTransaction.amount}
                    onChange={handleTransactionInputChange}
                    className="col-span-3"
                    required
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

      {/* --- Challenges Section (moved from Challenges.tsx) --- */}
      <h1 className="text-3xl font-bold mt-8">Retos de Ahorro</h1>

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
                            {savingAccountsForChallenges.map((account) => (
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
                <DropdownMenuItem onClick={() => handleExportChallenges('csv')}>
                  <FileText className="mr-2 h-4 w-4" /> Exportar a CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportChallenges('pdf')}>
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
              value={searchTermChallenges}
              onChange={(e) => setSearchTermChallenges(e.target.value)}
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
                          {savingAccountsForChallenges.map((account) => (
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
      {/* --- End Challenges Section --- */}
    </div>
  );
};

export default Savings;