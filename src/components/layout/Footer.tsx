import { Activity } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="border-t">
      <div className="container py-8 md:py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Link to="/" className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-challenge-purple" />
              <span className="text-xl font-bold gradient-text">Saiko</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Create and join exciting challenges with friends
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 md:col-span-2">
            <div className="flex flex-col gap-2">
              <h3 className="text-base font-medium">App</h3>
              <Link to="/challenges" className="text-sm text-muted-foreground hover:text-foreground">
                Challenges
              </Link>
              <Link to="/leaderboard" className="text-sm text-muted-foreground hover:text-foreground">
                Leaderboard  
              </Link>
              <Link to="/my-challenges" className="text-sm text-muted-foreground hover:text-foreground">
                My Challenges
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-base font-medium">Account</h3>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
                Login
              </Link>
              <Link to="/signup" className="text-sm text-muted-foreground hover:text-foreground">
                Sign Up
              </Link>
              <Link to="/profile" className="text-sm text-muted-foreground hover:text-foreground">
                Profile
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © {currentYear} Saiko. All rights reserved.
          </p>
          <div className="flex gap-4">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              Privacy Policy
            </Link>
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
