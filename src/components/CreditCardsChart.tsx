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
  Cell,
} from "recharts";
import { CardData } from "@/pages/Dashboard";
import { cn } from "@/lib/utils";

interface CreditCardsChartProps {
  cards: CardData[];
}

const CreditCardsChart: React.FC<CreditCardsChartProps> = ({ cards }) => {
  const chartData = cards
    .filter((card) => card.type === "credit" && card.credit_limit !== undefined)
    .map((card) => {
      const limit = card.credit_limit || 0;
      const debt = card.current_balance;
      const usedWithinLimit = Math.min(debt, limit);
      const overLimit = Math.max(0, debt - limit);
      const available = Math.max(0, limit - debt);

      return {
        name: card.name,
        "Usado": usedWithinLimit,
        "Excedido": overLimit,
        "Disponible": available,
        totalDebt: debt,
        limit: limit,
      };
    });

  if (chartData.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-10">
        No hay tarjetas de crédito para mostrar.
      </div>
    );
  }

  return (
    <div className={cn("h-[350px] w-full")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          stackOffset="none"
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
          <XAxis 
            dataKey="name" 
            className="fill-muted-foreground text-[10px] md:text-xs" 
            tick={{ fill: 'hsl(var(--foreground))' }}
          />
          <YAxis 
            className="fill-muted-foreground text-[10px]" 
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip
            cursor={{ fill: 'transparent' }}
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-background border border-border p-3 rounded-xl shadow-lg text-xs">
                    <p className="font-bold mb-1 border-b pb-1">{label}</p>
                    <p className="flex justify-between gap-4"><span>Límite:</span> <b>${data.limit.toFixed(2)}</b></p>
                    <p className="flex justify-between gap-4"><span>Deuda Total:</span> <b>${data.totalDebt.toFixed(2)}</b></p>
                    {data.Excedido > 0 && (
                      <p className="text-destructive font-bold flex justify-between gap-4">
                        <span>Excedido:</span> <span>${data.Excedido.toFixed(2)}</span>
                      </p>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
          {/* Stacked Bars: Usado + Excedido */}
          <Bar dataKey="Usado" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Excedido" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
          {/* Línea de referencia opcional o barra de disponible si se prefiere */}
          <Bar dataKey="Disponible" stackId="a" fill="hsl(var(--muted))" fillOpacity={0.3} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CreditCardsChart;