"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Trash2, Eye, Phone, Edit } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { evaluateExpression } from "@/utils/math-helpers";
import { useNavigate } from "react-router-dom";

interface Debtor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  phone?: string;
}

const Debtors = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [isAddDebtorDialogOpen, setIsAddDebtorDialogOpen] = useState(false);
  const [isEditDebtorDialogOpen, setIsEditDebtorDialogOpen] = useState(false);
  const [editingDebtor, setEditingDebtor] = useState<Debtor | null>(null);
  const [newDebtor, setNewDebtor] = useState({ name: "", initial_balance: "", phone: "" });
  const [searchTerm, setSearchTerm] = useState("");

  const fetchDebtors = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('debtors')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) showError('Error al cargar deudores: ' + error.message);
    else setDebtors(data || []);
  };

  useEffect(() => {
    fetchDebtors();
  }, [user]);

  const handleSubmitNewDebtor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let initialBalance: number;
    if (newDebtor.initial_balance.startsWith('=')) {
      initialBalance = evaluateExpression(newDebtor.initial_balance.substring(1)) || 0;
    } else {
      initialBalance = parseFloat(newDebtor.initial_balance);
    }

    if (isNaN(initialBalance) || initialBalance <= 0) {
      showError("Monto inválido.");
      return;
    }

    const { data, error } = await supabase
      .from('debtors')
      .insert({
        user_id: user.id,
        name: newDebtor.name,
        initial_balance: initialBalance,
        current_balance: initialBalance,
        phone: newDebtor.phone.trim() || null,
      })
      .select();

    if (error) showError('Error: ' + error.message);
    else {
      setDebtors((prev) => [...prev, data[0]]);
      setIsAddDebtorDialogOpen(false);
      setNewDebtor({ name: "", initial_balance: "", phone: "" });
      showSuccess("Deudor registrado.");
    }
  };

  const handleOpenEditDialog = (debtor: Debtor) => {
    setEditingDebtor(debtor);
    setNewDebtor({
      name: debtor.name,
      initial_balance: debtor.initial_balance.toString(),
      phone: debtor.phone || "",
    });
    setIsEditDebtorDialogOpen(true);
  };

  const handleUpdateDebtor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingDebtor) return;

    const { data, error } = await supabase
      .from('debtors')
      .update({
        name: newDebtor.name.trim(),
        phone: newDebtor.phone.trim() || null,
      })
      .eq('id', editingDebtor.id)
      .select();

    if (error) showError('Error: ' + error.message);
    else {
      setDebtors((prev) => prev.map(d => d.id === editingDebtor.id ? data[0] : d));
      setIsEditDebtorDialogOpen(false);
      setEditingDebtor(null);
      setNewDebtor({ name: "", initial_balance: "", phone: "" });
      showSuccess("Deudor actualizado.");
    }
  };

  const handleDeleteDebtor = async (id: string) => {
    const { error } = await supabase.from('debtors').delete().eq('id', id);
    if (error) showError('Error: ' + error.message);
    else {
      setDebtors(prev => prev.filter(d => d.id !== id));
      showSuccess("Deudor eliminado.");
    }
  };

  const filteredDebtors = debtors.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const activeDebtors = filteredDebtors.filter(d => d.current_balance > 0);
  const completedDebtors = filteredDebtors.filter(d => d.current_balance <= 0);

  const DebtorTable = ({ list }: { list: Debtor[] }) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Saldo Inicial</TableHead>
            <TableHead>Saldo Actual</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((debtor) => (
            <TableRow key={debtor.id}>
              <TableCell className="font-medium">{debtor.name}</TableCell>
              <TableCell>${debtor.initial_balance.toFixed(2)}</TableCell>
              <TableCell>${debtor.current_balance.toFixed(2)}</TableCell>
              <TableCell>{debtor.phone || "-"}</TableCell>
              <TableCell className="text-right flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => navigate(`/debtors/${debtor.id}`)}>
                  <Eye className="h-4 w-4 mr-1" /> Detalles
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(debtor)}>
                  <Edit className="h-4 w-4 mr-1" /> Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar deudor?</AlertDialogTitle>
                      <AlertDialogDescription>Se borrará todo su historial permanentemente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteDebtor(debtor.id)}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Los que te deben</h1>

      <Card className="border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800">
        <CardHeader><CardTitle>Saldo Total de Deudores</CardTitle></CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">${activeDebtors.reduce((s, d) => s + d.current_balance, 0).toFixed(2)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lista de Deudores</CardTitle>
          <Dialog open={isAddDebtorDialogOpen} onOpenChange={setIsAddDebtorDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><PlusCircle className="h-4 w-4 mr-1" /> Añadir Deudor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo Deudor</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmitNewDebtor} className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Nombre</Label>
                  <Input value={newDebtor.name} onChange={e => setNewDebtor({...newDebtor, name: e.target.value})} required />
                </div>
                <div className="grid gap-2">
                  <Label>Saldo Inicial</Label>
                  <Input value={newDebtor.initial_balance} onChange={e => setNewDebtor({...newDebtor, initial_balance: e.target.value})} placeholder="Ej. 100" required />
                </div>
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" /> Teléfono (Opcional)
                  </Label>
                  <Input 
                    value={newDebtor.phone} 
                    onChange={e => setNewDebtor({...newDebtor, phone: e.target.value})} 
                    placeholder="Ej. 521234567890" 
                  />
                  <p className="text-[10px] text-muted-foreground">Incluye código de país sin el signo + (ej. 52 para México).</p>
                </div>
                <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mb-4 max-w-sm" />
          <Tabs defaultValue="active">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="active">Activos ({activeDebtors.length})</TabsTrigger>
              <TabsTrigger value="completed">Completados ({completedDebtors.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active"><DebtorTable list={activeDebtors} /></TabsContent>
            <TabsContent value="completed"><DebtorTable list={completedDebtors} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Diálogo de Edición */}
      <Dialog open={isEditDebtorDialogOpen} onOpenChange={setIsEditDebtorDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Deudor</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdateDebtor} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={newDebtor.name} onChange={e => setNewDebtor({...newDebtor, name: e.target.value})} required />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> Teléfono (Opcional)
              </Label>
              <Input 
                value={newDebtor.phone} 
                onChange={e => setNewDebtor({...newDebtor, phone: e.target.value})} 
                placeholder="Ej. 521234567890" 
              />
            </div>
            <DialogFooter><Button type="submit">Actualizar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Debtors;