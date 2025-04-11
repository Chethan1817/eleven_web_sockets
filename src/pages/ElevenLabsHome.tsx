// Correct imports for Vite project structure
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import ElevenLabsAudioRecorder from "../components/ElevenLabsAudioRecorder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Sparkles, UserCircle, LogOut, Info, HelpCircle, History } from "lucide-react";
import ChatComponent from "../components/ChatComponent";
import WhatsAppChat from "../components/WhatsAppChat";
import ElevenLabsStatusIndicator from "../components/ElevenLabsStatusIndicator";
import { storeElevenLabsSessionId, getElevenLabsSessionHistory } from "../services/elevenLabsSessionService";
import { useNavigate } from "react-router-dom";  // Import from react-router-dom

// Use ProtectedRoute from your project structure
import ProtectedRoute from "../components/ProtectedRoute";

const ElevenLabsHome: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isRefetch, setIsRefetch] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Fetch session history on component mount
  useEffect(() => {
    const fetchSessionHistory = async () => {
      try {
        setLoading(true);
        const history = await getElevenLabsSessionHistory();
        setSessionHistory(history || []);
      } catch (error) {
        console.error("Error fetching session history:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSessionHistory();
  }, [isRefetch]);
  
  // Handle session refresh
  const handleRefreshHistory = () => {
    setIsRefetch(prev => !prev);
  };
  
  return (
    <div className="min-h-screen">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="flex flex-col space-y-6">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-2">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-6 w-6 text-[#f9bb09]" />
              <h1 className="text-3xl font-bold text-white">ElevenLabs Voice Assistant</h1>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleRefreshHistory}
                variant="outline"
                size="sm"
                className="mt-4 md:mt-0 flex items-center gap-2"
                disabled={loading}
              >
                <History className="h-4 w-4" />
                <span>Refresh History</span>
              </Button>
              
              <Button 
                onClick={logout}
                variant="ghost"
                size="sm"
                className="mt-4 md:mt-0 flex items-center gap-2 text-white"
              >
                <LogOut className="h-4 w-4 text-white" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
          
          {/* User Profile Section */}
          {user && (
            <Card className="w-full overflow-hidden border border-border/40">
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
          
          {/* Status Indicator */}
          <ElevenLabsStatusIndicator />
          
          <div className="flex flex-col gap-5 md:flex-row">
            {/* Voice Assistant Section */}
            <Card className="w-full border border-border/40 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <span>ElevenLabs Voice Assistant</span>
                </CardTitle>
                <CardDescription>Ask me anything by speaking into your microphone</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="my-6">
                  <ElevenLabsAudioRecorder />
                </div>
              </CardContent>
            </Card>
            
            <Card className="w-full border border-border/40 shadow-md">
              <WhatsAppChat />
            </Card>
          </div>
          
          {/* Chat History Component */}
          <Card>
            <ChatComponent />
          </Card>
          
          {/* How to Use Section */}
          <Card className="w-full border border-border/40 shadow-sm">
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
                    Tap the microphone button to start speaking with the ElevenLabs assistant.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 rounded-full bg-gray-200 p-1 w-6 h-6 flex items-center justify-center">
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
            <Card className="border border-border/40 hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-4 w-4 text-black" />
                  ElevenLabs Voice API
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Powered by ElevenLabs' state-of-the-art voice AI for natural-sounding conversation.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border border-border/40 bg-card/95 backdrop-blur-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-4 w-4 text-black" />
                  Direct Integration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Connects directly to ElevenLabs' ConvAI API for seamless voice conversations.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border border-border/40 bg-card/95 backdrop-blur-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-4 w-4 text-black" />
                  Session History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  All your conversations are saved and can be accessed from the history section.
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Session History Display */}
          <Card className="w-full border border-border/40 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-4 w-4 text-black" />
                Recent ElevenLabs Sessions
              </CardTitle>
              <CardDescription>
                Your recent voice assistant conversations
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading session history...</p>
                </div>
              ) : sessionHistory.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {sessionHistory.map((session, index) => (
                    <div 
                      key={session.session_id || index} 
                      className="p-3 rounded-lg bg-card/80 border border-border/40"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">
                            Session {session.session_id}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(session.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => window.open(`https://api.elevenlabs.io/v1/convai/conversations/${session.session_id}`, '_blank')}
                          className="text-xs"
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No session history found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Using ProtectedRoute from your project instead of withAuth
const ProtectedElevenLabsHome = () => (
  <ProtectedRoute>
    <ElevenLabsHome />
  </ProtectedRoute>
);

export default ProtectedElevenLabsHome;