
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import StatusIndicator from "./ElevenLabsStatusIndicator";
import { LogOut } from "lucide-react";

const Header: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  
  return (
    <header className="w-full p-4 glass-panel shadow-sm animate-fade-in">
      <div className="container max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-lg font-medium bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
            Sara
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">
            Audio Pipeline Explorer
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          <StatusIndicator />
          
          {isAuthenticated && (
            <>
              <Separator orientation="vertical" className="h-6" />
              
              <div className="flex items-center">
                <span className="text-sm mr-2">{user?.name || user?.phone_number}</span>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 rounded-full" 
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
