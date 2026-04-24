import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Baby, Mail, Lock, User, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { APP_TITLE, APP_TAGLINE } from '@/lib/appMeta';
import { useSupabaseAuth } from '@/lib/supabase/useSupabaseAuth';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const {
    session,
    initialized,
    cloudAuthReady,
    signInWithEmail,
    signUpWithEmail,
    resetPasswordForEmail,
    signOut,
  } = useSupabaseAuth();

  const [isSignUp, setIsSignUp] = useState(() => searchParams.get('mode') === 'signup');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Once session is confirmed, navigate to the originally requested page (or dashboard)
  useEffect(() => {
    if (initialized && cloudAuthReady && session) {
      navigate(from, { replace: true });
    }
  }, [initialized, cloudAuthReady, session, navigate, from]);

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudAuthReady) {
      toast({
        title: 'Cloud sign-in unavailable',
        description:
          'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env and restart the dev server.',
      });
      return;
    }
    if (!signInEmail || !signInPassword) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signInWithEmail(signInEmail, signInPassword);
    setLoading(false);
    if (error) {
      toast({ title: 'Sign in failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Signed in successfully' });
    navigate(from, { replace: true });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudAuthReady) {
      toast({
        title: 'Cloud sign-up unavailable',
        description:
          'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env and restart the dev server.',
      });
      return;
    }
    if (!signUpName || !signUpEmail || !signUpPassword) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    if (signUpPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signUpWithEmail(signUpEmail, signUpPassword, signUpName);
    setLoading(false);
    if (error) {
      toast({ title: 'Sign up failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Account created',
      description: 'If email confirmation is enabled, check your inbox. Otherwise, sign in now.',
    });
    setIsSignUp(false);
  };

  const handleForgotPassword = async () => {
    if (!cloudAuthReady) {
      toast({
        title: 'Password reset unavailable',
        description: 'Supabase is not configured. Check .env and restart the dev server.',
        variant: 'destructive',
      });
      return;
    }
    if (!signInEmail) {
      toast({ title: 'Enter your email above first', variant: 'destructive' });
      return;
    }
    const { error } = await resetPasswordForEmail(signInEmail);
    if (error) {
      toast({ title: 'Reset failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Reset link sent', description: 'Check your email.' });
  };

  const restoringSession = cloudAuthReady && !initialized;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-primary/5" />
        <div className="absolute -bottom-32 -left-32 w-[30rem] h-[30rem] rounded-full bg-secondary/30" />
        <div className="absolute top-1/3 left-1/4 w-64 h-64 rounded-full bg-accent/20" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 overflow-hidden">
            <img
              src="/babybloom_flower_512.png"
              alt={`${APP_TITLE} logo`}
              className="h-14 w-14 object-contain"
            />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">{APP_TITLE}</h1>
          <p className="text-muted-foreground text-sm mt-1 text-center max-w-xs">{APP_TAGLINE}</p>
        </div>

        {restoringSession ? (
          <Card className="shadow-lg border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Checking your session…</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg border-border/50">
            <CardHeader className="text-center pb-4">
              <CardTitle className="font-display text-xl">
                {isSignUp ? 'Create an Account' : 'Welcome Back'}
              </CardTitle>
              <CardDescription>
                {isSignUp
                  ? "Sign up to start tracking your child's health"
                  : 'Sign in to access your health records'}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {isSignUp ? (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">First Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        placeholder="Enter your first name"
                        className="pl-10"
                        value={signUpName}
                        onChange={e => setSignUpName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="Enter your email"
                        className="pl-10"
                        value={signUpEmail}
                        onChange={e => setSignUpEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a password (min. 6 chars)"
                        className="pl-10 pr-10"
                        value={signUpPassword}
                        onChange={e => setSignUpPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full gap-2" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating account…
                      </>
                    ) : (
                      <>
                        Sign Up
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="Enter your email"
                        className="pl-10"
                        value={signInEmail}
                        onChange={e => setSignInEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={handleForgotPassword}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        className="pl-10 pr-10"
                        value={signInPassword}
                        onChange={e => setSignInPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full gap-2" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      <>
                        Log in
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              <div className="mt-6 text-center text-sm text-muted-foreground">
                {isSignUp ? (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      className="text-primary font-semibold hover:underline"
                      onClick={() => { setIsSignUp(false); setShowPassword(false); }}
                    >
                      Log in
                    </button>
                  </>
                ) : (
                  <>
                    Don&apos;t have an account?{' '}
                    <button
                      type="button"
                      className="text-primary font-semibold hover:underline"
                      onClick={() => { setIsSignUp(true); setShowPassword(false); }}
                    >
                      Sign Up
                    </button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default Auth;
