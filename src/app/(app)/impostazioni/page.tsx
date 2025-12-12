// src/app/(app)/impostazioni/page.tsx
"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { AppUser } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

// Mock data based on the user's image
const initialData = {
  operators: ['Gibilisco Salvato', 'Gibilisco Nuccio'],
  accounts: ['LNC-BAPR', 'STG-BAPR'],
  paymentMethods: ['Bonifico', 'Contanti', 'Carta', 'Addebito'],
  categories: {
    'Immobiliare': ['Affitti', 'Depositi Cauzionali', 'Recupero Spese', 'Immobili'],
    'Energia': ['Quote CEF', 'Pratiche Contributo', 'Incentivi GSE', 'Vendita Energia'],
    'Fornitori': ['Materiali', 'Lavori/Manutenzione', 'Impianti', 'Servizi'],
    'Gestione Immobili': ['Spese Condominiali', 'Manutenzione', 'Ristrutturazione', 'Utenze'],
    'Gestione Generale': ['Spese Bancarie', 'Commercialista', 'Telefonia', 'Altre Spese', 'Gestione'],
    'Tasse': ['IVA Trimestrale', 'IMU', 'IRES', 'IRAP', 'F24 Vari', 'Bolli', 'Cartelle Esattoriali'],
    'Finanziamenti': ['Rate Mutuo', 'Rate Prestito', 'Rimborso'],
    'Movimenti Interni': ['Giroconto', 'Trasferimento'],
  },
};

type CategoryData = typeof initialData.categories;

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
    const firestore = useFirestore();
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // This query will be protected by security rules, only admins can execute it.
        return query(collection(firestore, 'users'));
    }, [firestore]);

    const { data: users, isLoading, error } = useCollection<AppUser>(usersQuery);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gestione Utenti</CardTitle>
                <CardDescription>
                    Visualizza gli utenti registrati nel database e i loro ruoli. Solo gli admin possono vedere questa sezione.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Ruolo</TableHead>
                            <TableHead>Società</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                </TableCell>
                            </TableRow>
                        ) : error ? (
                             <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-red-500">
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
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    Nessun utente trovato nel database.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}


export default function ImpostazioniPage() {
  const { user } = useUser();
  const [operators, setOperators] = useState(initialData.operators);
  const [accounts, setAccounts] = useState(initialData.accounts);
  const [paymentMethods, setPaymentMethods] = useState(initialData.paymentMethods);
  const [categories, setCategories] = useState<CategoryData>(initialData.categories);
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState<{ category: string; value: string }>({ category: '', value: '' });

  const handleAddCategory = () => {
    if (newCategory && !categories.hasOwnProperty(newCategory)) {
      setCategories({ ...categories, [newCategory]: [] });
      setNewCategory('');
    }
  };
  
  const handleRemoveCategory = (categoryToRemove: string) => {
    const { [categoryToRemove as keyof CategoryData]: _, ...remainingCategories } = categories;
    setCategories(remainingCategories);
  };

  const handleAddSubcategory = (category: string) => {
    if (newSubcategory.value && !categories[category as keyof CategoryData].includes(newSubcategory.value)) {
      const updatedCategories = { ...categories };
      updatedCategories[category as keyof CategoryData] = [...updatedCategories[category as keyof CategoryData], newSubcategory.value].sort();
      setCategories(updatedCategories);
      setNewSubcategory({ category: '', value: '' });
    }
  };
  
  const handleRemoveSubcategory = (category: string, subcategoryToRemove: string) => {
    const updatedCategories = { ...categories };
    updatedCategories[category as keyof CategoryData] = updatedCategories[category as keyof CategoryData].filter(sub => sub !== subcategoryToRemove);
    setCategories(updatedCategories);
  };
  


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
          <CardHeader>
            <CardTitle>Categorie e Sottocategorie</CardTitle>
            <CardDescription>
              Aggiungi o rimuovi categorie e le relative sottocategorie per l'organizzazione dei movimenti.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {Object.entries(categories).map(([category, subcategories]) => (
                <AccordionItem value={category} key={category}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <span className="font-semibold">{category}</span>
                       <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleRemoveCategory(category); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                       </Button>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-4">
                      {subcategories.map(sub => (
                        <div key={sub} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <span>{sub}</span>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveSubcategory(category, sub)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                       <div className="flex gap-2 pt-2">
                          <Input 
                            value={newSubcategory.category === category ? newSubcategory.value : ''}
                            onChange={(e) => setNewSubcategory({ category, value: e.target.value })}
                            placeholder="Nuova sottocategoria..."
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSubcategory(category)}
                          />
                          <Button size="sm" onClick={() => handleAddSubcategory(category)}>Aggiungi</Button>
                        </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <Separator className="my-6" />
            <div className="space-y-2">
                <h4 className="font-semibold">Aggiungi Nuova Categoria</h4>
                <div className="flex gap-2">
                <Input 
                    value={newCategory} 
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Nome nuova categoria..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <Button onClick={handleAddCategory}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Crea Categoria
                </Button>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
