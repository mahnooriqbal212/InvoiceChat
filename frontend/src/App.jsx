import { Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PasteChat from "@/pages/PasteChat";
import Dashboard from "@/pages/Dashboard";
import AgentQueue from "@/pages/AgentQueue";
import PayInvoice from "@/pages/PayInvoice";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<PasteChat />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/agent" element={<AgentQueue />} />
      </Route>
      {/* Clients open this from their pay link, so it stays outside the app layout */}
      <Route path="/pay/:invoiceId" element={<PayInvoice />} />
    </Routes>
  );
}
