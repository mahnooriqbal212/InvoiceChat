import { Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PasteChat from "@/pages/PasteChat";
import Dashboard from "@/pages/Dashboard";
import AgentQueue from "@/pages/AgentQueue";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<PasteChat />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/agent" element={<AgentQueue />} />
      </Route>
    </Routes>
  );
}
