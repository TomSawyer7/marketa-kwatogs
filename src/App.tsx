import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MarketaProvider } from "@/store/marketa";
import { AuthProvider } from "@/hooks/use-auth";
import { AccountStatusProvider } from "@/hooks/use-account-status";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { VerificationGate } from "@/components/auth/VerificationGate";
import Landing from "./pages/Landing.tsx";
import Browse from "./pages/Browse.tsx";
import ItemDetail from "./pages/ItemDetail.tsx";
import Sell from "./pages/Sell.tsx";
import Saved from "./pages/Saved.tsx";
import Profile from "./pages/Profile.tsx";
import Settings from "./pages/Settings.tsx";
import SellerPage from "./pages/SellerPage.tsx";
import Auth from "./pages/Auth.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Verify from "./pages/Verify.tsx";
import Admin from "./pages/Admin.tsx";
import Transactions from "./pages/Transactions.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AccountStatusProvider>
            <MarketaProvider>
              <VerificationGate>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/browse" element={<Browse />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/verify" element={<ProtectedRoute><Verify /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                  <Route path="/item/:id" element={<ItemDetail />} />
                  <Route path="/seller/:id" element={<SellerPage />} />
                  <Route path="/sell" element={<ProtectedRoute><Sell /></ProtectedRoute>} />
                  <Route path="/saved" element={<ProtectedRoute><Saved /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </VerificationGate>
            </MarketaProvider>
          </AccountStatusProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
