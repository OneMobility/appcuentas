"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const FixedSavingTipCard: React.FC = () => {
  return (
    <Card className={cn("relative p-4 shadow-md border-l-4 border-purple-500 bg-purple-50 text-purple-800")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-purple-800">
          Recuerda
        </CardTitle>
        <Lock className="h-4 w-4 text-purple-600" />
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold">
          Aparta tu dinero.
        </div>
        <p className="text-xs text-purple-700 mt-1">
          En algunas tarjetas te permite congelarlo y te dan algunas ganancias que te puede ayudar a avanzar más rápido.
        </p>
      </CardContent>
    </Card>
  );
};

export default FixedSavingTipCard;