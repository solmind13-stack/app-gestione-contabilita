// src/app/(app)/impostazioni/page.tsx
"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PlusCircle, Trash2, Loader2, Pencil } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc, updateDoc, deleteDoc, writeBatch, getDocs, where } from 'firebase/firestore';
import type { AppUser } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EditUserDialog } from '@/components/impostazioni/edit-user-dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AddUserDialog } from '@/components/impostazioni/add-user-dialog';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { CATEGORIE } from '@/lib/constants';


// Mock data based on the user's image
const initialData = {
  operators: ['Gibilisco Salvato', 'Gibilisco Nuccio'],
  accounts: ['LNC-BAPR', 'STG-BAPR'],
  paymentMethods: ['Bonifico', 'Contanti', 'Carta', 'Addebito'],
};

type CategoryData = typeof CATEGORIE;

// Generic component for managing a simple list (operators, accounts, etc.)
const SettingsListManager = ({ title, items, setItems }: { title: string, items: string[], setItems: (items: string[]) => void }) => {
  const [newItem, setNewItem] = useState('');

  const handleAddItem = () => {
    if (newItem && !items.includes(newItem)) {
      setItems([...items, newItem].sort());
      setNewItem('');
    }
  };

  const handleRemoveItem = (itemToRemove: string) => {
    setItems(items.filter(item => item !== itemToRemove));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map(item => (
            <div key={item} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <span>{item}</span>
              <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <Separator className="my-4" />
        <div className="flex gap-2">
          <Input 
            value={newItem} 
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={`Nuovo ${title.slice(0, -1).toLowerCase()}...`}
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
          />
          <Button onClick={handleAddItem}>
            <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const UserManagementCard = () => {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AppUser | null>(null);
    const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);

    const { data: users, isLoading, error } = useCollection<AppUser>(usersQuery);

    const handleOpenEditDialog = (user: AppUser) => {
        setEditingUser(user);
    };

    const handleOpenDeleteDialog = (user: AppUser) => {
        setDeletingUser(user);
    }
    
    const handleAddUser = async (data: any) => {
        if (!firestore || !currentUser) {
            toast({ variant: 'destructive', title: 'Errore', description: 'Utente non autenticato o database non disponibile.' });
            return Promise.reject("Prerequisiti falliti");
        }
        
        // This is a temporary auth instance for user creation.
        // It's a workaround because we can't easily access the main auth instance here
        // without more complex (and error-prone) prop drilling or context extensions.
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();

        // 1. Check if user already exists in Auth
        const q = query(collection(firestore, "users"), where("email", "==", data.email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            toast({ variant: 'destructive', title: 'Email già in uso', description: 'Un utente con questa email esiste già nel database.' });
            return Promise.reject("Utente esistente");
        }

        try {
            // 2. We are creating a temporary user. This is NOT ideal.
            // In a real scenario, this would be handled by a backend function for security.
            const tempUserCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
            const newUser = tempUserCredential.user;

            // 3. Create user profile in Firestore.
            const userDocRef = doc(firestore, 'users', newUser.uid);
            const newUserProfile: AppUser = {
                uid: newUser.uid,
                email: newUser.email,
                displayName: data.displayName,
                role: data.role,
                company: (data.role === 'company' || data.role === 'company-editor') ? data.company : undefined,
                creationDate: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
            };

            await writeBatch(firestore).set(userDocRef, newUserProfile).commit();

            toast({ title: 'Utente Creato', description: `${data.displayName} è stato aggiunto.` });
            
            // This part is tricky. We created the user with a temporary auth instance.
            // To be fully clean, we would need to sign out this temp user and sign back in the admin.
            // For this app's purpose, we'll assume the onAuthStateChanged handles it,
            // but this highlights the complexity of client-side multi-user management.
             return Promise.resolve();

        } catch (e: any) {
            console.error('Error creating user:', e);
            let description = 'Impossibile creare il nuovo utente. Controlla la console per i dettagli.';
            if (e.code === 'auth/email-already-in-use') {
                description = 'Questa email è già registrata nel sistema di autenticazione.';
            } else if (e.code === 'auth/weak-password') {
                description = 'La password deve essere di almeno 6 caratteri.';
            }
            toast({ variant: 'destructive', title: 'Errore Creazione Utente', description });
            return Promise.reject(e);
        }
    };

    const handleUpdateUser = async (updatedUser: AppUser) => {
        if (!firestore || !updatedUser.uid) {
            toast({ variant: 'destructive', title: 'Errore', description: 'Dati non validi per l\'aggiornamento.' });
            return;
        }
        try {
            const userDocRef = doc(firestore, 'users', updatedUser.uid);
            await updateDoc(userDocRef, {
                displayName: updatedUser.displayName,
                role: updatedUser.role,
                company: updatedUser.company,
            });
            toast({ title: 'Utente Aggiornato', description: 'I dati dell\'utente sono stati salvati.' });
            setEditingUser(null);
        } catch (e) {
            console.error('Error updating user:', e);
            toast({ variant: 'destructive', title: 'Errore Aggiornamento', description: 'Impossibile salvare le modifiche. Controlla i permessi.' });
        }
    };
    
    const handleDeleteUser = async () => {
        if (!firestore || !deletingUser) return;

        // Prevent admin from deleting themselves
        if (currentUser?.uid === deletingUser.uid) {
            toast({ variant: "destructive", title: "Azione non permessa", description: "Non puoi eliminare il tuo stesso account amministratore." });
            setDeletingUser(null);
            return;
        }

        try {
            const userDocRef = doc(firestore, 'users', deletingUser.uid);
            await deleteDoc(userDocRef);
            // Note: This only deletes the Firestore record, not the Firebase Auth user.
            // A production app would use a Cloud Function to handle the full deletion.
            toast({ title: 'Utente Eliminato', description: `Il profilo di ${deletingUser.displayName} è stato eliminato dal database.` });
        } catch(e) {
            console.error('Error deleting user:', e);
            toast({ variant: 'destructive', title: 'Errore Eliminazione', description: 'Impossibile eliminare l\'utente. Controlla i permessi.' });
        } finally {
            setDeletingUser(null);
        }
    }


    return (
        <>
         <AddUserDialog
            isOpen={isAddUserOpen}
            setIsOpen={setIsAddUserOpen}
            onAddUser={handleAddUser}
        />
        <EditUserDialog 
            isOpen={!!editingUser}
            setIsOpen={(isOpen) => !isOpen && setEditingUser(null)}
            user={editingUser}
            onUpdateUser={handleUpdateUser}
        />
        <AlertDialog open={!!deletingUser} onOpenChange={(isOpen) => !isOpen && setDeletingUser(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Questa azione non può essere annullata. Verrà eliminato permanentemente il profilo utente di <span className="font-bold">{deletingUser?.displayName}</span> dal database. L'utente non potrà più accedere.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">Elimina</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Gestione Utenti</CardTitle>
                    <CardDescription>
                        Visualizza, modifica ed elimina gli utenti, i loro ruoli e le società associate.
                    </CardDescription>
                </div>
                 <Button onClick={() => setIsAddUserOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Aggiungi Utente
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Ruolo</TableHead>
                            <TableHead>Società</TableHead>
                            <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                </TableCell>
                            </TableRow>
                        ) : error ? (
                             <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-red-500">
                                    Errore di autorizzazione: non hai i permessi per visualizzare gli utenti.
                                </TableCell>
                            </TableRow>
                        ) : users && users.length > 0 ? (
                            users.map((user) => (
                                <TableRow key={user.uid}>
                                    <TableCell className="font-medium">{user.email}</TableCell>
                                    <TableCell>{user.displayName}</TableCell>
                                    <TableCell>
                                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{user.company || 'N/A'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(user)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                         <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(user)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    Nessun utente trovato. Clicca su "Aggiungi Utente" per crearne uno.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        </>
    )
}


export default function ImpostazioniPage() {
  const { user } = useUser();
  const [operators, setOperators] = useState(initialData.operators);
  const [accounts, setAccounts] = useState(initialData.accounts);
  const [paymentMethods, setPaymentMethods] = useState(initialData.paymentMethods);
  const [categories, setCategories] = useState<CategoryData>(CATEGORIE);
  const { toast } = useToast();

  const handleAddCategory = () => {
    // This would open a dialog to add a new category
    toast({ title: 'Funzionalità in sviluppo', description: 'La creazione di nuove categorie sarà presto disponibile.' });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Impostazioni</h1>
        <p className="text-muted-foreground">
          Gestisci le opzioni e le personalizzazioni della tua applicazione.
        </p>
      </div>

       {user?.role === 'admin' && <UserManagementCard />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <SettingsListManager title="Operatori" items={operators} setItems={setOperators} />
          <SettingsListManager title="Conti" items={accounts} setItems={setAccounts} />
          <SettingsListManager title="Metodi di Pagamento" items={paymentMethods} setItems={setPaymentMethods} />
        </div>

        <Card>
          <CardHeader className='flex-row items-center justify-between'>
            <div>
              <CardTitle>Categorie e Sottocategorie</CardTitle>
              <CardDescription>
                Gestisci le categorie per i movimenti e i suggerimenti AI.
              </CardDescription>
            </div>
            <Button onClick={handleAddCategory}>
              <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi
            </Button>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {Object.entries(categories).map(([category, subcategories]) => (
                <AccordionItem value={category} key={category}>
                   <AccordionTrigger>
                        <span className="font-semibold">{category}</span>
                    </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-4">
                      {subcategories.map(sub => (
                        <div key={sub} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <span>{sub}</span>
                           <Button variant="ghost" size="icon" onClick={() => toast({ title: 'Funzionalità in sviluppo' })}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                      ))}
                       <div className="flex gap-2 pt-2">
                          <Input placeholder="Nuova sottocategoria..." />
                          <Button onClick={() => toast({ title: 'Funzionalità in sviluppo' })}>Aggiungi Sottocategoria</Button>
                        </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
