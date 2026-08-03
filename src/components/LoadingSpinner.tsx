"use client";

import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <img
        src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/ChatGPT%20Image%203%20ago%202026,%2003_48_36%20p.m..png"
        alt="Oinkash"
        className="h-48 w-48 md:h-64 md:w-64 object-contain animate-pulse"
      />
    </div>
  );
};

export default LoadingSpinner;