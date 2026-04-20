import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Dashboard from './pages/Dashboard';
import HostsPage from './pages/HostsPage';
import ProblemsPage from './pages/ProblemsPage';
import TrendPage from './pages/TrendPage';
import PerfPage from './pages/PerfPage';
import NetworkPage from './pages/NetworkPage';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/hosts" element={<HostsPage />} />
          <Route path="/problems" element={<ProblemsPage />} />
          <Route path="/trend" element={<TrendPage />} />
          <Route path="/perf" element={<PerfPage />} />
          <Route path="/network" element={<NetworkPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
