import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './modules/dashboard/DashboardHome';
import SettingsPage from './modules/Settings/Settings';
import LokLogEditor from './modules/LokLog/LokLogEditor';
import Fahrtenbuch from './modules/Fahrtenbuch/Fahrtenbuch';
import Decoder from './modules/Decoder/Decoder';
import ExcelDebug from './modules/Dev/ExcelDebug';
import AdminDashboard from './modules/Admin/AdminDashboard';
import AdminRoute from './layouts/AdminRoute';
import EmailTemplates from './modules/EmailTemplates/EmailTemplates';

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
        <Route path="*" element={
          <>
            <SignedOut>
              <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <SignIn />
              </div>
            </SignedOut>

            <SignedIn>
              <Routes>
                {/* Main Dashboard Layout Routes */}
                <Route path="/" element={<DashboardLayout />}>
                  <Route index element={<DashboardHome />} />
                  <Route path="fahrtenbuch" element={<Fahrtenbuch />} />
                  <Route path="loklog" element={<LokLogEditor />} />
                  <Route path="decoder" element={<Decoder />} />
                  <Route path="email-templates" element={<EmailTemplates />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="tools" element={<ToolsPage />} />
                  <Route path="debug" element={<ExcelDebug />} />

                  {/* Admin Routes */}
                  <Route path="admin" element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  } />
                </Route>

                {/* 404 Fallback */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SignedIn>
          </>
        } />
      </Routes>
    </Router>
  );
}

export default App;
