"use client";

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/context/SessionContext";
import LoadingSpinner from "@/components/LoadingSpinner"; // Importar LoadingSpinner

const Index = () => {
  const navigate = useNavigate();
  const { session, isLoading } = useSession();

  useEffect(() => {
    if (!isLoading) {
      if (session) {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    }
  }, [session, isLoading, navigate]);

  // El LoadingSpinner global de SessionProvider ya se encarga de la pantalla de carga
  // Este componente solo necesita redirigir una vez que la sesión se ha cargado.
  return null;
};

export default Index;