"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth, useUser } from "@/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("m.rossi@example.com");
  const [password, setPassword] = useState("password123");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    // Redirect if user is already logged in and has a role
    if (!isUserLoading && user?.role) {
      router.push("/dashboard");
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (!auth) {
        toast({
            variant: "destructive",
            title: "Errore di Inizializzazione",
            description: "Servizio di autenticazione non disponibile. Riprova più tardi.",
        });
        setIsLoading(false);
        return;
    }
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Let the AppLayout handle the redirect after profile check
      // router.push("/dashboard"); 
    } catch (error: any) {
      console.error("Login failed:", error);
      // If user does not exist, try to create it
      if (error.code === 'auth/user-not-found') {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          toast({
            title: "Utente Creato",
            description: "Nuovo utente registrato. Verrai reindirizzato.",
          });
          // Let the AppLayout handle the redirect and profile creation
        } catch (creationError: any) {
          console.error("Signup failed:", creationError);
          toast({
            variant: "destructive",
            title: "Registrazione Fallita",
            description: "Impossibile creare un nuovo utente.",
          });
        }
      } else {
         toast({
          variant: "destructive",
          title: "Login Fallito",
          description: "Credenziali non valide o errore di rete. Riprova.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Show a loading spinner while checking auth state or if the user is logged in but has no role yet
  if (isUserLoading || (user && !user.role)) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  // If user is logged in and has a role, they will be redirected by the useEffect.
  // This prevents rendering the login form for an already logged-in user.
  if (user?.role) {
      return (
        <div className="flex min-h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin" />
        </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-background to-secondary/40 p-4">
      <div className="flex flex-col items-center gap-8">
        <Logo className="h-10" />
        <Card className="w-full max-w-sm shadow-xl">
          <CardHeader className="text-center">
            <CardTitle>Gestione Contabile LNC-STG</CardTitle>
            <CardDescription>Accedi per continuare</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="mario@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button className="w-full" type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : "Accedi"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
