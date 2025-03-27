
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Select,SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const AuthForm: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();
  
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("91");
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Register button clicked with:", { name, phoneNumber, countryCode });
    
    if (!name || !phoneNumber || !countryCode) {
      toast.error("Missing Fields", {
        description: "Please fill in all required fields."
      });
      return;
    }
    
    try {
      console.log("Calling register API...");
      const reqId = await register(name, phoneNumber, countryCode);
      console.log("Register API response:", reqId);
      
      if (reqId) {
        // Navigate to the OTP verification page with the necessary data
        navigate("/verify-otp", {
          state: {
            phoneNumber,
            countryCode,
            requestId: reqId,
            isLogin: false,
            name,
            
          }
        });
      } else {
    
        toast.error("Registration Failed", {
          description: "Could not send verification code. Please try again."
        });
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Registration Error", {
        description: "Could not send verification code. Please try again."
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
              <CardTitle className="text-2xl text-center pb-[10px] ">Sara Audio Pipeline Explorer</CardTitle>
        <hr/>
        <CardTitle className="text-2xl pt-[10px] text-center">
          Sign Up</CardTitle>
        <CardDescription className="text-center">
          Enter your details to create an account
        </CardDescription>
      </CardHeader>
      
      <CardContent>
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
              {/* <Input
                id="countryCode"
                placeholder="+91"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                required
                className="bg-white/50 dark:bg-black/50 backdrop-blur-sm"
              /> */}
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
        <div className="mt-4 text-center">
        <Link to="/login" className=" hover:underline">
          Already have an account? Login
        </Link>
      </div>
      </CardContent>
    </Card>
  );
};

export default AuthForm;
