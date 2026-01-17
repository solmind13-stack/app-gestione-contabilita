// src/app/(app)/impostazioni/page.tsx
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PlusCircle, Trash2, Loader2, Pencil, RefreshCw, Building } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useUser, useFirestore, useAuth, useCollection, useDoc } from '@/firebase';
import { collection, query, doc, updateDoc, deleteDoc, writeBatch, getDocs, where, setDoc, arrayUnion, arrayRemove, serverTimestamp, addDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import type { AppUser, AppSettings, CategoryData, UserRole, CompanyProfile } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EditUserDialog } from '@/components/impostazioni/edit-user-dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AddUserDialog } from '@/components/impostazioni/add-user-dialog';
import { AddCategoryDialog } from '@/components/impostazioni/add-category-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';


const CompanyFormSchema = z.object({
  type: z.enum(['persona_giuridica', 'persona_fisica']),
  name: z.string().min(2, 'Il nome è obbligatorio.'),
  sigla: z.string().min(1, 'La sigla è obbligatoria.').max(10, 'Massimo 10 caratteri.'),
  vatId: z.string().optional(),
  fiscalCode: z.string().optional(),
  street: z.string().optional(),
  streetNumber: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  province: z.string().optional(),
  email: z.string().email('Email non valida.').optional().or(z.literal('')),
  pec: z.string().email('PEC non valida.').optional().or(z.literal('')),
  phone: z.string().optional(),
  sdiCode: z.string().optional(),
  conti: z.array(z.string().min(1, "Il numero di conto non può essere vuoto.")).optional(),
}).refine(data => data.type === 'persona_giuridica' ? !!data.vatId : !!data.fiscalCode, {
  message: 'Partita IVA è richiesta per le persone giuridiche, Codice Fiscale per le persone fisiche.',
  path: ['vatId'],
});

type CompanyFormValues = z.infer<typeof CompanyFormSchema>;

const CompanyDialog = ({ isOpen, setIsOpen, onSave, companyToEdit, currentUser }: { isOpen: boolean, setIsOpen: (open: boolean) => void, onSave: (data: CompanyProfile) => Promise<void>, companyToEdit: CompanyProfile | null, currentUser: AppUser }) => {
    const isEditMode = !!companyToEdit;
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const form = useForm<CompanyFormValues>({
        resolver: zodResolver(CompanyFormSchema),
        defaultValues: {
            type: 'persona_giuridica',
            name: '',
            sigla: '',
            vatId: '',
            fiscalCode: '',
            street: '',
            streetNumber: '',
            city: '',
            zip: '',
            province: '',
            email: '',
            pec: '',
            phone: '',
            sdiCode: '',
            conti: [],
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "conti"
    });

    const watchedName = form.watch('name');
    const { dirtyFields } = form.formState;

    useEffect(() => {
        if (watchedName && !dirtyFields.sigla) {
            const words = watchedName.split(' ').filter(word => word.length > 0);
            let suggestion = '';

            if (words.length > 1) {
                // Rule 1: Multiple words -> initials
                suggestion = words.map(word => word[0]).join('').toUpperCase();
            } else if (words.length === 1) {
                // Rule 2: Single word -> first three consonants
                const singleWord = words[0];
                const consonants = singleWord.toLowerCase().replace(/[^a-z]/g, '').replace(/[aeiou]/g, '');
                suggestion = consonants.substring(0, 3).toUpperCase();
            }

            form.setValue('sigla', suggestion, { shouldValidate: true });
        }
    }, [watchedName, dirtyFields.sigla, form]);

    useEffect(() => {
        if(companyToEdit) {
            form.reset({
                ...companyToEdit,
                conti: companyToEdit.conti || [],
            });
        } else {
            form.reset({
                type: 'persona_giuridica',
                name: '',
                sigla: '',
                vatId: '',
                fiscalCode: '',
                street: '',
                streetNumber: '',
                city: '',
                zip: '',
                province: '',
                email: '',
                pec: '',
                phone: '',
                sdiCode: '',
                conti: [],
            });
        }
    }, [companyToEdit, form]);

    const watchedType = form.watch('type');

    const onSubmit = async (data: CompanyFormValues) => {
        setIsSubmitting(true);
        const dataToSave: CompanyProfile = {
            id: companyToEdit?.id || '', // Will be generated if new
            ...data,
            conti: data.conti,
            sigla: data.sigla!,
            createdBy: companyToEdit?.createdBy || currentUser.uid,
            createdAt: companyToEdit?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }
        await onSave(dataToSave);
        setIsSubmitting(false);
        setIsOpen(false);
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Modifica Soggetto' : 'Aggiungi Nuovo Soggetto'}</DialogTitle>
                    <DialogDescription>
                        Inserisci i dettagli per questa entità.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                        <FormField control={form.control} name="type" render={({ field }) => (
                            <FormItem><FormLabel>Tipo di Entità</FormLabel><FormControl>
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                    <FormItem className='flex items-center space-x-2'><FormControl><RadioGroupItem value="persona_giuridica" /></FormControl><FormLabel className="font-normal">Persona Giuridica</FormLabel></FormItem>
                                    <FormItem className='flex items-center space-x-2'><FormControl><RadioGroupItem value="persona_fisica" /></FormControl><FormLabel className="font-normal">Persona Fisica</FormLabel></FormItem>
                                </RadioGroup>
                            </FormControl></FormItem>
                        )} />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>{watchedType === 'persona_giuridica' ? 'Ragione Sociale' : 'Nome e Cognome'}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="sigla" render={({ field }) => (
                                <FormItem><FormLabel>Sigla</FormLabel><FormControl><Input {...field} placeholder="Es: ACME" /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="vatId" render={({ field }) => (
                                <FormItem><FormLabel>Partita IVA</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="fiscalCode" render={({ field }) => (
                                <FormItem><FormLabel>Codice Fiscale</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField control={form.control} name="street" render={({ field }) => (
                                <FormItem className="col-span-2"><FormLabel>Via/Piazza</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="streetNumber" render={({ field }) => (
                                <FormItem><FormLabel>N. Civico</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <FormField control={form.control} name="city" render={({ field }) => (
                                <FormItem><FormLabel>Città</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="province" render={({ field }) => (
                                <FormItem><FormLabel>Provincia</FormLabel><FormControl><Input {...field} maxLength={2} placeholder="Es: RG" /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="zip" render={({ field }) => (
                                <FormItem><FormLabel>CAP</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="pec" render={({ field }) => (
                                <FormItem><FormLabel>PEC</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="phone" render={({ field }) => (
                                <FormItem><FormLabel>Telefono</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="sdiCode" render={({ field }) => (
                                <FormItem><FormLabel>Codice SDI</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>

                         <div className="space-y-2">
                            <FormLabel>Numeri di Conto</FormLabel>
                            {fields.map((field, index) => (
                                <FormField
                                    key={field.id}
                                    control={form.control}
                                    name={`conti.${index}`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center gap-2">
                                                <FormControl>
                                                    <Input {...field} placeholder={`Conto #${index + 1}`} />
                                                </FormControl>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ))}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => append("")}
                            >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Aggiungi Conto
                            </Button>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Annulla</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin" /> : (isEditMode ? 'Salva Modifiche' : 'Salva Soggetto')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const SocietaManagementCard = () => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [companyToEdit, setCompanyToEdit] = useState<CompanyProfile | null>(null);
    const [companyToDelete, setCompanyToDelete] = useState<CompanyProfile | null>(null);

    const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
    const { data: companies, isLoading, error } = useCollection<CompanyProfile>(companiesQuery);

    const handleSave = async (companyData: CompanyProfile) => {
        if (!firestore || !user) return;
        try {
            if(companyData.id) { // Edit
                const docRef = doc(firestore, 'companies', companyData.id);
                await updateDoc(docRef, companyData as any);
                toast({ title: 'Soggetto Aggiornato', description: 'I dati sono stati modificati.' });
            } else { // Add
                await addDoc(collection(firestore, 'companies'), companyData);
                toast({ title: 'Soggetto Aggiunto', description: 'Il nuovo soggetto è stato salvato.' });
            }
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile salvare il soggetto.' });
        }
    }
    
    const handleDelete = async () => {
        if (!firestore || !companyToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'companies', companyToDelete.id));
            toast({ title: 'Soggetto Eliminato', description: `${companyToDelete.name} è stato eliminato.` });
        } catch(e) {
             console.error(e);
            toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile eliminare il soggetto.' });
        } finally {
            setCompanyToDelete(null);
        }
    }
    
    const openDialog = (company?: CompanyProfile) => {
        setCompanyToEdit(company || null);
        setIsDialogOpen(true);
    }
    
    return (
        <>
            <CompanyDialog isOpen={isDialogOpen} setIsOpen={setIsDialogOpen} onSave={handleSave} companyToEdit={companyToEdit} currentUser={user!} />
            <AlertDialog open={!!companyToDelete} onOpenChange={(isOpen) => !isOpen && setCompanyToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Sei sicuro?</AlertDialogTitle><AlertDialogDescription>Stai per eliminare <strong>{companyToDelete?.name}</strong>. Questa azione non può essere annullata.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Elimina</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>Gestione Soggetti</CardTitle>
                        <CardDescription>Aggiungi e gestisci clienti, fornitori e altre entità.</CardDescription>
                    </div>
                    <Button onClick={() => openDialog()}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Aggiungi Soggetto
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow><TableHead>Nome</TableHead><TableHead>Sigla</TableHead><TableHead>Tipo</TableHead><TableHead>P.IVA / CF</TableHead><TableHead>Email</TableHead><TableHead>Conti</TableHead><TableHead className="text-right">Azioni</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                            : error ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-red-500">Errore di autorizzazione.</TableCell></TableRow>
                            : companies && companies.length > 0 ? companies.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.name}</TableCell>
                                    <TableCell><Badge>{c.sigla}</Badge></TableCell>
                                    <TableCell><Badge variant="secondary">{c.type === 'persona_giuridica' ? 'Giuridica' : 'Fisica'}</Badge></TableCell>
                                    <TableCell>{c.vatId || c.fiscalCode}</TableCell>
                                    <TableCell>{c.email}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 items-start">
                                            {(c.conti && c.conti.length > 0) ? c.conti.map((conto, idx) => (
                                                <Badge key={idx} variant="secondary" className="font-mono">{conto}</Badge>
                                            )) : 'N/A'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => openDialog(c)}><Pencil className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => setCompanyToDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))
                            : <TableRow><TableCell colSpan={7} className="h-24 text-center">Nessun soggetto trovato.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </>
    )
}

type ItemToDelete = {
    type: 'category' | 'subcategory' | 'paymentMethod' | 'operator';
    name: string;
    parent?: string;
}

// Generic component for managing a simple list (payment methods, operators)
const SettingsListManager = ({ title, items, itemType, onUpdate, isLoading }: { title: string, items: string[], itemType: keyof AppSettings, onUpdate: (type: keyof AppSettings, value: any, action: 'add' | 'remove') => Promise<void>, isLoading: boolean }) => {
  const [newItem, setNewItem] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleAddItem = async () => {
    if (newItem && !items.includes(newItem)) {
      setIsAdding(true);
      await onUpdate(itemType, newItem, 'add');
      setNewItem('');
      setIsAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(itemToDelete);
    await onUpdate(itemType, itemToDelete, 'remove');
    setItemToDelete(null);
    setIsDeleting(null);
  };
  
  const openDeleteDialog = (item: string) => {
    setItemToDelete(item);
  }

  return (
    <>
    <AlertDialog open={!!itemToDelete} onOpenChange={(isOpen) => !isOpen && setItemToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Sei sicuro di voler eliminare?</AlertDialogTitle>
                <AlertDialogDescription>
                    Questa azione non può essere annullata. Verrà eliminato permanentemente <span className="font-bold">{itemToDelete}</span>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? <Loader2 className="animate-spin" /> : 'Elimina'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        ) : (
            <div className="space-y-2">
            {(items || []).map(item => (
                <div key={item} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <span>{item}</span>
                <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(item)} disabled={!!isDeleting}>
                    {isDeleting === item ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                </Button>
                </div>
            ))}
            </div>
        )}
        <Separator className="my-4" />
        <div className="flex gap-2">
          <Input 
            value={newItem} 
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={`Nuovo ${title.slice(0, -1).toLowerCase()}...`}
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            disabled={isAdding || isLoading}
          />
          <Button onClick={handleAddItem} disabled={isAdding || isLoading || !newItem}>
            {isAdding ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
             Aggiungi
          </Button>
        </div>
      </CardContent>
    </Card>
    </>
  );
};


const UserManagementCard = () => {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const auth = useAuth();
    const { toast } = useToast();
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AppUser | null>(null);
    const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);

    const isCurrentUserAdmin = currentUser?.role === 'admin';

    const usersQuery = useMemo(() => {
        if (!firestore || !isCurrentUserAdmin) return null; // Only fetch if admin
        return query(collection(firestore, 'users'));
    }, [firestore, isCurrentUserAdmin]);

    const { data: users, isLoading, error } = useCollection<AppUser>(usersQuery);

    const handleOpenEditDialog = (user: AppUser) => {
        setEditingUser(user);
    };

    const handleOpenDeleteDialog = (user: AppUser) => {
        setDeletingUser(user);
    }
    
    const handleAddUser = async (data: any) => {
        if (!firestore || !auth) {
            toast({ variant: 'destructive', title: 'Errore', description: 'Servizi Firebase non disponibili.' });
            return Promise.reject(new Error("Prerequisiti falliti"));
        }

        try {
            // Check if user with email already exists in Firestore users collection
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where("email", "==", data.email));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                 toast({ 
                    variant: 'destructive', 
                    title: 'Email già in uso', 
                    description: 'Un utente con questa email esiste già nel database.' 
                });
                return Promise.reject(new Error("Email già in uso nel DB"));
            }
            
            // Create user in Auth
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
            const newUser = userCredential.user;
            
            const userDocRef = doc(firestore, 'users', newUser.uid);
            
            const newUserProfile: Partial<AppUser> = {
                uid: newUser.uid,
                email: newUser.email,
                firstName: data.firstName,
                lastName: data.lastName,
                displayName: `${data.firstName} ${data.lastName}`,
                role: data.role as UserRole,
                creationDate: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
            };

            if (data.role === 'company' || data.role === 'company-editor') {
                newUserProfile.company = data.company;
            }
            
            await setDoc(userDocRef, newUserProfile);

            toast({ title: 'Utente Creato', description: `${data.firstName} ${data.lastName} è stato aggiunto.` });

        } catch (e: any) {
             if (e.code === 'auth/email-already-in-use') {
                 toast({ 
                    variant: 'destructive', 
                    title: 'Email già in uso nel sistema di autenticazione', 
                    description: 'L\'utente esiste nel sistema di autenticazione ma non ha un profilo. Per risolvere, elimina l\'utente dalla sezione "Authentication" della Console Firebase e riprova.' 
                });
            } else if (e.code === 'auth/weak-password') {
                 toast({ variant: 'destructive', title: 'Password Debole', description: 'La password deve essere di almeno 6 caratteri.' });
            } else {
                 console.error('Error creating user:', e);
                 toast({ variant: 'destructive', title: 'Errore Creazione Utente', description: 'Impossibile creare il nuovo utente. Controlla la console per i dettagli.' });
            }
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
            const dataToUpdate: Partial<AppUser> = {
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                displayName: `${updatedUser.firstName} ${updatedUser.lastName}`,
                role: updatedUser.role,
            };

            if (updatedUser.role === 'company' || updatedUser.role === 'company-editor') {
                dataToUpdate.company = updatedUser.company;
            } else {
                delete (dataToUpdate as any).company; // Remove the company field if not applicable
            }

            await updateDoc(userDocRef, dataToUpdate as any);
            toast({ title: 'Utente Aggiornato', description: 'I dati dell\'utente sono stati salvati.' });
            setEditingUser(null);
        } catch (e) {
            console.error('Error updating user:', e);
            toast({ variant: 'destructive', title: 'Errore Aggiornamento', description: 'Impossibile salvare le modifiche. Controlla i permessi.' });
        }
    };

    const handleResetPassword = async (email: string) => {
      if (!auth) {
        toast({ variant: 'destructive', title: 'Errore', description: 'Servizio di autenticazione non disponibile.' });
        return Promise.reject(new Error("Auth service not available"));
      }
      try {
        await sendPasswordResetEmail(auth, email);
        toast({ 
            title: 'Richiesta di Reset Inviata', 
            description: `Se non ricevi l'email entro 5 minuti, controlla lo spam e verifica la configurazione dei modelli email nella console Firebase.`,
            duration: 9000,
        });
        return Promise.resolve();
      } catch (error: any) {
        console.error('Error sending password reset email:', error);
        toast({ 
            variant: 'destructive', 
            title: 'Invio Email Fallito', 
            description: `Codice Errore: ${error.code}. Controlla la console per maggiori dettagli e verifica la configurazione del modello email su Firebase.` 
        });
        return Promise.reject(error);
      }
    };
    
    const handleDeleteUser = async () => {
        if (!firestore || !deletingUser) return;

        if (currentUser?.uid === deletingUser.uid) {
            toast({ variant: "destructive", title: "Azione non permessa", description: "Non puoi eliminare il tuo stesso account amministratore." });
            setDeletingUser(null);
            return;
        }

        try {
            // Note: This only deletes the Firestore profile, not the Auth user.
            // The Auth user must be deleted from the Firebase console for full removal.
            const userDocRef = doc(firestore, 'users', deletingUser.uid);
            await deleteDoc(userDocRef);
            toast({ title: 'Profilo Utente Eliminato', description: `Il profilo di ${deletingUser.displayName} è stato eliminato dal database.` });
        } catch(e) {
            console.error('Error deleting user profile:', e);
            toast({ variant: 'destructive', title: 'Errore Eliminazione', description: 'Impossibile eliminare il profilo utente. Controlla i permessi.' });
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
            onResetPassword={handleResetPassword}
        />
        <AlertDialog open={!!deletingUser} onOpenChange={(isOpen) => !isOpen && setDeletingUser(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Questa azione eliminerà il profilo utente di <span className="font-bold">{deletingUser?.displayName}</span> dal database. Per rimuovere completamente l'accesso, dovrai eliminare l'utente anche dalla console di Firebase Authentication.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">Elimina Profilo</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Gestione Utenti</CardTitle>
                    <CardDescription>
                        Aggiungi, visualizza, modifica ed elimina gli utenti, i loro ruoli e le società associate.
                    </CardDescription>
                </div>
                 {isCurrentUserAdmin && (
                    <Button onClick={() => setIsAddUserOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Aggiungi Utente
                    </Button>
                )}
            </CardHeader>
            <CardContent>
              {!isCurrentUserAdmin ? (
                    <div className="h-24 flex items-center justify-center text-center text-muted-foreground bg-muted/50 rounded-md">
                        <p>Solo gli amministratori possono visualizzare e gestire gli utenti.</p>
                    </div>
                ) : (
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
                            users.map((user: AppUser) => (
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
              )}
            </CardContent>
        </Card>
        </>
    )
}


export default function ImpostazioniPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const settingsDocRef = useMemo(() => {
    // Only attempt to create the ref if the user is an admin
    if (!firestore || user?.role !== 'admin') return null;
    return doc(firestore, 'settings', 'appConfiguration');
  }, [firestore, user]);

  const { data: settingsData, isLoading: isLoadingSettings, error: settingsError } = useDoc<AppSettings>(settingsDocRef);
  
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);

  useEffect(() => {
    // One-time check to create the settings document if it doesn't exist and user is admin
    const initializeSettings = async () => {
        if (!settingsDocRef || settingsData !== null || settingsError) return;
        
        try {
            await setDoc(settingsDocRef, {
                paymentMethods: ['Bonifico', 'Contanti', 'Assegno', 'Carta di Credito', 'Addebito Diretto (SDD)', 'Altro'],
                operators: ['Nuccio Senior', 'Nuccio Junior', 'Mario Rossi'],
                categories: {
                    'Immobiliare': ['Affitti', 'Depositi Cauzionali', 'Recupero Spese', 'Immobili'],
                    'Energia': ['Quote CEF', 'Pratiche Contributo', 'Incentivi GSE', 'Vendita Energia'],
                    'Fornitori': ['Materiali', 'Lavori/Manutenzione', 'Impianti', 'Servizi'],
                    'Gestione Immobili': ['Spese Condominiali', 'Manutenzione', 'Ristrutturazione', 'Utenze'],
                    'Gestione Generale': ['Spese Bancarie', 'Commercialista', 'Telefonia', 'Altre Spese', 'Gestione'],
                    'Tasse': ['IVA Trimestrale', 'IMU', 'IRES', 'IRAP', 'F24 Vari', 'Bolli', 'Cartelle Esattoriali'],
                    'Finanziamenti': ['Rate Mutuo', 'Rate Prestito', 'Rimborso'],
                    'Movimenti Interni': ['Giroconto', 'Trasferimento'],
                    'Da categorizzare': ['Da categorizzare']
                },
                createdAt: serverTimestamp(),
            });
             toast({ title: "Configurazione Inizializzata", description: "Le impostazioni predefinite sono state create." });
        } catch (e) {
             console.error("Failed to initialize settings:", e);
             toast({ variant: 'destructive', title: 'Errore Inizializzazione', description: 'Impossibile creare le impostazioni iniziali.' });
        }
    };
    if (user?.role === 'admin') {
      initializeSettings();
    }
  }, [settingsDocRef, settingsData, settingsError, user?.role, toast]);


  const handleUpdateList = async (type: keyof AppSettings, value: any, action: 'add' | 'remove') => {
    if (!settingsDocRef) return;
    try {
        await updateDoc(settingsDocRef, {
            [type]: action === 'add' ? arrayUnion(value) : arrayRemove(value)
        });
        toast({ title: 'Impostazioni Aggiornate', description: `La lista "${type}" è stata modificata.` });
    } catch (e) {
        console.error(`Error updating ${type}:`, e);
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile aggiornare le impostazioni. Controlla i permessi.' });
    }
  }

  const handleSaveCategory = async (type: 'category' | 'subcategory', name: string, parent?: string) => {
     if (!settingsDocRef) return;
     try {
         if (type === 'category') {
            await updateDoc(settingsDocRef, {
                [`categories.${name}`]: []
            });
            toast({ title: 'Categoria Aggiunta', description: `La categoria "${name}" è stata creata.` });
        } else if (type === 'subcategory' && parent) {
            await updateDoc(settingsDocRef, {
                [`categories.${parent}`]: arrayUnion(name)
            });
            toast({ title: 'Sottocategoria Aggiunta', description: `"${name}" è stata aggiunta a "${parent}".` });
        }
     } catch (e) {
        console.error("Error saving category/subcategory", e);
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile salvare la categoria.' });
     }
  };

  const handleDeleteCategoryItem = async () => {
    if (!itemToDelete || !settingsDocRef) return;
    const { type, name, parent } = itemToDelete;

    try {
        if (type === 'category') {
             const newCategories = { ...settingsData?.categories };
             delete newCategories[name];
             await updateDoc(settingsDocRef, { categories: newCategories });
            toast({ title: 'Categoria Eliminata', description: `La categoria "${name}" e le sue sottocategorie sono state eliminate.` });
        } else if (type === 'subcategory' && parent) {
            await updateDoc(settingsDocRef, {
                [`categories.${parent}`]: arrayRemove(name)
            });
            toast({ title: 'Sottocategoria Eliminata', description: `La sottocategoria "${name}" è stata eliminata da "${parent}".` });
        }
    } catch (e) {
        console.error("Error deleting category item", e);
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile eliminare l\'elemento.' });
    } finally {
        setItemToDelete(null);
    }
  };
  
  const openDeleteDialog = (type: ItemToDelete['type'], name: string, parent?: string) => {
    setItemToDelete({ type, name, parent });
  }

  if (user?.role !== 'admin') {
     return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Amministrazione</h1>
                <p className="text-muted-foreground">
                Questa sezione è riservata agli amministratori.
                </p>
            </div>
            <UserManagementCard />
        </div>
     )
  }

  const categories = settingsData?.categories || {};
  const paymentMethods = settingsData?.paymentMethods || [];
  const operators = settingsData?.operators || [];

  return (
    <div className="space-y-8">
      <AddCategoryDialog
        isOpen={isCategoryDialogOpen}
        setIsOpen={setIsCategoryDialogOpen}
        onSave={handleSaveCategory}
        existingCategories={Object.keys(categories)}
      />
       <AlertDialog open={!!itemToDelete && (itemToDelete.type === 'category' || itemToDelete.type === 'subcategory')} onOpenChange={(isOpen) => !isOpen && setItemToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Sei sicuro di voler eliminare?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {itemToDelete?.type === 'category' ?
                          `Questa azione eliminerà la categoria "${itemToDelete.name}" e tutte le sue sottocategorie. L'azione non può essere annullata.` :
                          `Questa azione eliminerà la sottocategoria "${itemToDelete?.name}" da "${itemToDelete?.parent}". L'azione non può essere annullata.`
                        }
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteCategoryItem} className="bg-destructive hover:bg-destructive/90">Elimina</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      <div>
        <h1 className="text-3xl font-bold">Amministrazione</h1>
        <p className="text-muted-foreground">
          Gestisci le opzioni globali e le personalizzazioni della tua applicazione.
        </p>
      </div>

       <UserManagementCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <SocietaManagementCard />
          <SettingsListManager title="Metodi di Pagamento" items={paymentMethods} itemType="paymentMethods" onUpdate={handleUpdateList} isLoading={isLoadingSettings} />
        </div>
        <div className="space-y-8">
           <SettingsListManager title="Operatori" items={operators} itemType="operators" onUpdate={handleUpdateList} isLoading={isLoadingSettings} />
          <Card>
            <CardHeader className='flex-row items-center justify-between'>
              <div>
                <CardTitle>Categorie e Sottocategorie</CardTitle>
                <CardDescription>
                  Gestisci le categorie per i movimenti e i suggerimenti AI.
                </CardDescription>
              </div>
               {isLoadingSettings ? <Skeleton className="h-10 w-28" /> : (
                 <Button onClick={() => setIsCategoryDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi
                 </Button>
               )}
            </CardHeader>
            <CardContent>
                {isLoadingSettings ? <Skeleton className="h-40 w-full" /> : (
                  <Accordion type="single" collapsible className="w-full">
                    {Object.entries(categories).map(([category, subcategories]) => (
                    <AccordionItem value={category} key={category}>
                        <div className="flex items-center w-full group">
                            <AccordionTrigger className="flex-1 hover:no-underline">
                                <span className="font-semibold text-left">{category}</span>
                            </AccordionTrigger>
                            <Button variant="ghost" size="icon" className="mr-2 shrink-0 opacity-50 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); openDeleteDialog('category', category); }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                        <AccordionContent>
                        <div className="space-y-2 pl-4">
                            {subcategories.map(sub => (
                            <div key={sub} className="flex items-center justify-between p-2 rounded-md bg-muted/50 group">
                                <span>{sub}</span>
                                <Button variant="ghost" size="icon" className="opacity-50 group-hover:opacity-100" onClick={() => openDeleteDialog('subcategory', sub, category)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                            ))}
                            {subcategories.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Nessuna sottocategoria.</p>}
                        </div>
                        </AccordionContent>
                    </AccordionItem>
                    ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
