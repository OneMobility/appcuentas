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
import { Category } from "@/context/CategoryContext";

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

interface CategoryPieChartProps {
  data: CategoryData[];
  title: string;
}

const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ data, title }) => {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground text-sm border-2 border-dashed rounded-2xl">
        <p>Sin datos para {title.toLowerCase()}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[300px] w-full">
      <h3 className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h3 >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              borderColor: "hsl(var(--border))",
              borderRadius: "1rem",
              fontSize: "12px",
            }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Monto"]}
          />
          <Legend 
            verticalAlign="bottom" 
            align="center" 
            layout="horizontal"
            iconSize={8}
            wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CategoryPieChart;