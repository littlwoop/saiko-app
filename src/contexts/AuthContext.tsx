import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
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
  const userRef = useRef<User | null>(null);

  // Keep userRef in sync with user state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Error getting session:", error);
        // If there's an error but we have a stored session, try to refresh it
        if (session) {
          // Session exists but might need refresh, Supabase will handle it
          if (session.user) {
            setUser({
              id: session.user.id,
              email: session.user.email!,
              name: session.user.user_metadata.name || "",
              avatarUrl: session.user.user_metadata.avatar_url || "",
            });
          }
        }
      } else if (session?.user) {
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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event, session?.user?.id);
      
      // Only log out on explicit SIGNED_OUT events
      // During token refresh, the session might be temporarily null but will be restored
      if (event === "SIGNED_OUT") {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // For other events (TOKEN_REFRESHED, SIGNED_IN, etc.), update user if session exists
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata.name || "",
          avatarUrl: session.user.user_metadata.avatar_url || "",
        });
      } else if (event === "TOKEN_REFRESHED") {
        // Token was refreshed but session might be loading
        // Try to get the session again after a brief delay
        setTimeout(async () => {
          const { data: { session: refreshedSession } } = await supabase.auth.getSession();
          if (refreshedSession?.user) {
            setUser({
              id: refreshedSession.user.id,
              email: refreshedSession.user.email!,
              name: refreshedSession.user.user_metadata.name || "",
              avatarUrl: refreshedSession.user.user_metadata.avatar_url || "",
            });
          }
        }, 100);
      } else if (!session && event !== "SIGNED_OUT") {
        // Session is null but not a sign out event - might be a transient issue
        // Try to refresh the session before logging out
        try {
          const { data: { session: refreshedSession } } = await supabase.auth.getSession();
          if (refreshedSession?.user) {
            setUser({
              id: refreshedSession.user.id,
              email: refreshedSession.user.email!,
              name: refreshedSession.user.user_metadata.name || "",
              avatarUrl: refreshedSession.user.user_metadata.avatar_url || "",
            });
          } else {
            // Only clear user if we truly have no session after retry
            setUser(null);
          }
        } catch (error) {
          console.error("Error refreshing session:", error);
          // Don't log out on error - might be network issue
        }
      }
      
      setIsLoading(false);
    });

    // Periodic session check to prevent unexpected logouts
    // Check every 5 minutes to ensure session is still valid
    const sessionCheckInterval = setInterval(async () => {
      const currentUser = userRef.current;
      if (currentUser) {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) {
            console.error("Periodic session check error:", error);
            // If there's an error, try to refresh the session
            if (session) {
              // Session exists, update user if needed
              if (session.user && session.user.id !== currentUser.id) {
                setUser({
                  id: session.user.id,
                  email: session.user.email!,
                  name: session.user.user_metadata.name || "",
                  avatarUrl: session.user.user_metadata.avatar_url || "",
                });
              }
            }
          } else if (session?.user) {
            // Session is valid, update user if metadata changed
            if (session.user.id === currentUser.id) {
              setUser({
                id: session.user.id,
                email: session.user.email!,
                name: session.user.user_metadata.name || "",
                avatarUrl: session.user.user_metadata.avatar_url || "",
              });
            }
          } else if (!session && currentUser) {
            // Session is null but we still have user state - try to refresh
            console.log("Session lost during periodic check, attempting refresh...");
            const { data: { session: refreshedSession } } = await supabase.auth.getSession();
            if (!refreshedSession?.user) {
              // Only clear if we truly have no session
              console.log("No session found after refresh, clearing user");
              setUser(null);
            }
          }
        } catch (error) {
          console.error("Error in periodic session check:", error);
          // Don't clear user on error - might be network issue
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => {
      subscription.unsubscribe();
      clearInterval(sessionCheckInterval);
    };
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
