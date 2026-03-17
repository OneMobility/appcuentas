"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PlusCircle, DollarSign, CalendarIcon, ArrowRightLeft, PiggyBank, Wallet, Banknote } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import CardDisplay from "@/components/CardDisplay";
import ColorPicker from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import CardTransferDialog from "@/components/CardTransferDialog";
import { useCategoryContext } from "@/context/CategoryContext";
import { evaluateExpression } from "@/utils/math-helpers";

const Cards = () => {
  const { user } = useSession();
  const { isLoadingCategories } = useCategoryContext();
  const [cards, setCards] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  
  const [newCard, setNewCard] = useState({
    name: "", bank_name: "", last_four_digits: "", expiration_date: "",
    type: "debit" as "credit" | "debit", initial_balance: "", credit_limit: "",
    cut_off_day: undefined as number | undefined, days_to_pay_after_cut_off: undefined as number | undefined,
    color: "#3B82F6",
  });

  const [searchTerm, setSearchTerm] = useState("");

  const fetchCards = async () => {
    if (!user) return;
    
    // Cargamos las tarjetas primero
    const { data: cardsData, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (cardsError) {
      showError('Error al cargar tarjetas');
      return;
    }

    // Intentamos cargar los apartados por separado para no romper la vista si la tabla no existe
    try {
      const { data: pocketsData } = await supabase
        .from('card_pockets')
        .select('*')
        .eq('user_id', user.id);

      const cardsWithPockets = (cardsData || []).map(card => ({
        ...card,
        card_pockets: (pocketsData || []).filter(p => p.card_id === card.id)
      }));
      
      setCards(cardsWithPockets);
    } catch (e) {
      console.warn("La tabla card_pockets podría no existir aún:", e);
      setCards(cardsData || []);
    }
  };

  const fetchCashBalance = async () => {
    if (!user) return;
    const { data } = await supabase.from('cash_transactions').select('type, amount').eq('user_id', user.id);
    const balance = (data || []).reduce((s, t) => t.type === "ingreso" ? s + t.amount : s - t.amount, 0);
    setCashBalance(balance);
  };

  useEffect(() => {
    if (user && !isLoadingCategories) {
      fetchCards();
      fetchCashBalance();
    }
  }, [user, isLoadingCategories]);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const balance = evaluateExpression(newCard.initial_balance) || 0;
    const { error } = await supabase.from('cards').insert({
      user_id: user?.id,
      name: newCard.name || `${newCard.bank_name} ${newCard.type}`,
      bank_name: newCard.bank_name,
      last_four_digits: newCard.last_four_digits,
      expiration_date: newCard.expiration_date,
      type: newCard.type,
      initial_balance: balance,
      current_balance: balance,
      color: newCard.color,
      credit_limit: newCard.type === "credit" ? (evaluateExpression(newCard.credit_limit) || 0) : null,
    });

    if (error) showError("Error al guardar");
    else {
      showSuccess("Tarjeta añadida");
      setIsAddCardDialogOpen(false);
      fetchCards();
    }
  };

  const handleDeleteCard = async (id: string) => {
    const { error } = await supabase.from('cards').delete().eq('id', id);
    if (error) showError("Error al eliminar");
    else {
      showSuccess("Tarjeta eliminada");
      fetchCards();
    }
  };

  const filteredCards = cards.filter(c => 
    (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.bank_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Tus Tarjetas</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCards.map(card => (
          <CardDisplay
            key={card.id}
            card={card}
            onAddTransaction={(id) => { setSelectedCardId(id); setIsAddTransactionDialogOpen(true); }}
            onDeleteCard={handleDeleteCard}
            onEditCard={(c) => { /* Implementar edición si es necesario */ }}
            onTransfer={() => setIsTransferDialogOpen(true)}
          />
        ))}
      </div>

      <CardTransferDialog
        isOpen={isTransferDialogOpen}
        onClose={() => setIsTransferDialogOpen(false)}
        cards={cards}
        cashBalance={cashBalance}
        onTransferSuccess={() => { fetchCards(); fetchCashBalance(); }}
      />

      <Dialog open={isAddCardDialogOpen} onOpenChange={setIsAddCardDialogOpen}>
        <DialogTrigger asChild>
          <Button className="fixed bottom-20 right-4 rounded-full h-14 w-14 shadow-xl md:static md:h-10 md:w-auto md:rounded-md">
            <PlusCircle className="h-6 w-6 md:mr-2" />
            <span className="hidden md:inline">Añadir Tarjeta</span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Tarjeta</DialogTitle></DialogHeader>
          <form onSubmit={handleAddCard} className="grid gap-4 py-4">
            <Input placeholder="Banco" value={newCard.bank_name} onChange={e => setNewCard({...newCard, bank_name: e.target.value})} required />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Últimos 4 dígitos" maxLength={4} value={newCard.last_four_digits} onChange={e => setNewCard({...newCard, last_four_digits: e.target.value})} required />
              <Input placeholder="Expira (MM/AA)" maxLength={5} value={newCard.expiration_date} onChange={e => setNewCard({...newCard, expiration_date: e.target.value})} required />
            </div>
            <Select value={newCard.type} onValueChange={(v: any) => setNewCard({...newCard, type: v})}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent><SelectItem value="debit">Débito</SelectItem><SelectItem value="credit">Crédito</SelectItem></SelectContent>
            </Select>
            <Input placeholder="Saldo Inicial" value={newCard.initial_balance} onChange={e => setNewCard({...newCard, initial_balance: e.target.value})} required />
            <ColorPicker selectedColor={newCard.color} onSelectColor={c => setNewCard({...newCard, color: c})} />
            <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cards;