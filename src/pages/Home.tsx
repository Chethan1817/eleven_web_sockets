
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import AudioRecorder from "@/components/AudioRecorder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import StatusIndicator from "@/components/StatusIndicator";
import { Sparkles, UserCircle, LogOut } from "lucide-react";

const Home: React.FC = () => {
  const { user, logout } = useAuth();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/50">
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <div className="flex flex-col space-y-6">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-2">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold">Voice Assistant</h1>
            </div>
            
            <Button 
              onClick={logout}
              variant="ghost"
              size="sm"
              className="mt-4 md:mt-0 flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
          
          {/* User Profile Section */}
          {user && (
            <Card className="w-full overflow-hidden border border-border/40 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <UserCircle className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{user.name || "Welcome"}</CardTitle>
                    <CardDescription>{user.phone_number}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}
          
          {/* Voice Assistant Section */}
          <Card className="w-full border border-border/40 bg-card/80 backdrop-blur-sm shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <span>Voice Assistant</span>
              </CardTitle>
              <CardDescription>Ask me anything by speaking into your microphone</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="my-6">
                <StatusIndicator />
                <AudioRecorder />
              </div>
            </CardContent>
          </Card>
          
          {/* Features Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-border/40 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Voice Commands</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Speak naturally to get information, set reminders, or control your devices.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border border-border/40 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Smart Responses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get intelligent answers to your questions with contextual understanding.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border border-border/40 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Always Learning</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  The assistant improves over time, learning your preferences and habits.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
