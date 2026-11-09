import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PasteChat from "@/pages/PasteChat";
import AgentQueue from "@/pages/AgentQueue";
import PayInvoice from "@/pages/PayInvoice";

// The dashboard includes AG Grid (large), so it loads only when someone opens it
const Dashboard = lazy(() => import("@/pages/Dashboard"));

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<PasteChat />} />
        <Route
          path="/dashboard"
          element={
            <Suspense fallback={null}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route path="/agent" element={<AgentQueue />} />
      </Route>
      {/* Clients open this from their pay link, so it stays outside the app layout */}
      <Route path="/pay/:invoiceId" element={<PayInvoice />} />
    </Routes>
  );
}
