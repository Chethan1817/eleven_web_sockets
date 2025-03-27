
import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import LoginForm from "@/components/LoginForm";

const Login: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  
  // If loading, show a loading indicator
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }
  
  // If authenticated, redirect to home page
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return (
    
    // <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background to-secondary">

    <div className="min-h-screen flex flex-col items-center justify-center p-6  ">
    
      
      <LoginForm />
    
      {/* <div className="mt-8 text-xs text-muted-foreground text-center max-w-md animate-fade-in">
        This is a testing platform for audio streaming, transcription, and response generation.
      </div> */}
      
    </div>
  );
};

export default Login;
