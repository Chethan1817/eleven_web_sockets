
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import AudioRecorder from "@/components/AudioRecorder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, UserCircle, LogOut, Info, HelpCircle } from "lucide-react";

const Home: React.FC = () => {
  const { user, logout } = useAuth();
  
  return (
    <div className="min-h-screen">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="flex flex-col space-y-6">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-2">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-6 w-6 text-[#f9bb09]" />
              <h1 className="text-3xl font-bold text-white">Voice Assistant</h1>
            </div>
            
            <Button 
              onClick={logout}
              variant="ghost"
              size="sm"
              className="mt-4 md:mt-0 flex items-center gap-2 text-white"
            >
              <LogOut className="h-4 w-4 text-white" />
              <span >Logout</span>
            </Button>
          </div>
          
          {/* User Profile Section */}
          {user && (
            <Card className="w-full overflow-hidden border border-border/40  ">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-gray-100 p-2">
                    <UserCircle className="h-8 w-8 text-black" />
                  </div>
                  <div>
                    <CardTitle>{user.name || "Welcome"}</CardTitle>
                    <CardDescription>{user.phone_number}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}
          <div className="flex flex-col gap-5 md:flex-row ">
          {/* Voice Assistant Section */}
          <Card className="w-full border border-border/40 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <span>Voice Assistant</span>
              </CardTitle>
              <CardDescription>Ask me anything by speaking into your microphone</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="my-6">
                <AudioRecorder />
              </div>
            </CardContent>
          </Card>
          <Card className="w-full border border-border/40 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <span>Chat</span>
              </CardTitle>
           
            </CardHeader>
            {/* <CardContent className="pt-0">
              <div className="my-6">
                <AudioRecorder />
              </div>
            </CardContent> */}
          </Card>
          </div>
          
          {/* How to Use Section */}
          <Card className="w-full border border-border/40  shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-black" />
                How to Use
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 rounded-full bg-gray-200 p-1 w-6 h-6 flex items-center justify-center">
                    <span className="text-xs font-bold text-black">1</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Tap the microphone button to start speaking with the assistant.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 rounded-full  bg-gray-200 p-1 w-6 h-6 flex items-center justify-center">
                    <span className="text-xs font-bold text-black">2</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Speak naturally to ask questions or give commands.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 rounded-full bg-gray-200 p-1 w-6 h-6 flex items-center justify-center">
                    <span className="text-xs font-bold text-black">3</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Wait for the assistant to respond. You can speak again to interrupt.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 rounded-full bg-gray-200 p-1 w-6 h-6 flex items-center justify-center">
                    <span className="text-xs font-bold text-black">4</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Tap the microphone button again to end the conversation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Features Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-border/40  hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-4 w-4 text-black" />
                  Voice Commands
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Speak naturally to get information, set reminders, or control your devices.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border border-border/40 bg-card/95 backdrop-blur-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-4 w-4 text-black" />
                  Smart Responses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get intelligent answers to your questions with contextual understanding.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border border-border/40 bg-card/95 backdrop-blur-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-4 w-4 text-black" />
                  Always Learning
                </CardTitle>
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
