
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import AudioRecorder from "@/components/AudioRecorder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import StatusIndicator from "@/components/StatusIndicator";

const Home: React.FC = () => {
  const { user, logout } = useAuth();
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background to-secondary">
      <div className="w-full max-w-md text-center mb-8 animate-slide-down">
        <h1 className="text-3xl font-medium mb-4">Welcome to the App</h1>
        <p className="text-xl mb-6">
          You are logged in successfully!
        </p>
        
        {user && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>User Details</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="text-left">
              <div className="space-y-2">
                <p><span className="font-medium">Phone:</span> {user.phone_number}</p>
                {user.name && <p><span className="font-medium">Name:</span> {user.name}</p>}
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Voice Assistant</CardTitle>
            <CardDescription>Ask me anything by speaking</CardDescription>
          </CardHeader>
          <CardContent className="py-6">
            <AudioRecorder />
          </CardContent>
        </Card>
        
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
