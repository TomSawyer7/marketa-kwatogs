import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MarketaProvider } from "@/store/marketa";
import { AuthProvider } from "@/hooks/use-auth";
import { MpinProvider } from "@/hooks/use-mpin";
import { AccountLifecycleProvider } from "@/hooks/use-account-lifecycle";
import { AccountStatusProvider } from "@/hooks/use-account-status";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { VerificationGate } from "@/components/auth/VerificationGate";
import { MpinGate } from "@/components/mpin/MpinGate";
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
import VerifyEmail from "./pages/VerifyEmail.tsx";
import Admin from "./pages/Admin.tsx";
import Transactions from "./pages/Transactions.tsx";
import Inbox from "./pages/Inbox.tsx";
import ChatThread from "./pages/ChatThread.tsx";
import MpinSetup from "./pages/MpinSetup.tsx";
import NotFound from "./pages/NotFound.tsx";
import Terms from "./pages/legal/Terms.tsx";
import Privacy from "./pages/legal/Privacy.tsx";
import Community from "./pages/legal/Community.tsx";
import Contact from "./pages/Contact.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <MpinProvider>
            <AccountLifecycleProvider>
            <AccountStatusProvider>
              <MarketaProvider>
                <VerificationGate>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/browse" element={<Browse />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />
                    <Route path="/verify" element={<ProtectedRoute><Verify /></ProtectedRoute>} />
                    <Route path="/mpin-setup" element={<ProtectedRoute><MpinSetup /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                    <Route path="/item/:id" element={<ItemDetail />} />
                    <Route path="/seller/:id" element={<SellerPage />} />
                    <Route path="/sell" element={<ProtectedRoute><MpinGate section="sell"><Sell /></MpinGate></ProtectedRoute>} />
                    <Route path="/saved" element={<ProtectedRoute><Saved /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><MpinGate section="settings"><Settings /></MpinGate></ProtectedRoute>} />
                    <Route path="/inbox" element={<ProtectedRoute><MpinGate section="inbox"><Inbox /></MpinGate></ProtectedRoute>} />
                    <Route path="/inbox/:id" element={<ProtectedRoute><MpinGate section="inbox"><ChatThread /></MpinGate></ProtectedRoute>} />
                    <Route path="/legal/terms" element={<Terms />} />
                    <Route path="/legal/privacy" element={<Privacy />} />
                    <Route path="/legal/community" element={<Community />} />
                    <Route path="/contact" element={<Contact />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </VerificationGate>
              </MarketaProvider>
            </AccountStatusProvider>
            </AccountLifecycleProvider>
          </MpinProvider>
        </AuthProvider>
      </BrowserRouter>

    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
