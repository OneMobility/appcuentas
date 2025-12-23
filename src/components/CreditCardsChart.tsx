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
  LabelList,
  Cell,
} from "recharts";
import { CardData } from "@/pages/Dashboard";

interface CreditCardsChartProps {
  cards: CardData[];
}

// Etiqueta personalizada para el límite de crédito total
const CustomCreditLimitLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (value === 0) return null; // No mostrar etiqueta si el límite es 0
  return (
    <text x={x + width / 2} y={y - 5} fill="#666" textAnchor="middle" dominantBaseline="central" fontSize={12}>
      Límite: ${value.toFixed(2)}
    </text>
  );
};

// Etiqueta personalizada para la deuda total
const CustomDebtLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (value === 0) return null; // No mostrar etiqueta de deuda si no hay deuda
  return (
    <text x={x + width / 2} y={y - 5} fill="#333" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
      Deuda: ${value.toFixed(2)}
    </text>
  );
};

const CreditCardsChart: React.FC<CreditCardsChartProps> = ({ cards }) => {
  const chartData = cards
    .filter((card) => card.type === "credit" && card.credit_limit !== undefined)
    .map((card) => ({
      name: card.name,
      color: card.color,
      creditLimit: card.credit_limit!,
      currentBalance: card.current_balance,
    }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        margin={{
          top: 30,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip formatter={(value: number, name: string) => {
            if (name === "Límite de Crédito") return [`Límite de Crédito: $${value.toFixed(2)}`];
            if (name === "Deuda Actual") return [`Deuda Actual: $${value.toFixed(2)}`];
            return value;
        }} />
        <Legend />
        {/* Barra base que representa el límite de crédito */}
        <Bar dataKey="creditLimit" name="Límite de Crédito">
          {chartData.map((entry, index) => (
            <Cell key={`cell-limit-${index}`} fill={entry.color} />
          ))}
          <LabelList dataKey="creditLimit" content={CustomCreditLimitLabel} />
        </Bar>
        {/* Barra superpuesta que representa el saldo actual (deuda) */}
        <Bar dataKey="currentBalance" name="Deuda Actual" fill="#FF6B6B"> {/* Opacidad eliminada */}
          <LabelList dataKey="currentBalance" content={CustomDebtLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default CreditCardsChart;