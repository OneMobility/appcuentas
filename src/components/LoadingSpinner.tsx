"use client";

import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <img
        src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Noticias%20Region.gif"
        alt="Cargando..."
        className="h-32 w-32 md:h-48 md:w-48 object-contain"
      />
    </div>
  );
};

export default LoadingSpinner;