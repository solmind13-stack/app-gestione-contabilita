'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/logo';

export default function BootstrapAdminPage() {
  const [email, setEmail] = useState('m.rossi@example.com');
  const [password, setPassword] = useState('password123');
  const [displayName, setDisplayName] = useState('Mario Rossi');
  const [isLoading, setIsLoading] = useState(false);

  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Errore di inizializzazione',
        description: 'Servizi Firebase non disponibili.',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Password non sicura',
        description: 'La password deve essere di almeno 6 caratteri.',
      });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Create user profile in Firestore with 'admin' role
      const userDocRef = doc(firestore, 'users', user.uid);
      const newUserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: displayName,
        role: 'admin',
        company: 'LNC', // Default company for admin
        lastLogin: serverTimestamp(),
        creationDate: serverTimestamp(),
      };

      await setDoc(userDocRef, newUserProfile);

      toast({
        title: 'Amministratore Creato!',
        description: 'Verrai reindirizzato alla pagina di login.',
      });

      // 3. Redirect to login page
      router.push('/login');

    } catch (error: any) {
      console.error('Failed to create admin user:', error);
      let description = 'Impossibile creare l\'utente. Riprova.';
      if (error.code === 'auth/email-already-in-use') {
        description = 'Questa email è già in uso. Prova ad accedere.';
      }
      toast({
        variant: 'destructive',
        title: 'Creazione Fallita',
        description,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-background to-secondary/40 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <Logo className="justify-center mb-4" />
          <CardTitle>Crea Utente Amministratore</CardTitle>
          <CardDescription>
            Usa questa pagina solo una volta per creare il primo utente con privilegi di amministratore.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCreateAdmin}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="displayName">Nome Visualizzato</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Mario Rossi"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
              />
            </div>
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
                placeholder="Minimo 6 caratteri"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : 'Crea Amministratore'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
