
import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const Home: React.FC = () => {
  const { user, logout } = useAuth();
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background to-secondary">
      <div className="w-full max-w-md text-center mb-8 animate-slide-down">
        <h1 className="text-3xl font-medium mb-4">Welcome to the App</h1>
        <p className="text-xl mb-2">
          You are logged in successfully!
        </p>
        {user && (
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg mb-4">
            <p className="font-medium">User Details:</p>
            <p>Phone: {user.phone_number}</p>
            {user.name && <p>Name: {user.name}</p>}
          </div>
        )}
        
        <Button 
          onClick={logout}
          variant="destructive"
          className="mt-4"
        >
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Home;
