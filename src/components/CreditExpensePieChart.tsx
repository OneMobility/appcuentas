"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import PieChartLegend from "./PieChartLegend";
import PieChartTooltip from "./PieChartTooltip";

interface PieChartData {
  id: string;
  name: string;
  value: number;
  color: string;
  icon: string;
}

interface CreditExpensePieChartProps {
  title: string;
  data: PieChartData[];
}

const CreditExpensePieChart: React.FC<CreditExpensePieChartProps> = ({ title, data }) => {
  const totalValue = data.reduce((sum, entry) => sum + entry.value, 0);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <p className="text-muted-foreground text-center">No hay datos para mostrar en este gráfico de {title.toLowerCase()}.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<PieChartTooltip />} />
          <Legend content={<PieChartLegend />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CreditExpensePieChart;