
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, User } from "lucide-react";

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  
  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Card className="w-full glass-card">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome, {user?.name || "User"}</CardTitle>
          <CardDescription>
            You have successfully logged in
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-secondary/10">
              <div className="flex items-center space-x-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">Account Information</h3>
                  <p className="text-sm text-muted-foreground">
                    Phone: +{user?.country_code} {user?.phone_number}
                  </p>
                </div>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full mt-6"
              onClick={logout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
