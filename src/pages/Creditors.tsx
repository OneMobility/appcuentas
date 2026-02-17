"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Trash2, Eye } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { evaluateExpression } from "@/utils/math-helpers";
import { useNavigate } from "react-router-dom";

interface Creditor {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
}

const Creditors = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [isAddCreditorDialogOpen, setIsAddCreditorDialogOpen] = useState(false);
  const [newCreditor, setNewCreditor] = useState({ name: "", initial_balance: "" });
  const [searchTerm, setSearchTerm] = useState("");

  const fetchCreditors = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('creditors')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) showError('Error al cargar acreedores: ' + error.message);
    else setCreditors(data || []);
  };

  useEffect(() => {
    fetchCreditors();
  }, [user]);

  const handleSubmitNewCreditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let initialBalance: number;
    if (newCreditor.initial_balance.startsWith('=')) {
      initialBalance = evaluateExpression(newCreditor.initial_balance.substring(1)) || 0;
    } else {
      initialBalance = parseFloat(newCreditor.initial_balance);
    }

    if (isNaN(initialBalance) || initialBalance <= 0) {
      showError("Monto inválido.");
      return;
    }

    const { data, error } = await supabase
      .from('creditors')
      .insert({
        user_id: user.id,
        name: newCreditor.name,
        initial_balance: initialBalance,
        current_balance: initialBalance,
      })
      .select();

    if (error) showError('Error: ' + error.message);
    else {
      setCreditors((prev) => [...prev, data[0]]);
      setIsAddCreditorDialogOpen(false);
      setNewCreditor({ name: "", initial_balance: "" });
      showSuccess("Acreedor registrado.");
    }
  };

  const handleDeleteCreditor = async (id: string) => {
    const { error } = await supabase.from('creditors').delete().eq('id', id);
    if (error) showError('Error: ' + error.message);
    else {
      setCreditors(prev => prev.filter(c => c.id !== id));
      showSuccess("Acreedor eliminado.");
    }
  };

  const filteredCreditors = creditors.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const activeCreditors = filteredCreditors.filter(c => c.current_balance > 0);
  const completedCreditors = filteredCreditors.filter(c => c.current_balance <= 0);

  const CreditorTable = ({ list }: { list: Creditor[] }) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Saldo Inicial</TableHead>
            <TableHead>Saldo Actual</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((creditor) => (
            <TableRow key={creditor.id}>
              <TableCell className="font-medium">{creditor.name}</TableCell>
              <TableCell>${creditor.initial_balance.toFixed(2)}</TableCell>
              <TableCell>${creditor.current_balance.toFixed(2)}</TableCell>
              <TableCell className="text-right flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => navigate(`/creditors/${creditor.id}`)}>
                  <Eye className="h-4 w-4 mr-1" /> Detalles
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar acreedor?</AlertDialogTitle>
                      <AlertDialogDescription>Se borrará todo su historial permanentemente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteCreditor(creditor.id)}>Eliminar</AlertDialogAction>
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
      <h1 className="text-3xl font-bold">A quien le debes</h1>

      <Card className="border-l-4 border-red-500 bg-red-50 text-red-800">
        <CardHeader><CardTitle>Saldo Total de Acreedores</CardTitle></CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">${activeCreditors.reduce((s, c) => s + c.current_balance, 0).toFixed(2)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lista de Acreedores</CardTitle>
          <Dialog open={isAddCreditorDialogOpen} onOpenChange={setIsAddCreditorDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><PlusCircle className="h-4 w-4 mr-1" /> Añadir Acreedor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo Acreedor</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmitNewCreditor} className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Nombre</Label>
                  <Input value={newCreditor.name} onChange={e => setNewCreditor({...newCreditor, name: e.target.value})} required />
                </div>
                <div className="grid gap-2">
                  <Label>Saldo Inicial</Label>
                  <Input value={newCreditor.initial_balance} onChange={e => setNewCreditor({...newCreditor, initial_balance: e.target.value})} placeholder="Ej. 100" required />
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
              <TabsTrigger value="active">Activos ({activeCreditors.length})</TabsTrigger>
              <TabsTrigger value="completed">Completados ({completedCreditors.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active"><CreditorTable list={activeCreditors} /></TabsContent>
            <TabsContent value="completed"><CreditorTable list={completedCreditors} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Creditors;