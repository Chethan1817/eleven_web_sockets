import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Loader2, Phone } from "lucide-react";
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
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Register button clicked with:", { name, phoneNumber, countryCode });
    
    if (!name || !phoneNumber || !countryCode) {
      console.error("Missing required fields");
      return;
    }
    
    try {
      console.log("Calling register API...");
      console.log("Register function exists:", typeof register === 'function');
      
      const reqId = await register(name, phoneNumber, countryCode);
      console.log("Register API response:", reqId);
      
      if (reqId) {
        setRequestId(reqId);
        setStep("verify");
      } else {
        console.error("No request ID returned from register function");
      }
    } catch (error) {
      console.error("Registration error:", error);
    }
  };
  
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Verify button clicked with:", { phoneNumber, requestId, otp });
    
    try {
      console.log("Calling verify OTP API...");
      const success = await verifyOtp(phoneNumber, requestId, otp);
      console.log("Verify OTP API response:", success);
      if (success && onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Verification error:", error);
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
            : `Enter the verification code sent to +${countryCode} ${phoneNumber}`
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {step === "register" ? (
          <form id="register-form" onSubmit={handleRegister} className="space-y-4">
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
              disabled={isLoading || !name || !phoneNumber || !countryCode}
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
            <div className="flex items-center justify-center mb-4">
              <div className="bg-primary/10 rounded-full p-3">
                <Phone className="h-6 w-6 text-primary" />
              </div>
            </div>
            
            <div className="text-center mb-4">
              <div className="text-sm text-muted-foreground">
                We've sent a 6-digit verification code to
              </div>
              <div className="font-medium">+{countryCode} {phoneNumber}</div>
            </div>
            
            <div className="space-y-4">
              <Label htmlFor="otp" className="text-center block">Enter verification code</Label>
              
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
            </div>
            
            <Button 
              type="submit" 
              className="w-full mt-4"
              disabled={isLoading || otp.length < 6}
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
              onClick={() => setStep("register")}
              disabled={isLoading}
            >
              Back to Sign Up
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default AuthForm;
