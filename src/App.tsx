import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"; // Importar Outlet
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Cash from "./pages/Cash";
import Debtors from "./pages/Debtors";
import Creditors from "./pages/Creditors";
import Cards from "./pages/Cards";
import CardDetailsPage from "./pages/CardDetailsPage";
import Categories from "./pages/Categories";
import Savings from "./pages/Savings";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { CategoryProvider } from "./context/CategoryContext";
import { SessionProvider, useSession } from "./context/SessionContext";
import CardNotifications from "./components/CardNotifications";
import Challenges from "./pages/Challenges"; // Nuevo import

const queryClient = new QueryClient();

// Componente de envoltura para rutas protegidas
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
                  <Route path="/creditors" element={<Creditors />} />
                  <Route path="/cards" element={<Cards />} />
                  <Route path="/cards/:cardId" element={<CardDetailsPage />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/savings" element={<Outlet />}> {/* Ruta padre para Ahorrando y Retos */}
                    <Route index element={<Savings />} /> {/* Contenido de Savings en /savings */}
                    <Route path="challenges" element={<Challenges />} /> {/* Contenido de Challenges en /savings/challenges */}
                  </Route>
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
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