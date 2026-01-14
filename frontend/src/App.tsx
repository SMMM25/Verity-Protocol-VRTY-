import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, createContext, useContext } from 'react';
import Layout from './components/Layout';
import TaxDashboard from './pages/TaxDashboard';
import TaxTransactions from './pages/TaxTransactions';
import TaxReports from './pages/TaxReports';
import TaxSettings from './pages/TaxSettings';
import Landing from './pages/Landing';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// User context for demo purposes
interface UserContextType {
  userId: string;
  setUserId: (id: string) => void;
  isLoggedIn: boolean;
  login: (id: string) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
};

function App() {
  const [userId, setUserId] = useState(() => localStorage.getItem('verity_user') || '');
  const isLoggedIn = !!userId;

  const login = (id: string) => {
    setUserId(id);
    localStorage.setItem('verity_user', id);
  };

  const logout = () => {
    setUserId('');
    localStorage.removeItem('verity_user');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <UserContext.Provider value={{ userId, setUserId, isLoggedIn, login, logout }}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={isLoggedIn ? <Layout /> : <Navigate to="/" />}>
              <Route index element={<Navigate to="tax" replace />} />
              <Route path="tax" element={<TaxDashboard />} />
              <Route path="tax/transactions" element={<TaxTransactions />} />
              <Route path="tax/reports" element={<TaxReports />} />
              <Route path="tax/settings" element={<TaxSettings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </UserContext.Provider>
    </QueryClientProvider>
  );
}

export default App;
