"use client";

import React from "react";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";

interface LegendPayload {
  value: string; // Category name
  payload: {
    id: string;
    name: string;
    value: number;
    color: string;
    icon: string;
  };
}

interface PieChartLegendProps {
  payload?: LegendPayload[];
}

const PieChartLegend: React.FC<PieChartLegendProps> = ({ payload }) => {
  if (!payload || payload.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
      {payload.map((entry, index) => (
        <li key={`item-${index}`} className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.payload.color }} />
          <DynamicLucideIcon iconName={entry.payload.icon} className="h-3 w-3" style={{ color: entry.payload.color }} />
          <span>{entry.payload.name}: ${entry.payload.value.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
};

export default PieChartLegend;