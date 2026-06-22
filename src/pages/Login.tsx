import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Lamp, Mail, Lock, User, ArrowRight, Sparkles } from "lucide-react";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    if (isSignUp) {
      const result = await signUp(email, password, name);
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      if (result.needsConfirmation) {
        setNotice("Account created. Check your email to confirm, then sign in.");
        setIsSignUp(false);
        setLoading(false);
        return;
      }
      navigate("/");
      return;
    }

    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-card border border-border/40 shadow-lg mb-5">
            <Lamp className="w-8 h-8 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-1">
            Lounge
          </h1>
          <p className="text-muted-foreground text-sm">
            {isSignUp ? "Join your team's lounge" : "Welcome back to the lounge"}
          </p>
        </div>

        {/* Form card */}
        <Card className="p-6 space-y-5 bg-card/70 backdrop-blur-xl border-border/30 shadow-xl shadow-black/10">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground/80 text-xs font-medium uppercase tracking-wider">
                  Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="pl-10 h-11 rounded-xl bg-background/50 border-border/40"
                    required={isSignUp}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground/80 text-xs font-medium uppercase tracking-wider">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@team.com"
                  className="pl-10 h-11 rounded-xl bg-background/50 border-border/40"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground/80 text-xs font-medium uppercase tracking-wider">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="········"
                  className="pl-10 h-11 rounded-xl bg-background/50 border-border/40"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2.5 border border-destructive/20">
                {error}
              </div>
            )}

            {notice && (
              <div className="text-sm text-primary bg-primary/10 rounded-lg px-4 py-2.5 border border-primary/20">
                {notice}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl font-semibold text-sm bg-primary hover:brightness-110 transition-all duration-200"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  {isSignUp ? "Creating account..." : "Signing in..."}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  {isSignUp ? "Create Account" : "Sign In"}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setNotice(null);
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp ? "Already have an account? Sign in" : "New to Lounge? Create an account"}
            </button>
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          A private space for the team
        </p>
      </div>
    </div>
  );
}
