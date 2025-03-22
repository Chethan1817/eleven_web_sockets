
import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Loader2 } from "lucide-react";
import { 
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator
} from "@/components/ui/input-otp";

interface AuthFormProps {
  onSuccess?: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ onSuccess }) => {
  const { register, verifyOtp, isLoading } = useAuth();
  
  const [step, setStep] = useState<"register" | "verify">("register");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("91");
  const [requestId, setRequestId] = useState("");
  const [otp, setOtp] = useState("");
  const [autoVerifying, setAutoVerifying] = useState(false);
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const reqId = await register(name, phoneNumber, countryCode);
      setRequestId(reqId);
      setStep("verify");
      
      // For testing purposes - auto-fill with OTP from backend
      // In a real app, this would be removed as the actual OTP would be sent to the user's phone
      // Here we assume the backend returns a test OTP for development
      setOtp("123456"); // This would be the OTP from the backend response
      setAutoVerifying(true);
      
      // Auto verify after a short delay
      setTimeout(() => {
        handleVerify(new Event('submit') as React.FormEvent);
      }, 1500);
    } catch (error) {
      console.error("Registration error:", error);
      setAutoVerifying(false);
    }
  };
  
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const success = await verifyOtp(phoneNumber, requestId, otp);
      if (success && onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Verification error:", error);
      setAutoVerifying(false);
    }
  };
  
  const handleOtpChange = (value: string) => {
    setOtp(value);
  };
  
  return (
    <Card className="w-full max-w-md mx-auto glass-card animate-fade-in">
      <CardHeader>
        <CardTitle className="text-2xl">
          {step === "register" ? "Sign Up" : "Verify OTP"}
        </CardTitle>
        <CardDescription>
          {step === "register" 
            ? "Enter your details to create an account"
            : autoVerifying 
              ? "Auto-verifying with test OTP..." 
              : "Enter the verification code sent to your phone"
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {step === "register" ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-white/50 dark:bg-black/50 backdrop-blur-sm"
              />
            </div>
            
            <div className="flex space-x-2">
              <div className="w-1/4 space-y-2">
                <Label htmlFor="countryCode">Code</Label>
                <Input
                  id="countryCode"
                  placeholder="+91"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  required
                  className="bg-white/50 dark:bg-black/50 backdrop-blur-sm"
                />
              </div>
              
              <div className="flex-1 space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
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
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-4">
              <Label htmlFor="otp" className="text-center block">Verification Code</Label>
              
              {autoVerifying ? (
                <div className="flex items-center justify-center py-2">
                  <div className="bg-white/50 dark:bg-black/50 backdrop-blur-sm px-4 py-2 rounded text-center text-lg tracking-widest flex items-center">
                    <span className="mr-2">{otp}</span>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-2">
                  <InputOTP 
                    value={otp} 
                    onChange={handleOtpChange} 
                    maxLength={6}
                    className="gap-2"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="bg-white/50 dark:bg-black/50 backdrop-blur-sm" />
                      <InputOTPSlot index={1} className="bg-white/50 dark:bg-black/50 backdrop-blur-sm" />
                      <InputOTPSlot index={2} className="bg-white/50 dark:bg-black/50 backdrop-blur-sm" />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} className="bg-white/50 dark:bg-black/50 backdrop-blur-sm" />
                      <InputOTPSlot index={4} className="bg-white/50 dark:bg-black/50 backdrop-blur-sm" />
                      <InputOTPSlot index={5} className="bg-white/50 dark:bg-black/50 backdrop-blur-sm" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full mt-4"
              disabled={isLoading || autoVerifying}
            >
              {isLoading || autoVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {autoVerifying ? "Auto-Verifying" : "Verifying"}
                </>
              ) : (
                "Verify & Continue"
              )}
            </Button>
            
            {!autoVerifying && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep("register")}
                disabled={isLoading}
              >
                Back to Sign Up
              </Button>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default AuthForm;
