// src/components/pianificazione/entity-scores-card.tsx
'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, doc, writeBatch, CollectionReference, DocumentData } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Sparkles, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { calculateEntityScores } from '@/ai/flows/calculate-entity-scores';
import { cn } from '@/lib/utils';
import type { Movimento, Scadenza, EntityScore } from '@/lib/types';
import { subYears, startOfToday } from 'date-fns';

interface EntityScoresCardProps {
  societa: string;
}

const getQuery = (firestore: any, societa: string, collectionName: string) => {
    if (!firestore) return null;
    let q: CollectionReference<DocumentData> | Query<DocumentData> = collection(firestore, collectionName);
    if (societa !== 'Tutte') {
        q = query(q, where('societa', '==', societa));
    }
    return q;
};

export function EntityScoresCard({ societa }: EntityScoresCardProps) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isUpdating, setIsUpdating] = useState(false);

    const scoresQuery = useMemo(() => {
        if (!firestore || !user) return null;
        let q = query(collection(firestore, 'users', user.uid, 'entityScores'));
        if (societa !== 'Tutte') {
            q = query(q, where('societa', '==', societa));
        }
        return q;
    }, [firestore, user, societa]);

    const { data: scores, isLoading: isLoadingScores } = useCollection<EntityScore>(scoresQuery);

    const twoYearsAgo = useMemo(() => subYears(startOfToday(), 2).toISOString(), []);
    const movementsQuery = useMemo(() => {
        if (!firestore) return null;
        let q: Query<DocumentData> = collection(firestore, 'movements');
        if (societa !== 'Tutte') {
            q = query(q, where('societa', '==', societa), where('data', '>=', twoYearsAgo));
        } else {
            q = query(q, where('data', '>=', twoYearsAgo));
        }
        return q;
    }, [firestore, societa, twoYearsAgo]);
    const deadlinesQuery = useMemo(() => getQuery(firestore, societa, 'deadlines'), [firestore, societa]);

    const { data: movements, isLoading: isLoadingMovements } = useCollection<Movimento>(movementsQuery);
    const { data: deadlines, isLoading: isLoadingDeadlines } = useCollection<Scadenza>(deadlinesQuery);
    
    const isLoadingData = isLoadingScores || isLoadingMovements || isLoadingDeadlines;

    const handleUpdateScores = async () => {
        if (!user || !firestore || !movements || !deadlines) {
            toast({ variant: 'destructive', title: 'Dati non pronti', description: 'Attendi il caricamento dei dati prima di generare gli score.' });
            return;
        }
        setIsUpdating(true);
        toast({ title: 'Aggiornamento Score in Corso...', description: 'L\'AI sta analizzando lo storico dei pagamenti.' });

        try {
            const result = await calculateEntityScores({
                societa: societa,
                userId: user.uid,
                movements: JSON.stringify(movements),
                deadlines: JSON.stringify(deadlines),
            });
            
            if (result.scores && result.scores.length > 0) {
                const batch = writeBatch(firestore);
                result.scores.forEach(score => {
                    const docId = `${score.societa}_${score.entityName.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    const docRef = doc(firestore, 'users', user.uid, 'entityScores', docId);
                    batch.set(docRef, { ...score, id: docId, userId: user.uid });
                });
                await batch.commit();
                toast({ title: 'Score Aggiornati!', description: result.summary, className: 'bg-green-100 dark:bg-green-900' });
            } else {
                toast({ title: 'Nessun Dato', description: 'Nessuna entità trovata da analizzare.' });
            }
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Errore Aggiornamento', description: e.message || 'Impossibile completare l\'aggiornamento degli score.' });
        } finally {
            setIsUpdating(false);
        }
    };
    
    const sortedClients = useMemo(() => (scores || []).filter(s => s.entityType === 'client').sort((a, b) => a.reliabilityScore - b.reliabilityScore), [scores]);
    const sortedSuppliers = useMemo(() => (scores || []).filter(s => s.entityType === 'supplier').sort((a, b) => a.reliabilityScore - b.reliabilityScore), [scores]);

    const renderScoreList = (data: EntityScore[]) => (
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
            {data.map(score => {
                const scoreColor = score.reliabilityScore > 75 ? 'bg-green-500' : score.reliabilityScore > 50 ? 'bg-yellow-500' : 'bg-red-500';
                return (
                    <div key={score.id} className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-medium">{score.entityName}</span>
                            <span className="font-bold">{score.reliabilityScore} / 100</span>
                        </div>
                        <Progress value={score.reliabilityScore} className="h-2" indicatorClassName={scoreColor} />
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Ritardo medio: {score.averagePaymentDelay}gg</span>
                            <span>{score.totalTransactions} transazioni</span>
                        </div>
                    </div>
                )
            })}
        </div>
    );

    return (
        <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">Score Clienti/Fornitori</CardTitle>
                <Users className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-4">
                 <Button onClick={handleUpdateScores} disabled={isUpdating || isLoadingData} size="sm" variant="outline" className="w-full">
                    {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                    {scores && scores.length > 0 ? 'Aggiorna Score' : 'Calcola Score'}
                </Button>
                {isLoadingScores ? (
                     <div className="flex items-center justify-center h-60">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : scores && scores.length > 0 ? (
                    <Tabs defaultValue="suppliers">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="suppliers">Fornitori ({sortedSuppliers.length})</TabsTrigger>
                            <TabsTrigger value="clients">Clienti ({sortedClients.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="suppliers" className="pt-4">
                            {sortedSuppliers.length > 0 ? renderScoreList(sortedSuppliers) : <p className="text-sm text-center text-muted-foreground p-8">Nessun fornitore analizzato.</p>}
                        </TabsContent>
                        <TabsContent value="clients" className="pt-4">
                            {sortedClients.length > 0 ? renderScoreList(sortedClients) : <p className="text-sm text-center text-muted-foreground p-8">Nessun cliente analizzato.</p>}
                        </TabsContent>
                    </Tabs>
                ) : (
                    <div className="text-center text-muted-foreground p-8">
                        <p>Clicca "Calcola Score" per analizzare lo storico e generare i punteggi.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
