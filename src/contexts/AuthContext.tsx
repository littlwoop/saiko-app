import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User } from "@/types";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ user: User | null; session: Session | null }>;
  logout: () => void;
  checkEmailConfirmation: (
    email: string,
  ) => Promise<{ user: null; session: null; messageId?: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata.name || "",
          avatarUrl: session.user.user_metadata.avatar_url || "",
        });
      }
      setIsLoading(false);
    });

    // Listen for changes on auth state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata.name || "",
          avatarUrl: session.user.user_metadata.avatar_url || "",
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        console.error("Signup error details:", {
          message: error.message,
          status: error.status,
          name: error.name,
        });
        throw error;
      }

      if (!data.user) {
        throw new Error("No user data returned from signup");
      }

      // Create user profile in user_profiles table
      try {
        const { error: profileError } = await supabase
          .from("user_profiles")
          .upsert({
            id: data.user.id,
            name,
            avatar_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          console.error("Error creating user profile:", profileError);
          // Don't throw here, as the user is still created successfully
        }
      } catch (profileError) {
        console.error("Error creating user profile:", profileError);
        // Don't throw here, as the user is still created successfully
      }

      return {
        user: {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata.name || "",
          avatarUrl: data.user.user_metadata.avatar_url || "",
        },
        session: data.session,
      };
    } catch (error) {
      console.error("Signup failed:", error);
      throw error;
    }
  };

  const checkEmailConfirmation = async (email: string) => {
    try {
      const { data, error } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (error) {
        console.error("Resend confirmation error:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Resend confirmation failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear the user state first
      setUser(null);

      // Attempt to sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Logout error:", error);
        // Even if there's an error, we want to ensure the user is logged out locally
        setUser(null);
      }
    } catch (error) {
      console.error("Unexpected logout error:", error);
      // Ensure user state is cleared even if there's an error
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, signup, logout, checkEmailConfirmation }}
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
