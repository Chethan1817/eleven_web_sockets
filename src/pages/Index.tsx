
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Dashboard from "@/components/Dashboard";

const Index: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background to-secondary">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center mb-8 animate-slide-down">
          <h1 className="text-3xl font-medium mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to your account
          </p>
        </div>
        
        <Dashboard />
      </div>
    </div>
  );
};

export default Index;
