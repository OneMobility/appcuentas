import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Cash from "./pages/Cash";
import Debtors from "./pages/Debtors";
import DebtorDetailsPage from "./pages/DebtorDetailsPage";
import Creditors from "./pages/Creditors";
import CreditorDetailsPage from "./pages/CreditorDetailsPage";
import Cards from "./pages/Cards";
import CardDetailsPage from "./pages/CardDetailsPage";
import Categories from "./pages/Categories";
import Savings from "./pages/Savings";
import SharedBudgets from "./pages/SharedBudgets";
import CreateSharedBudget from "./pages/CreateSharedBudget";
import EditSharedBudget from "./pages/EditSharedBudget";
import ShoppingList from "./pages/ShoppingList";
import RecurringExpenses from "./pages/RecurringExpenses";
import Minigames from "./pages/Minigames";
import PigMergePage from "./pages/PigMergePage";
import CoinCatchPage from "./pages/CoinCatchPage";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import { CategoryProvider } from "./context/CategoryContext";
import { SessionProvider, useSession } from "./context/SessionContext";
import CardNotifications from "./components/CardNotifications";
import AppUpdater from "./components/AppUpdater";
import LoadingSpinner from "./components/LoadingSpinner";
import React from "react";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useSession();
  
  if (isLoading) return <LoadingSpinner />;
  
  if (!session) return <Navigate to="/login" replace />;
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
              <AppUpdater />
              <CardNotifications />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ProtectedRoute><ResetPassword /></ProtectedRoute>} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                
                {/* Rutas de Minijuegos INMERSIVOS (Fuera del Layout normal) */}
                <Route path="/minigames/pig-merge" element={<ProtectedRoute><PigMergePage /></ProtectedRoute>} />
                <Route path="/minigames/coin-catch" element={<ProtectedRoute><CoinCatchPage /></ProtectedRoute>} />

                {/* Rutas con Menú y Navegación estándar */}
                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
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
                  <Route path="/shared-budgets/edit/:budgetId" element={<EditSharedBudget />} />
                  <Route path="/recurring" element={<RecurringExpenses />} />
                  <Route path="/shopping-list" element={<ShoppingList />} />
                  <Route path="/minigames" element={<Minigames />} />
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