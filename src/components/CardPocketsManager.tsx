"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Trash2, ArrowRightLeft, Wallet, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { evaluateExpression } from "@/utils/math-helpers";

interface Pocket {
  id: string;
  name: string;
  amount: number;
}

interface CardPocketsManagerProps {
  cardId: string;
  cardBalance: number;
  onUpdate: () => void;
}

const CardPocketsManager: React.FC<CardPocketsManagerProps> = ({ cardId, cardBalance, onUpdate }) => {
  const { user } = useSession();
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedPocket, setSelectedPocket] = useState<Pocket | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newPocketName, setNewPocketName] = useState("");
  const [transferAmountInput, setTransferAmountInput] = useState("");
  const [transferType, setTransferType] = useState<"to_pocket" | "from_pocket">("to_pocket");

  const fetchPockets = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('card_pockets')
        .select('*')
        .eq('card_id', cardId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      setPockets(data || []);
    } catch (e: any) {
      console.error("Error fetching pockets:", e.message);
    }
  };

  useEffect(() => {
    fetchPockets();
  }, [cardId, user]);

  const handleCreatePocket = async () => {
    if (!newPocketName.trim() || !user) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('card_pockets')
        .insert({ 
          card_id: cardId, 
          user_id: user.id, 
          name: newPocketName.trim(), 
          amount: 0 
        });
      
      if (error) throw error;

      showSuccess("Apartado creado exitosamente");
      setNewPocketName("");
      setIsAddDialogOpen(false);
      fetchPockets();
    } catch (e: any) {
      showError("Error al crear apartado.");
      console.error("Create pocket error:", e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedPocket || !user) return;

    let amount: number;
    if (transferAmountInput.startsWith('=')) {
      amount = evaluateExpression(transferAmountInput.substring(1)) || 0;
    } else {
      amount = parseFloat(transferAmountInput);
    }

    if (isNaN(amount) || amount <= 0) {
      showError("Monto inválido");
      return;
    }

    // Redondear para evitar errores de precisión de punto flotante
    const roundedAmount = Math.round(amount * 100) / 100;
    const roundedCardBalance = Math.round(cardBalance * 100) / 100;
    const roundedPocketAmount = Math.round(selectedPocket.amount * 100) / 100;

    if (transferType === "to_pocket" && roundedAmount > roundedCardBalance) {
      showError(`Saldo insuficiente en la tarjeta ($${roundedCardBalance.toFixed(2)})`);
      return;
    }
    if (transferType === "from_pocket" && roundedAmount > roundedPocketAmount) {
      showError(`Saldo insuficiente en el apartado ($${roundedPocketAmount.toFixed(2)})`);
      return;
    }

    setIsSubmitting(true);
    try {
      const newPocketAmount = transferType === "to_pocket" 
        ? roundedPocketAmount + roundedAmount 
        : roundedPocketAmount - roundedAmount;
      
      const newCardBalance = transferType === "to_pocket"
        ? roundedCardBalance - roundedAmount
        : roundedCardBalance + roundedAmount;

      const { error: pocketError } = await supabase
        .from('card_pockets')
        .update({ amount: newPocketAmount })
        .eq('id', selectedPocket.id);
      
      if (pocketError) throw pocketError;

      const { error: cardError } = await supabase
        .from('cards')
        .update({ current_balance: newCardBalance })
        .eq('id', cardId);
      
      if (cardError) throw cardError;

      showSuccess("Transferencia exitosa");
      setIsTransferDialogOpen(false);
      setTransferAmountInput("");
      fetchPockets();
      onUpdate();
    } catch (e: any) {
      showError("Error en la transferencia: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePocket = async (pocket: Pocket) => {
    if (!user) return;
    
    try {
      if (pocket.amount > 0) {
        await supabase.from('cards').update({ current_balance: cardBalance + pocket.amount }).eq('id', cardId);
      }
      const { error } = await supabase.from('card_pockets').delete().eq('id', pocket.id);
      if (error) throw error;

      showSuccess("Apartado eliminado");
      fetchPockets();
      onUpdate();
    } catch (e: any) {
      showError("Error al eliminar apartado: " + e.message);
    }
  };

  return (
    <Card className="border-dashed border-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5" /> Apartados
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-1" /> Nuevo
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {pockets.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No tienes apartados en esta tarjeta.</p>}
          {pockets.map(pocket => (
            <div key={pocket.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div>
                <p className="font-medium">{pocket.name}</p>
                <p className="text-lg font-bold">${pocket.amount.toFixed(2)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setSelectedPocket(pocket); setIsTransferDialogOpen(true); }}>
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeletePocket(pocket)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear Apartado</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nombre del Apartado</Label>
                <Input 
                  value={newPocketName} 
                  onChange={e => setNewPocketName(e.target.value)} 
                  placeholder="Ej. Renta, Ahorro..." 
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreatePocket} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
          <DialogContent className="w-[90vw] max-w-[400px] rounded-3xl">
            <DialogHeader><DialogTitle>Mover Dinero: {selectedPocket?.name}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="bg-blue-50 p-4 rounded-2xl flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs text-blue-700 font-bold uppercase">
                  <span>Tarjeta</span>
                  <span>Saldo: ${cardBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-blue-700 font-bold uppercase border-t border-blue-200 pt-2">
                  <span>{selectedPocket?.name}</span>
                  <span>Saldo: ${selectedPocket?.amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Dirección</Label>
                <Select value={transferType} onValueChange={(v: any) => setTransferType(v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to_pocket">Ahorrar (Tarjeta → Apartado)</SelectItem>
                    <SelectItem value="from_pocket">Retirar (Apartado → Tarjeta)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Monto</Label>
                <Input 
                  type="text" 
                  value={transferAmountInput} 
                  onChange={e => setTransferAmountInput(e.target.value)} 
                  placeholder="Ej. 100 o =50+50" 
                  disabled={isSubmitting}
                  className="rounded-xl h-11"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleTransfer} disabled={isSubmitting} className="w-full h-12 rounded-xl font-bold">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Movimiento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default CardPocketsManager;