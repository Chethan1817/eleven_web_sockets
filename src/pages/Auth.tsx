
import React, { useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AuthForm from "@/components/AuthForm";

const Auth: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    console.log("Auth page rendered with:", { isAuthenticated, isLoading });
  }, [isAuthenticated, isLoading]);
  
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
    console.log("User is authenticated, redirecting to home");
    return <Navigate to="/" replace />;
  }
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6  ">
      {/* <div className="w-full max-w-md text-center mb-8 animate-slide-down">
        <h1 className="text-3xl font-medium mb-2">Sara Audio Pipeline Explorer</h1>
        <p className="text-muted-foreground">
          Sign up to test audio streaming functionality
        </p>
      </div> */}
      
      <AuthForm />
      
      {/* <div className="mt-4 text-center">
        <Link to="/login" className=" hover:underline">
          Already have an account? Login
        </Link>
      </div> */}
      
      {/* <div className="mt-8 text-xs text-muted-foreground text-center max-w-md animate-fade-in">
        This is a testing platform for audio streaming, transcription, and response generation.
      </div> */}
    </div>
  );
};

export default Auth;
