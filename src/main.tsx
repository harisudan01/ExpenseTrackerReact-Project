import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import Layout from './components/Layout';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/Confirm';
import { AuthProvider } from './components/auth/AuthContext';
import { ThemeProvider } from './components/theme/ThemeContext';
import { GuestOnly, RequireAuth } from './components/auth/RouteGuards';
import AuthPage from './pages/AuthPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import BookList from './pages/BookList';
import BookDetail from './pages/BookDetail';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/signin" element={<GuestOnly><AuthPage mode="signin" /></GuestOnly>} />
              <Route path="/signup" element={<GuestOnly><AuthPage mode="signup" /></GuestOnly>} />
              <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
              {/* Not guest-only: the emailed link must work even if someone is signed in on this browser */}
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/expenseApp" element={<RequireAuth><Layout /></RequireAuth>}>
                <Route path="list" element={<BookList />} />
                <Route path=":id/:mode" element={<BookDetail />} />
              </Route>
              <Route path="*" element={<Navigate to="/expenseApp/list" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
