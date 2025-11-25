"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

const savingTips = [
  "Establece metas de ahorro claras y realistas.",
  "Automatiza tus ahorros para que sean consistentes.",
  "Crea un presupuesto y síguelo para controlar tus gastos.",
  "Evita las compras impulsivas, espera 24 horas antes de comprar.",
  "Busca ofertas y descuentos antes de realizar una compra.",
  "Cocina en casa más a menudo para reducir gastos en comida.",
  "Revisa tus suscripciones y cancela las que no uses.",
  "Ahorra el cambio de tus compras diarias.",
  "Invierte en tu educación financiera para tomar mejores decisiones.",
  "Compara precios antes de comprar cualquier producto o servicio.",
  "Reduce el consumo de energía en casa para ahorrar en facturas.",
  "Planifica tus comidas para evitar desperdicios y gastos extra.",
  "Utiliza el transporte público o camina para ahorrar en gasolina.",
  "Repara en lugar de reemplazar cuando sea posible.",
  "Establece un día a la semana sin gastos (No-Spend Day).",
];

const RandomSavingTipCard: React.FC = () => {
  const [currentTip, setCurrentTip] = useState("");

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * savingTips.length);
    setCurrentTip(savingTips[randomIndex]);
  }, []);

  return (
    <Card className={cn("relative p-4 shadow-md border-l-4 border-blue-500 bg-blue-50 text-blue-800")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-blue-800">
          Consejo de Ahorro del Día
        </CardTitle>
        <Lightbulb className="h-4 w-4 text-blue-600" />
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold">{currentTip}</div>
        <p className="text-xs text-blue-700 mt-1">
          ¡Pequeños hábitos, grandes ahorros!
        </p>
      </CardContent>
    </Card>
  );
};

export default RandomSavingTipCard;