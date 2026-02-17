import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Cash from "./pages/Cash";
import Debtors from "./pages/Debtors";
import DebtorDetailsPage from "./pages/DebtorDetailsPage"; // Nueva página
import Creditors from "./pages/Creditors";
import CreditorDetailsPage from "./pages/CreditorDetailsPage"; // Nueva página
import Cards from "./pages/Cards";
import CardDetailsPage from "./pages/CardDetailsPage";
import Categories from "./pages/Categories";
import Savings from "./pages/Savings";
import SharedBudgets from "./pages/SharedBudgets";
import CreateSharedBudget from "./pages/CreateSharedBudget";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { CategoryProvider } from "./context/CategoryContext";
import { SessionProvider, useSession } from "./context/SessionContext";
import CardNotifications from "./components/CardNotifications";
import React from "react";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Cargando...</h1>
          <p className="text-xl text-gray-600">Verificando sesión.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SessionProvider>
            <CategoryProvider>
              <CardNotifications />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/cash" element={<Cash />} />
                  <Route path="/debtors" element={<Debtors />} />
                  <Route path="/debtors/:debtorId" element={<DebtorDetailsPage />} />
                  <Route path="/creditors" element={<Creditors />} />
                  <Route path="/creditors/:creditorId" element={<CreditorDetailsPage />} />
                  <Route path="/cards" element={<Cards />} />
                  <Route path="/cards/:cardId" element={<CardDetailsPage />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/savings" element={<Savings />} />
                  <Route path="/shared-budgets" element={<SharedBudgets />} />
                  <Route path="/shared-budgets/create" element={<CreateSharedBudget />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </CategoryProvider>
          </SessionProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;