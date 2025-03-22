
import React, { createContext, useContext, useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
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
    try {
      setIsLoading(true);
      
      // In a real app, this would be an actual API call
      // For testing purposes, we're simulating a successful registration
      // and returning a mock request_id
      
      // Simulate API call
      // const response = await fetch("http://localhost:8000/users/register/", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({ name, phone_number, country_code }),
      // });
      
      // Simulated successful response
      const mockRequestId = `Otp_${Math.random().toString(36).substring(2, 15).toUpperCase()}`;
      
      setUser({ name, phone_number, country_code });
      
      sonnerToast.success("OTP Sent", {
        description: "A test verification code has been generated.",
      });
      
      return mockRequestId;
    } catch (error) {
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
    try {
      setIsLoading(true);
      
      // In a real app, this would be an actual API call
      // For testing purposes, we're simulating a successful verification
      
      // Simulate API call
      // const response = await fetch("http://localhost:8000/users/verify_otp/", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({ phone_number, request_id, otp }),
      // });
      
      // Simulated successful response
      const mockToken = `Token_${Math.random().toString(36).substring(2, 30).toUpperCase()}`;
      
      const updatedUser = { 
        ...user, 
        phone_number, 
        token: mockToken 
      };
      
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      
      sonnerToast.success("Verification Successful", {
        description: "You are now logged in.",
      });
      
      return true;
    } catch (error) {
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
