"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Zap, Loader2, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { useCategoryContext } from "@/context/CategoryContext";
import { showError, showSuccess } from "@/utils/toast";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";

interface CardOption {
  id: string;
  name: string;
  bank_name: string;
  type: "credit" | "debit";
  current_balance: number;
}

interface RowItem {
  id: string;
  type: "egreso" | "ingreso";
  amount: string;
  description: string;
  categoryId: string;
  date: string;
}

interface BulkTransactionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cards: CardOption[];
  initialAccountId?: string;
}

const BulkTransactionsDialog: React.FC<BulkTransactionsDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cards,
  initialAccountId = "cash",
}) => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories } = useCategoryContext();

  const [selectedAccountId, setSelectedAccountId] = useState<string>("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayStr = getLocalDateString(new Date());

  const createEmptyRow = (): RowItem => ({
    id: Math.random().toString(36).substring(2, 9),
    type: "egreso",
    amount: "",
    description: "",
    categoryId: "",
    date: todayStr,
  });

  const [rows, setRows] = useState<RowItem[]>([createEmptyRow()]);

  useEffect(() => {
    if (isOpen) {
      setSelectedAccountId(initialAccountId || "cash");
      setRows([createEmptyRow(), createEmptyRow()]);
      setIsSubmitting(false);
    }
  }, [isOpen, initialAccountId]);

  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) {
      showError("Debes mantener al menos una fila.");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRowChange = (id: string, field: keyof RowItem, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const updated = { ...r, [field]: value };
          // Si cambió de egreso a ingreso o viceversa, limpiar la categoría si no coincide
          if (field === "type") {
            updated.categoryId = "";
          }
          return updated;
        }
        return r;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("Debes iniciar sesión.");
      return;
    }

    // Validar filas
    const validRows: {
      type: "egreso" | "ingreso";
      amount: number;
      description: string;
      categoryId: string;
      date: string;
    }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const desc = r.description.trim();
      if (!desc && !r.amount) continue; // Ignorar filas vacías

      let numAmount: number | null = null;
      if (r.amount.startsWith("=")) {
        numAmount = evaluateExpression(r.amount.substring(1));
      } else {
        numAmount = parseFloat(r.amount);
      }

      if (numAmount === null || isNaN(numAmount) || numAmount <= 0) {
        showError(`En la fila ${i + 1}, por favor ingresa un monto válido mayor a 0.`);
        return;
      }

      if (!desc) {
        showError(`En la fila ${i + 1}, debes agregar una descripción.`);
        return;
      }

      validRows.push({
        type: r.type,
        amount: numAmount,
        description: desc,
        categoryId: r.categoryId,
        date: r.date || todayStr,
      });
    }

    if (validRows.length === 0) {
      showError("Agrega al menos un movimiento válido.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (selectedAccountId === "cash") {
        const inserts = validRows.map((r) => ({
          user_id: user.id,
          type: r.type,
          amount: r.amount,
          description: r.description,
          date: r.date,
          income_category_id: r.type === "ingreso" ? r.categoryId || null : null,
          expense_category_id: r.type === "egreso" ? r.categoryId || null : null,
        }));

        const { error } = await supabase.from("cash_transactions").insert(inserts);
        if (error) throw error;
      } else {
        const card = cards.find((c) => c.id === selectedAccountId);
        if (!card) throw new Error("Tarjeta no encontrada.");

        let balanceDelta = 0;
        const inserts = validRows.map((r) => {
          const isCharge = r.type === "egreso"; // Egreso = Cargo en tarjeta
          const txType: "charge" | "payment" = isCharge ? "charge" : "payment";

          if (card.type === "credit") {
            balanceDelta += isCharge ? r.amount : -r.amount;
          } else {
            balanceDelta += isCharge ? -r.amount : r.amount;
          }

          return {
            user_id: user.id,
            card_id: card.id,
            type: txType,
            amount: r.amount,
            description: r.description,
            date: r.date,
            income_category_id: r.type === "ingreso" ? r.categoryId || null : null,
            expense_category_id: r.type === "egreso" ? r.categoryId || null : null,
          };
        });

        const { error: txError } = await supabase
          .from("card_transactions")
          .insert(inserts);
        if (txError) throw txError;

        const newBalance = card.current_balance + balanceDelta;
        const { error: cardError } = await supabase
          .from("cards")
          .update({ current_balance: newBalance })
          .eq("id", card.id);
        if (cardError) throw cardError;
      }

      showSuccess(`¡${validRows.length} movimientos registrados con éxito! ⚡`);
      onSuccess();
      onClose();
    } catch (err: any) {
      showError("Error al realizar la carga masiva: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const debitCards = cards.filter((c) => c.type === "debit");
  const creditCards = cards.filter((c) => c.type === "credit");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-3xl rounded-3xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <Zap className="h-6 w-6 text-amber-500 fill-amber-400" /> Carga Masiva de Movimientos
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 gap-4">
          {/* Selección de Cuenta Destino */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <Label htmlFor="accountSelect" className="font-bold text-xs uppercase tracking-wider text-slate-600 shrink-0">
              Cuenta de destino:
            </Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger id="accountSelect" className="rounded-xl bg-white font-bold h-10 flex-1">
                <SelectValue placeholder="Selecciona cuenta" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectGroup>
                  <SelectLabel>Efectivo</SelectLabel>
                  <SelectItem value="cash">Efectivo 💵</SelectItem>
                </SelectGroup>
                {debitCards.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Tarjetas de Débito</SelectLabel>
                    {debitCards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.bank_name})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {creditCards.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Tarjetas de Crédito</SelectLabel>
                    {creditCards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.bank_name})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Lista de Filas */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {rows.map((row, index) => {
              const categories = row.type === "egreso" ? expenseCategories : incomeCategories;

              return (
                <div
                  key={row.id}
                  className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center relative transition-all"
                >
                  <div className="flex items-center justify-between md:justify-start gap-2">
                    <span className="text-[10px] font-black text-slate-400 w-5">
                      #{index + 1}
                    </span>

                    {/* Tipo */}
                    <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRowChange(row.id, "type", "egreso")}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          row.type === "egreso"
                            ? "bg-rose-500 text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Gasto
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRowChange(row.id, "type", "ingreso")}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          row.type === "ingreso"
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Ingreso
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
                    {/* Monto */}
                    <div className="space-y-0.5">
                      <Input
                        placeholder="Monto (ej. 150 o =50*3)"
                        value={row.amount}
                        onChange={(e) => handleRowChange(row.id, "amount", e.target.value)}
                        className="rounded-xl h-10 font-black text-sm"
                      />
                    </div>

                    {/* Descripción */}
                    <div className="col-span-2 md:col-span-1 space-y-0.5">
                      <Input
                        placeholder="Descripción (ej. Comida)"
                        value={row.description}
                        onChange={(e) => handleRowChange(row.id, "description", e.target.value)}
                        className="rounded-xl h-10 text-sm font-medium"
                      />
                    </div>

                    {/* Categoría */}
                    <div className="space-y-0.5">
                      <Select
                        value={row.categoryId}
                        onValueChange={(v) => handleRowChange(row.id, "categoryId", v)}
                      >
                        <SelectTrigger className="rounded-xl h-10 text-xs font-bold">
                          <SelectValue placeholder="Categoría" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id} className="rounded-xl text-xs">
                              <div className="flex items-center gap-2">
                                <DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-3.5 w-3.5" />
                                {cat.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Fecha */}
                    <div className="space-y-0.5">
                      <Input
                        type="date"
                        value={row.date}
                        onChange={(e) => handleRowChange(row.id, "date", e.target.value)}
                        className="rounded-xl h-10 text-xs font-bold"
                      />
                    </div>
                  </div>

                  {/* Eliminar Fila */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRow(row.id)}
                    className="h-9 w-9 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl shrink-0 self-end md:self-center"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex justify-between items-center border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddRow}
              className="rounded-xl font-bold text-xs gap-1.5 border-dashed border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <Plus className="h-4 w-4" /> Añadir otro movimiento
            </Button>

            <span className="text-xs font-bold text-slate-400">
              Total filas: {rows.length}
            </span>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl font-black bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 fill-current" /> Guardar Todos los Movimientos
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BulkTransactionsDialog;