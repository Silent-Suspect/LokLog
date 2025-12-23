import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './modules/dashboard/DashboardHome';
import SettingsPage from './modules/settings/SettingsPage';
import LokLog from './modules/LokLog/LokLog';

// Placeholder for Tools
const ToolsPage = () => <div className="p-8"><h1 className="text-2xl font-bold">Tools</h1><p className="text-slate-500">Coming soon...</p></div>;

// 404 Page
const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-100">
    <div className="text-center">
      <h1 className="text-6xl font-bold text-slate-800">404</h1>
      <p className="text-xl text-slate-500 mt-2">Page not found</p>
      <a href="/" className="mt-4 inline-block text-blue-600 hover:underline">Go Home</a>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>
        {/* Main Dashboard Layout Routes */}
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="loklog" element={<LokLog />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="tools" element={<ToolsPage />} />
        </Route>

        {/* 404 Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
