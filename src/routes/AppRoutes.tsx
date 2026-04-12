import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Children from "@/pages/Children";
import Visits from "@/pages/Visits";
import Growth from "@/pages/Growth";
import Vaccinations from "@/pages/Vaccinations";
import Prescriptions from "@/pages/Prescriptions";
import Documents from "@/pages/Documents";
import Billing from "@/pages/Billing";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import { ProtectedRoute } from "@/lib/supabase/ProtectedRoute";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
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
      </Route>
      <Route path="/login" element={<Auth />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
