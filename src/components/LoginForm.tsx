
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Select,SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
// import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@radix-ui/react-select";


const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+61");
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber || !countryCode) {
      toast.error("Missing Fields", {
        description: "Please enter your phone number."
      });
      return;
    }
    
    try {
      const reqId = await login(phoneNumber, countryCode);
      
      if (reqId) {
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
  
// Common country codes
const COUNTRY_CODES = [
  { code: '+1', name: 'United States/Canada' },
  { code: '+44', name: 'United Kingdom' },
  { code: '+91', name: 'India' },
  { code: '+61', name: 'Australia' },
  { code: '+86', name: 'China' },
  { code: '+33', name: 'France' },
  { code: '+49', name: 'Germany' },
  { code: '+81', name: 'Japan' },
  { code: '+971', name: 'UAE' },
  { code: '+65', name: 'Singapore' },
  { code: '+27', name: 'South Africa' },
  { code: '+55', name: 'Brazil' },
  { code: '+52', name: 'Mexico' },
  { code: '+82', name: 'South Korea' },
];

  return (
    <Card className="w-full max-w-md mx-auto glass-card animate-fade-in ">
      <CardHeader>
      {/* <div className="w-full max-w-md text-center mb-4 animate-slide-down ">
        <h1 className="text-3xl font-medium mb-2">Sara Audio Pipeline Explorer</h1>
        <p className="text-muted-foreground">
          Sign in to access your account
        </p>
      </div> */}
      <CardTitle className="text-2xl text-center pb-[10px] ">Sara Audio Pipeline Explorer</CardTitle>
      {/* <CardTitle className="text-muted-foreground text-center pb-5 text-">
      Sign in to access your account</CardTitle> */}
      <hr className=""/>
        <CardTitle className="text-2xl text-center pt-[10px]">Login</CardTitle>
        <CardDescription className="text-center">
          Enter your phone number to receive a verification code
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="flex space-x-2">
            <div className="w-1/4 space-y-2">
              <Label htmlFor="loginCountryCode">Code</Label>
              {/* <Input
                id="loginCountryCode"
                placeholder="+91"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                required
                className="bg-white/50 dark:bg-black/50 backdrop-blur-sm"
              /> */}
              {/* <Select>
                {COUNTRY_CODES.map(val=><SelectContent key={val.code}><SelectItem value={val.code} >{val.code}</SelectItem></SelectContent>)}
              </Select> */}
               <Select
                  defaultValue={"+61"}
                  onValueChange={(value: string) => setCountryCode(value)}
                >
                  <SelectTrigger className="rounded-[12px] ">
                    <SelectValue placeholder="Select country code" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map(country => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.code} 
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

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
