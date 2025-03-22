
import React, { createContext, useContext, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";

interface User {
  name?: string;
  phone_number: string;
  country_code?: string;
  token?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  register: (name: string, phone_number: string, country_code: string) => Promise<string>;
  verifyOtp: (phone_number: string, request_id: string, otp: string) => Promise<boolean>;
  logout: () => void;
}

// API base URL - replace with your actual API endpoint
const API_BASE_URL = "https://your-actual-api-endpoint.com/api";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem("user");
    
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        localStorage.removeItem("user");
      }
    }
    
    setIsLoading(false);
  }, []);

  const register = async (name: string, phone_number: string, country_code: string): Promise<string> => {
    console.log("Inside register function:", { name, phone_number, country_code });
    try {
      setIsLoading(true);
      
      // Make the actual API call to your registration endpoint
      console.log("Making API call to register endpoint");
      
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          phone_number,
          country_code
        }),
      });
      
      console.log("API response status:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Registration failed");
      }
      
      const data = await response.json();
      console.log("Registration API response:", data);
      
      // Update user state with the registration info
      setUser({ name, phone_number, country_code });
      
      sonnerToast.success("OTP Sent", {
        description: `A verification code has been sent to +${country_code} ${phone_number}.`,
      });
      
      // Return the request_id from the API for OTP verification
      return data.request_id;
    } catch (error) {
      console.error("Error in register function:", error);
      const errorMessage = error instanceof Error ? error.message : "Registration failed";
      sonnerToast.error("Registration Failed", {
        description: errorMessage,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (phone_number: string, request_id: string, otp: string): Promise<boolean> => {
    console.log("Inside verifyOtp function:", { phone_number, request_id, otp });
    try {
      setIsLoading(true);
      
      // Make the actual API call to your OTP verification endpoint
      console.log("Making API call to verify OTP");
      
      const response = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number,
          request_id,
          otp
        }),
      });
      
      console.log("API response status:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "OTP verification failed");
      }
      
      const data = await response.json();
      console.log("Verification API response:", data);
      
      // Update user with token from the verification response
      const updatedUser = { 
        ...user, 
        phone_number, 
        token: data.token 
      };
      
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      
      sonnerToast.success("Verification Successful", {
        description: "You are now logged in.",
      });
      
      return true;
    } catch (error) {
      console.error("Error in verifyOtp function:", error);
      const errorMessage = error instanceof Error ? error.message : "OTP verification failed";
      sonnerToast.error("Verification Failed", {
        description: errorMessage,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
    sonnerToast.info("Logged Out", {
      description: "You have been successfully logged out.",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user?.token,
        isLoading,
        register,
        verifyOtp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
