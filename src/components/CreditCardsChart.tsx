"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CardData } from "@/pages/Dashboard"; // Importar la interfaz CardData
import { cn } from "@/lib/utils";

interface CreditCardsChartProps {
  cards: CardData[];
}

const CreditCardsChart: React.FC<CreditCardsChartProps> = ({ cards }) => {
  const chartData = cards
    .filter((card) => card.type === "credit" && card.credit_limit !== undefined)
    .map((card) => ({
      name: card.name,
      "Límite de Crédito": card.credit_limit,
      "Deuda Actual": card.current_balance,
    }));

  if (chartData.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        No hay tarjetas de crédito con límite definido para mostrar en el gráfico.
      </div>
    );
  }

  return (
    <div className={cn("h-[300px] w-full")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis dataKey="name" className="fill-muted-foreground text-xs" />
          <YAxis className="fill-muted-foreground text-xs" />
          <Tooltip
            formatter={(value: number) => `$${value.toFixed(2)}`}
            labelFormatter={(label: string) => `Tarjeta: ${label}`}
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              borderColor: "hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            itemStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Legend />
          <Bar dataKey="Límite de Crédito" fill="hsl(var(--primary))" />
          <Bar dataKey="Deuda Actual" fill="hsl(var(--destructive))" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CreditCardsChart;