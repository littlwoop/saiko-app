
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChallengeProvider } from "@/contexts/ChallengeContext";
import Layout from "@/components/layout/Layout";
import ProtectedRoute from "@/components/layout/ProtectedRoute";

// Pages
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ChallengesPage from "@/pages/ChallengesPage";
import CreateChallengePage from "@/pages/CreateChallengePage";
import ChallengePage from "@/pages/ChallengePage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import ProfilePage from "@/pages/ProfilePage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ChallengeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Layout />}>
                <Route index element={<Index />} />
                <Route path="login" element={<Login />} />
                <Route path="signup" element={<Signup />} />
                <Route path="challenges" element={<ChallengesPage />} />
                <Route path="challenges/:id" element={<ChallengePage />} />
                <Route path="leaderboard" element={<LeaderboardPage />} />

                {/* Protected routes */}
                <Route path="challenges/create" element={
                  <ProtectedRoute>
                    <CreateChallengePage />
                  </ProtectedRoute>
                } />
                <Route path="profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                <Route path="my-challenges" element={
                  <ProtectedRoute>
                    <ChallengesPage />
                  </ProtectedRoute>
                } />

                {/* Catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ChallengeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
