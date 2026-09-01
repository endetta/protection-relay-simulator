import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './layouts/AppShell';
import { SimulatorHome } from './pages/SimulatorHome';
import { DifferentialSimulator } from './pages/DifferentialSimulator';
import { OvercurrentSimulator } from './pages/OvercurrentSimulator';
import { UnderfrequencySimulator } from './pages/UnderfrequencySimulator';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<SimulatorHome />} />
          <Route path="simulator/differential" element={<DifferentialSimulator />} />
          <Route path="simulator/overcurrent" element={<OvercurrentSimulator />} />
          <Route path="simulator/underfrequency" element={<UnderfrequencySimulator />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
