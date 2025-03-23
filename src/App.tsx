
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SessionProvider } from "./context/SessionContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
import OtpVerification from "./pages/OtpVerification";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Reorganize routes to ensure SessionProvider is available for routes that need it
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Auth-only routes not requiring SessionProvider */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verify-otp" element={<OtpVerification />} />
            
            {/* Routes that require SessionProvider */}
            <Route path="/" element={
              <SessionProvider>
                <Index />
              </SessionProvider>
            } />
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
