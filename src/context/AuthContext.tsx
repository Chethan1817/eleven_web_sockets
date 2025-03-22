import React, { createContext, useContext, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { ENDPOINTS } from "@/config";

interface User {
  id?: number;
  name?: string;
  phone_number: string;
  country_code?: string;
  email?: string | null;
  grant_id?: string | null;
  provider?: string | null;
}

interface AuthResponse {
  refresh: string;
  access: string;
  user: User;
  message: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  register: (name: string, phone_number: string, country_code: string) => Promise<string>;
  login: (phone_number: string, country_code: string) => Promise<string>;
  verifyOtp: (phone_number: string, request_id: string, otp: string) => Promise<boolean>;
  logout: () => void;
  accessToken: string | null;
  refreshToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedAccessToken = localStorage.getItem("accessToken");
    const storedRefreshToken = localStorage.getItem("refreshToken");
    
    if (storedUser && storedAccessToken && storedRefreshToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        clearLocalStorage();
      }
    }
    
    setIsLoading(false);
  }, []);

  const clearLocalStorage = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  };

  const register = async (name: string, phone_number: string, country_code: string): Promise<string> => {
    console.log("Inside register function:", { name, phone_number, country_code });
    try {
      setIsLoading(true);
      
      console.log("Making API call to register endpoint");
      
      const response = await fetch(ENDPOINTS.REGISTER, {
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
      
      setUser({ name, phone_number, country_code });
      
      sonnerToast.success("OTP Sent", {
        description: `A verification code has been sent to +${country_code} ${phone_number}.`,
      });
      
      return data.requestId;
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

  const login = async (phone_number: string, country_code: string): Promise<string> => {
    console.log("Inside login function:", { phone_number, country_code });
    try {
      setIsLoading(true);
      
      console.log("Making API call to login endpoint");
      
      const response = await fetch(ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number,
          country_code
        }),
      });
      
      console.log("Login API response status:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Login failed");
      }
      
      const data = await response.json();
      console.log("Login API response:", data);
      
      setUser({ phone_number, country_code });
      
      sonnerToast.success("OTP Sent", {
        description: `A verification code has been sent to +${country_code} ${phone_number}.`,
      });
      
      return data.requestId;
    } catch (error) {
      console.error("Error in login function:", error);
      const errorMessage = error instanceof Error ? error.message : "Login failed";
      sonnerToast.error("Login Failed", {
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
      
      console.log("Making API call to verify OTP");
      
      const response = await fetch(ENDPOINTS.VERIFY_OTP, {
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
      
      const data: AuthResponse = await response.json();
      console.log("Verification API response:", data);
      
      setUser(data.user);
      setAccessToken(data.access);
      setRefreshToken(data.refresh);
      
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("accessToken", data.access);
      localStorage.setItem("refreshToken", data.refresh);
      
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
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    
    clearLocalStorage();
    
    sonnerToast.info("Logged Out", {
      description: "You have been successfully logged out.",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!accessToken,
        isLoading,
        register,
        login,
        verifyOtp,
        logout,
        accessToken,
        refreshToken,
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
