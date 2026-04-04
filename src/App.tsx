import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Children from "./pages/Children";
import Visits from "./pages/Visits";
import Growth from "./pages/Growth";
import Vaccinations from "./pages/Vaccinations";
import Prescriptions from "./pages/Prescriptions";
import Documents from "./pages/Documents";
import Billing from "./pages/Billing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/children" element={<Children />} />
              <Route path="/visits" element={<Visits />} />
              <Route path="/growth" element={<Growth />} />
              <Route path="/vaccinations" element={<Vaccinations />} />
              <Route path="/prescriptions" element={<Prescriptions />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/billing" element={<Billing />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
