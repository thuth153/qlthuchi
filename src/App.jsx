
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Report from './pages/Report';
import FuelManagement from './pages/FuelManagement';
import ExpenseManagement from './pages/ExpenseManagement';
import Layout from './components/Layout';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/report" element={<Report />} />
            <Route path="/fuel" element={<FuelManagement />} />
            <Route path="/expenses" element={<ExpenseManagement />} />
            <Route path="/" element={<Navigate to="/expenses" replace />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
