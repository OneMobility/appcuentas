"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, Calendar, RefreshCw, AlertCircle, CreditCard, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { useCategoryContext } from "@/context/CategoryContext";
import { showError, showSuccess } from "@/utils/toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const RecurringExpenses = () => {
  const { user } = useSession();
  const { expenseCategories } = useCategoryContext();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "", amount: "", category_id: "", next_date: "", frequency: "monthly"
  });

  const fetchExpenses = async () => {
    if (!user) return;
    const { data } = await supabase.from('recurring_expenses').select('*').eq('user_id', user.id);
    setExpenses(data || []);
  };

  useEffect(() => { fetchExpenses(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from('recurring_expenses').insert({
      user_id: user.id,
      name: formData.name,
      amount: parseFloat(formData.amount),
      category_id: formData.category_id || null,
      next_date: formData.next_date,
      frequency: formData.frequency
    });

    if (error) showError("Error");
    else {
      showSuccess("Gasto recurrente añadido");
      setIsAddDialogOpen(false);
      fetchExpenses();
    }
  };

  const deleteExpense = async (id: string) => {
    await supabase.from('recurring_expenses').delete().eq('id', id);
    fetchExpenses();
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gastos Recurrentes</h1>
        <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-xl h-10">
          <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Gasto
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/10 border-primary/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase opacity-60">Total Fijo Mensual</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-black">${expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}</div></CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl shadow-sm border-none bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Nombre</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Próximo Pago</TableHead>
                <TableHead className="text-right pr-6">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No hay gastos recurrentes.</TableCell></TableRow>
              ) : (
                expenses.map(exp => (
                  <TableRow key={exp.id}>
                    <TableCell className="pl-6 font-bold">{exp.name}</TableCell>
                    <TableCell className="font-black text-red-600">${exp.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <Calendar className="h-3 w-3" /> {format(parseISO(exp.next_date), "dd MMM", { locale: es })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="icon" onClick={() => deleteExpense(exp.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Nuevo Gasto Fijo</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Nombre (ej. Netflix)</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="rounded-xl" /></div>
            <div className="grid gap-2"><Label>Monto</Label><Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required className="rounded-xl" /></div>
            <div className="grid gap-2"><Label>Próxima Fecha</Label><Input type="date" value={formData.next_date} onChange={e => setFormData({...formData, next_date: e.target.value})} required className="rounded-xl" /></div>
            <div className="grid gap-2">
              <Label>Categoría</Label>
              <Select value={formData.category_id} onValueChange={v => setFormData({...formData, category_id: v})}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>{expenseCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" className="w-full rounded-xl h-11 font-bold">Guardar Recurrente</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecurringExpenses;