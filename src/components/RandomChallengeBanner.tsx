"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

const challenges = [
  "¡Ahorra $50 esta semana cocinando en casa!",
  "¡Evita compras impulsivas por 3 días!",
  "¡Encuentra un gasto innecesario y elimínalo!",
  "¡Ahorra el cambio de todas tus compras por un día!",
  "¡Prepara tu café en casa toda la semana!",
  "¡Vende algo que ya no uses y ahorra el dinero!",
  "¡Establece un presupuesto para tu próxima salida y cúmplelo!",
  "¡Ahorra $100 extra este mes en tu meta!",
  "¡Revisa tus suscripciones y cancela una que no uses!",
  "¡Camina o usa bicicleta en lugar del transporte por un día!",
];

const RandomChallengeBanner: React.FC = () => {
  const [currentChallenge, setCurrentChallenge] = useState("");

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * challenges.length);
    setCurrentChallenge(challenges[randomIndex]);
  }, []);

  return (
    <Card className={cn("relative p-4 shadow-md border-l-4 border-purple-500 bg-purple-50 text-purple-800")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-purple-800">
          Reto de Ahorro del Día
        </CardTitle>
        <Lightbulb className="h-4 w-4 text-purple-600" />
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold">{currentChallenge}</div>
        <p className="text-xs text-purple-700 mt-1">
          ¡Pequeños cambios hacen grandes diferencias!
        </p>
      </CardContent>
    </Card>
  );
};

export default RandomChallengeBanner;