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
  Customized,
} from "recharts";
import { CardData } from "@/pages/Dashboard";

interface CreditCardsChartProps {
  cards: CardData[];
}

// Componente personalizado para las etiquetas de montos
const CustomLabelsComponent = (props: any) => {
  const { data, width, height, x, y, yAxis } = props;

  if (!yAxis || !yAxis.scale) return null;

  const scale = yAxis.scale;

  return (
    <g>
      {data.map((entry: any, index: number) => {
        const barX = x + (index * (width / data.length)) + (width / data.length / 2); // Approximate center of the bar
        const barWidth = width / data.length; // Approximate width of each bar

        // Calculate Y position for totalCreditLimit
        const creditLimitY = scale(entry.totalCreditLimit);
        // Calculate Y position for totalCurrentBalance
        const currentBalanceY = scale(entry.totalCurrentBalance);

        return (
          <g key={`label-${index}`}>
            {/* Label for Total Credit Limit */}
            {entry.totalCreditLimit > 0 && (
              <text
                x={entry.x + entry.width / 2} // Use bar's x and width for precise centering
                y={creditLimitY - 5} // Slightly above the credit limit line
                fill="#666"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
              >
                ${entry.totalCreditLimit.toFixed(2)}
              </text>
            )}
            {/* Label for Total Current Balance (Debt) */}
            {entry.totalCurrentBalance > 0 && (
              <text
                x={entry.x + entry.width / 2} // Use bar's x and width for precise centering
                y={currentBalanceY - 5} // Slightly above the current balance line
                fill="#333"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fontWeight="bold"
              >
                ${entry.totalCurrentBalance.toFixed(2)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
};


const CreditCardsChart: React.FC<CreditCardsChartProps> = ({ cards }) => {
  const chartData = cards
    .filter((card) => card.type === "credit" && card.credit_limit !== undefined)
    .map((card) => {
      const creditLimit = card.credit_limit!;
      const currentBalance = card.current_balance;

      let availableWithinLimit = 0;
      let debtWithinLimit = 0;
      let debtOverLimit = 0;

      if (currentBalance <= creditLimit) {
        debtWithinLimit = currentBalance;
        availableWithinLimit = creditLimit - currentBalance;
      } else { // currentBalance > creditLimit
        debtWithinLimit = creditLimit; // The part of debt that fills the limit
        debtOverLimit = currentBalance - creditLimit; // The part that goes over
      }

      return {
        name: card.name,
        lastFourDigits: `****${card.last_four_digits}`, // For X-axis label
        color: card.color,
        availableWithinLimit: availableWithinLimit,
        debtWithinLimit: debtWithinLimit,
        debtOverLimit: debtOverLimit,
        totalCreditLimit: creditLimit,
        totalCurrentBalance: currentBalance,
      };
    });

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
        barCategoryGap="10%" // Adjust as needed
        barGap={0} // Ensure bars within a category are not separated
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="lastFourDigits" />
        <YAxis />
        <Tooltip formatter={(value: number, name: string) => {
            if (name === "Crédito Disponible") return [`Crédito Disponible: $${value.toFixed(2)}`];
            if (name === "Deuda Dentro del Límite") return [`Deuda Dentro del Límite: $${value.toFixed(2)}`];
            if (name === "Deuda Excedida") return [`Deuda Excedida: $${value.toFixed(2)}`];
            return value;
        }} />
        <Legend />
        {/* Segmento de crédito disponible (color de la tarjeta) */}
        <Bar dataKey="availableWithinLimit" stackId="a" name="Crédito Disponible">
          {chartData.map((entry, index) => (
            <Cell key={`cell-available-${index}`} fill={entry.color} />
          ))}
        </Bar>
        {/* Segmento de deuda dentro del límite (rojo) */}
        <Bar dataKey="debtWithinLimit" stackId="a" name="Deuda Dentro del Límite" fill="#FF6B6B">
          {chartData.map((entry, index) => (
            <Cell key={`cell-debt-within-${index}`} fill="#FF6B6B" />
          ))}
        </Bar>
        {/* Segmento de deuda excedida (rojo) */}
        <Bar dataKey="debtOverLimit" stackId="a" name="Deuda Excedida" fill="#FF6B6B">
          {chartData.map((entry, index) => (
            <Cell key={`cell-debt-over-${index}`} fill="#FF6B6B" />
          ))}
        </Bar>
        <Customized component={CustomLabelsComponent} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default CreditCardsChart;