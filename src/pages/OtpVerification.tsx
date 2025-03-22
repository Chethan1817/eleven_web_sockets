
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { Loader2, Phone } from "lucide-react";
import { toast } from "sonner";

const OtpVerification: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyOtp, isLoading } = useAuth();
  
  const [otp, setOtp] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [requestId, setRequestId] = useState("");
  const [isLogin, setIsLogin] = useState(false);
  
  useEffect(() => {
    // Get params from location state
    const state = location.state as { 
      phoneNumber: string; 
      countryCode: string; 
      requestId: string;
      isLogin?: boolean;
    } | null;
    
    if (!state || !state.phoneNumber || !state.requestId) {
      toast.error("Missing verification information", {
        description: "Please go back and try again.",
      });
      navigate("/auth");
      return;
    }
    
    setPhoneNumber(state.phoneNumber);
    setCountryCode(state.countryCode || "91");
    setRequestId(state.requestId);
    setIsLogin(!!state.isLogin);
  }, [location, navigate]);
  
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 4) {
      toast.error("Invalid OTP", {
        description: "Please enter a valid 4-digit verification code.",
      });
      return;
    }
    
    try {
      const success = await verifyOtp(phoneNumber, requestId, otp);
      if (success) {
        toast.success(isLogin ? "Login successful" : "Registration successful", {
          description: isLogin ? "Welcome back!" : "Your account has been created successfully.",
        });
        navigate("/");
      }
    } catch (error) {
      console.error("Verification error:", error);
    }
  };
  
  const handleOtpChange = (value: string) => {
    setOtp(value);
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background to-secondary">
      <div className="w-full max-w-md text-center mb-8 animate-slide-down">
        <h1 className="text-3xl font-medium mb-2">Verify Your Number</h1>
        <p className="text-muted-foreground">
          Enter the verification code to {isLogin ? "login" : "complete signup"}
        </p>
      </div>
      
      <Card className="w-full max-w-md mx-auto glass-card animate-fade-in">
        <CardHeader>
          <CardTitle className="text-2xl">Verify OTP</CardTitle>
          <CardDescription>
            Enter the verification code sent to +{countryCode} {phoneNumber}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-primary/10 rounded-full p-3">
                <Phone className="h-6 w-6 text-primary" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-center py-2">
                <InputOTP 
                  value={otp} 
                  onChange={handleOtpChange} 
                  maxLength={4}
                  className="gap-2"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="bg-white/50 dark:bg-black/50 backdrop-blur-sm" />
                    <InputOTPSlot index={1} className="bg-white/50 dark:bg-black/50 backdrop-blur-sm" />
                    <InputOTPSlot index={2} className="bg-white/50 dark:bg-black/50 backdrop-blur-sm" />
                    <InputOTPSlot index={3} className="bg-white/50 dark:bg-black/50 backdrop-blur-sm" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full mt-4"
              disabled={isLoading || otp.length < 4}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying
                </>
              ) : (
                "Verify & Continue"
              )}
            </Button>
            
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate(isLogin ? "/login" : "/auth")}
              disabled={isLoading}
            >
              Back to {isLogin ? "Login" : "Sign Up"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default OtpVerification;
