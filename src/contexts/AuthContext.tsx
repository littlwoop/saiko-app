
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user data for demonstration
const mockUsers: User[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    avatarUrl: "https://i.pravatar.cc/150?u=john"
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    avatarUrl: "https://i.pravatar.cc/150?u=jane"
  }
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already logged in
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  // Mock login function
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // In a real app, this would be an API call
      const foundUser = mockUsers.find(u => u.email === email);
      
      if (!foundUser) {
        throw new Error("Invalid credentials");
      }
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setUser(foundUser);
      localStorage.setItem("user", JSON.stringify(foundUser));
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Mock signup function
  const signup = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      // Check if email already exists
      if (mockUsers.some(u => u.email === email)) {
        throw new Error("Email already in use");
      }
      
      // Create new user
      const newUser: User = {
        id: `${mockUsers.length + 1}`,
        name,
        email,
        avatarUrl: `https://i.pravatar.cc/150?u=${email}`
      };
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real app, this would be an API call
      mockUsers.push(newUser);
      
      setUser(newUser);
      localStorage.setItem("user", JSON.stringify(newUser));
    } catch (error) {
      console.error("Signup failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
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
