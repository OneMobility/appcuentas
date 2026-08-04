"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PigMerge from "@/components/minigames/PigMerge";
import { Card } from "@/components/ui/card";

const PigMergePage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/minigames')} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-black tracking-tighter">Pig Merge</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Desafío de Ahorro</p>
        </div>
      </div>

      <Card className="rounded-[3rem] border-none shadow-soft bg-white overflow-hidden p-6 md:p-10">
        <PigMerge />
      </Card>
    </div>
  );
};

export default PigMergePage;