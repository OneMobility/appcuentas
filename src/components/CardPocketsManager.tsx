"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Trash2, ArrowRightLeft, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  
  const [newPocketName, setNewPocketName] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferType, setTransferType] = useState<"to_pocket" | "from_pocket">("to_pocket");

  const fetchPockets = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('card_pockets')
      .select('*')
      .eq('card_id', cardId)
      .eq('user_id', user.id);
    
    if (error) showError("Error al cargar apartados");
    else setPockets(data || []);
  };

  useEffect(() => {
    fetchPockets();
  }, [cardId, user]);

  const handleCreatePocket = async () => {
    if (!newPocketName.trim()) return;
    const { error } = await supabase
      .from('card_pockets')
      .insert({ card_id: cardId, user_id: user?.id, name: newPocketName.trim(), amount: 0 });
    
    if (error) showError("Error al crear apartado");
    else {
      showSuccess("Apartado creado");
      setNewPocketName("");
      setIsAddDialogOpen(false);
      fetchPockets();
    }
  };

  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0 || !selectedPocket) return;

    if (transferType === "to_pocket" && cardBalance < amount) {
      showError("Saldo insuficiente en la tarjeta");
      return;
    }
    if (transferType === "from_pocket" && selectedPocket.amount < amount) {
      showError("Saldo insuficiente en el apartado");
      return;
    }

    try {
      const newPocketAmount = transferType === "to_pocket" 
        ? selectedPocket.amount + amount 
        : selectedPocket.amount - amount;
      
      const newCardBalance = transferType === "to_pocket"
        ? cardBalance - amount
        : cardBalance + amount;

      await supabase.from('card_pockets').update({ amount: newPocketAmount }).eq('id', selectedPocket.id);
      await supabase.from('cards').update({ current_balance: newCardBalance }).eq('id', cardId);

      showSuccess("Transferencia exitosa");
      setIsTransferDialogOpen(false);
      setTransferAmount("");
      fetchPockets();
      onUpdate();
    } catch (e) {
      showError("Error en la transferencia");
    }
  };

  const handleDeletePocket = async (pocket: Pocket) => {
    if (pocket.amount > 0) {
      await supabase.from('cards').update({ current_balance: cardBalance + pocket.amount }).eq('id', cardId);
    }
    await supabase.from('card_pockets').delete().eq('id', pocket.id);
    showSuccess("Apartado eliminado");
    fetchPockets();
    onUpdate();
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

        {/* Dialogs */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear Apartado</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nombre del Apartado</Label>
                <Input value={newPocketName} onChange={e => setNewPocketName(e.target.value)} placeholder="Ej. Renta, Ahorro..." />
              </div>
            </div>
            <DialogFooter><Button onClick={handleCreatePocket}>Crear</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Mover Dinero: {selectedPocket?.name}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Dirección</Label>
                <Select value={transferType} onValueChange={(v: any) => setTransferType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to_pocket">De Tarjeta a Apartado</SelectItem>
                    <SelectItem value="from_pocket">De Apartado a Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Monto</Label>
                <Input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <DialogFooter><Button onClick={handleTransfer}>Confirmar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default CardPocketsManager;