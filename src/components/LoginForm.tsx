
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";

const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("91");
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber || !countryCode) {
      toast.error("Missing Fields", {
        description: "Please enter your phone number."
      });
      return;
    }
    
    try {
      // Use the dedicated login function instead of register
      const reqId = await login(phoneNumber, countryCode);
      
      if (reqId) {
        // Navigate to the OTP verification page with the necessary data
        navigate("/verify-otp", {
          state: {
            phoneNumber,
            countryCode,
            requestId: reqId,
            isLogin: true
          }
        });
      } else {
        toast.error("Login Failed", {
          description: "Could not send verification code. Please try again."
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login Error", {
        description: "An error occurred during login."
      });
    }
  };
  
  return (
    <Card className="w-full max-w-md mx-auto glass-card animate-fade-in">
      <CardHeader>
        <CardTitle className="text-2xl">Login</CardTitle>
        <CardDescription>
          Enter your phone number to receive a verification code
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="flex space-x-2">
            <div className="w-1/4 space-y-2">
              <Label htmlFor="loginCountryCode">Code</Label>
              <Input
                id="loginCountryCode"
                placeholder="+91"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                required
                className="bg-white/50 dark:bg-black/50 backdrop-blur-sm"
              />
            </div>
            
            <div className="flex-1 space-y-2">
              <Label htmlFor="loginPhoneNumber">Phone Number</Label>
              <Input
                id="loginPhoneNumber"
                placeholder="Enter your phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                className="bg-white/50 dark:bg-black/50 backdrop-blur-sm"
              />
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full mt-4"
            disabled={isLoading || !phoneNumber || !countryCode}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing
              </>
            ) : (
              <>
                Send OTP
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
          
          <div className="text-center mt-4">
            <Button
              type="button"
              variant="link"
              onClick={() => navigate("/auth")}
            >
              Don't have an account? Sign up
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default LoginForm;
