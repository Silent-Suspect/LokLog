import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <div className="p-10">
            <h1 className="text-3xl font-bold text-blue-600">LokLog SaaS Dashboard</h1>
            <p className="mt-4 text-gray-600">Environment initialized with React, Vite, Tailwind CSS.</p>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;
