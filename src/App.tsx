import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/hooks/useAuth";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Account from "./pages/Account.tsx";
import AdminCredit from "./pages/AdminCredit.tsx";
import Chat from "./pages/Chat.tsx";
import Live from "./pages/Live.tsx";
import CheckoutReturn from "./pages/CheckoutReturn.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import NotFound from "./pages/NotFound.tsx";
import OAuthConsent from "./pages/OAuthConsent.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PaymentTestModeBanner />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/account" element={<Account />} />
              <Route path="/admin/credit" element={<AdminCredit />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/live" element={<Live />} />
              <Route path="/checkout/return" element={<CheckoutReturn />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route path="*" element={<NotFound />} />

            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
