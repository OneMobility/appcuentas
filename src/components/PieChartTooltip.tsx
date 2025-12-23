"use client";

import React from "react";
import { TooltipProps } from "recharts";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

interface CustomTooltipPayload {
  name: string;
  value: number;
  payload: {
    name: string;
    value: number;
    color: string;
    icon: string;
  };
  percent: number;
}

const PieChartTooltip: React.FC<TooltipProps<ValueType, NameType>> = ({
  active,
  payload,
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as CustomTooltipPayload['payload'];
    const percentage = (payload[0].percent * 100).toFixed(2);

    return (
      <div className="rounded-md border bg-popover p-2 text-popover-foreground shadow-sm">
        <p className="text-sm font-semibold">{data.name}</p>
        <p className="text-xs text-muted-foreground">
          Monto: ${data.value.toFixed(2)} ({percentage}%)
        </p>
      </div>
    );
  }

  return null;
};

export default PieChartTooltip;