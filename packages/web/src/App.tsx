import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProjectLayout } from "./components/ProjectLayout";
import { StatusBar } from "./components/StatusBar";
import { HomePage } from "./pages/HomePage";
import { DashboardPage } from "./pages/DashboardPage";
import { EvalsPage } from "./pages/EvalsPage";
import { EvalDetailPage } from "./pages/EvalDetailPage";
import { ScenariosPage } from "./pages/ScenariosPage";
import { ScenarioDetailPage } from "./pages/ScenarioDetailPage";
import { PersonasPage } from "./pages/PersonasPage";
import { PersonaDetailPage } from "./pages/PersonaDetailPage";
import { SettingsConnectorsPage } from "./pages/SettingsConnectorsPage";
import { SettingsLLMProvidersPage } from "./pages/SettingsLLMProvidersPage";
import { SettingsUsersPage } from "./pages/SettingsUsersPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/project/:projectId" element={<ProjectLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="evals" element={<EvalsPage />} />
          <Route path="evals/:evalId" element={<EvalDetailPage />} />
          <Route path="scenarios" element={<ScenariosPage />} />
          <Route path="scenarios/:scenarioId" element={<ScenarioDetailPage />} />
          <Route path="personas" element={<PersonasPage />} />
          <Route path="personas/:personaId" element={<PersonaDetailPage />} />
          <Route path="settings/connectors" element={<SettingsConnectorsPage />} />
          <Route path="settings/llm-providers" element={<SettingsLLMProvidersPage />} />
          <Route path="settings/users" element={<SettingsUsersPage />} />
        </Route>
      </Routes>
      <StatusBar />
    </BrowserRouter>
  );
}
