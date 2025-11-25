"use client";

import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <img
        src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmthdW56Y3owd2hwbHRyZ2h1dmpldXF6eTM4ZXlqMGZ3bTFqNjEybCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/AM5YiTyIjC61ueuRxC/giphy.gif"
        alt="Cargando..."
        className="h-24 w-24"
      />
    </div>
  );
};

export default LoadingSpinner;