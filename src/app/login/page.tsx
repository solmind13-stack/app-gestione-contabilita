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
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    // Reindirizza solo quando il caricamento è terminato e l'utente ha un ruolo valido.
    if (!isUserLoading && user?.role) {
      router.push("/dashboard");
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    if (!auth) {
        toast({
            variant: "destructive",
            title: "Errore di Inizializzazione",
            description: "Servizio di autenticazione non disponibile. Riprova più tardi.",
        });
        setIsLoggingIn(false);
        return;
    }
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Non reindirizzare qui. L'useEffect gestirà il reindirizzamento
      // una volta che il provider avrà caricato il profilo utente completo.
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        // Tentativo di creare l'utente se non esiste
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          toast({
            title: "Utente Creato",
            description: "Nuovo utente registrato con successo. Verrai reindirizzato.",
          });
          // Anche qui, l'useEffect si occuperà del reindirizzamento.
        } catch (creationError: any) {
          console.error("Signup failed:", creationError);
          toast({
            variant: "destructive",
            title: "Registrazione Fallita",
            description: "Impossibile creare un nuovo utente. La password deve essere di almeno 6 caratteri.",
          });
        }
      } else {
         console.error("Login failed:", error);
         toast({
          variant: "destructive",
          title: "Login Fallito",
          description: "Credenziali non valide o errore di rete. Riprova.",
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };
  
  // Mostra un caricamento globale mentre si verifica lo stato dell'utente.
  // Questo previene il flash del modulo di login se l'utente è già loggato.
  if (isUserLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  // Se l'utente è già loggato (verificato dall'useEffect), non mostrare il form
  // ma continua a mostrare il loader per un'esperienza utente fluida.
  if (user?.role) {
      return (
        <div className="flex min-h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin" />
        </div>
    );
  }

  // Se il caricamento è finito e non c'è utente, mostra il form di login.
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
                  disabled={isLoggingIn}
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
                  disabled={isLoggingIn}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button className="w-full" type="submit" disabled={isLoggingIn}>
                {isLoggingIn ? <Loader2 className="animate-spin" /> : "Accedi"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
