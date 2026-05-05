import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SmoothScroll } from "@/components/rasad/SmoothScroll";
import { ScrollProgress } from "@/components/rasad/ScrollProgress";
import { BackToTop } from "@/components/rasad/BackToTop";
import Index from "./pages/Index.tsx";
import News from "./pages/News.tsx";
import Agents from "./pages/Agents.tsx";
import Social from "./pages/Social.tsx";
import Reports from "./pages/Reports.tsx";
import About from "./pages/About.tsx";
import Contact from "./pages/Contact.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import Terms from "./pages/Terms.tsx";
import HowItWorks from "./pages/HowItWorks.tsx";
import Live from "./pages/Live.tsx";
import VerifyPublic from "./pages/VerifyPublic.tsx";
import Login from "./pages/auth/Login.tsx";
import Signup from "./pages/auth/Signup.tsx";
import ForgotPassword from "./pages/auth/ForgotPassword.tsx";
import ResetPassword from "./pages/auth/ResetPassword.tsx";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import Verify from "./pages/dashboard/Verify";
import Collections from "./pages/dashboard/Collections";
import Alerts from "./pages/dashboard/Alerts";
import Analytics from "./pages/dashboard/Analytics";
import Profile from "./pages/dashboard/Profile";
import Admin from "./pages/dashboard/Admin";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SmoothScroll>
              <ScrollProgress />
              <BackToTop />
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/verify" element={<VerifyPublic />} />
              <Route path="/live" element={<Live />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/news" element={<News />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/social" element={<Social />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<Terms />} />

              {/* Auth */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Overview />} />
                <Route path="verify" element={<Verify />} />
                <Route path="collections" element={<Collections />} />
                <Route path="alerts" element={<Alerts />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="profile" element={<Profile />} />
                <Route path="admin" element={<Admin />} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </SmoothScroll>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
