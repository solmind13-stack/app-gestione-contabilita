'use server';

/**
 * @fileOverview Un flow AI per analizzare lo storico dei movimenti e calcolare un punteggio di affidabilità per clienti e fornitori.
 * Esegue i calcoli numerici in TypeScript e usa Gemini per generare un riepilogo in linguaggio naturale.
 *
 * - calculateEntityScores - La funzione principale che orchestra l'analisi.
 * - CalculateEntityScoresInput - Lo schema di input per il flow.
 * - CalculateEntityScoresOutput - Lo schema di output del flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, query, where, getDocs, doc, writeBatch } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { EntityScore, Movimento, Scadenza } from '@/lib/types/pianificazione';
import { subMonths, startOfToday, differenceInDays, parseISO } from 'date-fns';

// Inizializzazione Firebase lato server per l'accesso a Firestore nel flow
if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const CalculateEntityScoresInputSchema = z.object({
  societa: z.string().describe("La società per cui calcolare i punteggi ('LNC' o 'STG')."),
  userId: z.string().describe("L'ID dell'utente che richiede l'analisi."),
});

const CalculateEntityScoresOutputSchema = z.object({
  scores: z.any().describe("L'array di oggetti EntityScore calcolati."),
  summary: z.string().describe("Un riepilogo testuale in italiano dei risultati."),
});

export async function calculateEntityScores(input: { societa: string, userId: string }) {
  return calculateEntityScoresFlow(input);
}

// Prompt per Gemini dedicato alla sola generazione della narrativa
const narrativePrompt = ai.definePrompt({
  name: 'entityScoresNarrativePrompt',
  input: { schema: z.object({ analysisData: z.string() }) },
  output: { schema: z.object({ summary: z.string() }) },
  prompt: `Sei un esperto analista finanziario per aziende italiane.
  Ho calcolato degli score di affidabilità (da 0 a 100) per i clienti e i fornitori basandomi sullo storico dei pagamenti degli ultimi 24 mesi.
  
  Ecco i dati calcolati (nome, tipo, score, ritardo medio):
  {{analysisData}}

  Genera un breve riassunto (summary) in italiano naturale che spieghi i risultati principali.
  Evidenzia le entità più virtuose e quelle che richiedono attenzione (score bassi o ritardi significativi).
  Usa un tono professionale ma accessibile. Massimo 3-4 frasi.`,
});

const calculateEntityScoresFlow = ai.defineFlow(
  {
    name: 'calculateEntityScoresFlow',
    inputSchema: CalculateEntityScoresInputSchema,
    outputSchema: CalculateEntityScoresOutputSchema,
  },
  async (input) => {
    try {
      const { societa, userId } = input;
      const today = startOfToday();
      const twentyFourMonthsAgo = subMonths(today, 24).toISOString();
      const sixMonthsAgo = subMonths(today, 6).toISOString();

      // 1. Recupero dati da Firestore
      const movementsRef = collection(db, 'movements');
      const mvQuery = query(movementsRef, where('societa', '==', societa), where('data', '>=', twentyFourMonthsAgo));
      const mvSnapshot = await getDocs(mvQuery);
      const movements: Movimento[] = [];
      mvSnapshot.forEach(d => movements.push({ id: d.id, ...d.data() } as any));

      const deadlinesRef = collection(db, 'deadlines');
      const dlQuery = query(deadlinesRef, where('societa', '==', societa), where('dataScadenza', '>=', twentyFourMonthsAgo));
      const dlSnapshot = await getDocs(dlQuery);
      const deadlines: Scadenza[] = [];
      dlSnapshot.forEach(d => deadlines.push({ id: d.id, ...d.data() } as any));

      if (movements.length === 0) {
        return { scores: [], summary: "Nessun dato storico sufficiente per l'analisi." };
      }

      // 2. Raggruppamento e Analisi (TypeScript Puro)
      const entities: Record<string, {
        name: string;
        type: 'client' | 'supplier';
        totalTransactions: number;
        totalDelayDays: number;
        delaysCount: number;
        onTimeCount: number;
        recentTransactions: number;
        olderTransactions: number;
      }> = {};

      movements.forEach(m => {
        // Normalizzazione semplice del nome entità dalla descrizione
        const entityName = m.descrizione.split(/ - | \/ | \(| n\./)[0].trim();
        if (!entities[entityName]) {
          entities[entityName] = {
            name: entityName,
            type: m.entrata > 0 ? 'client' : 'supplier',
            totalTransactions: 0,
            totalDelayDays: 0,
            delaysCount: 0,
            onTimeCount: 0,
            recentTransactions: 0,
            olderTransactions: 0,
          };
        }

        const entity = entities[entityName];
        entity.totalTransactions++;
        if (m.data >= sixMonthsAgo) entity.recentTransactions++;
        else entity.olderTransactions++;

        // Calcolo ritardo se collegato a una scadenza
        if (m.linkedTo) {
          const dlId = m.linkedTo.split('/')[1];
          const dl = deadlines.find(d => d.id === dlId);
          if (dl) {
            const delay = differenceInDays(parseISO(m.data), parseISO(dl.dataScadenza));
            entity.totalDelayDays += delay;
            entity.delaysCount++;
            if (delay <= 0) entity.onTimeCount++;
          }
        }
      });

      const calculatedScores: EntityScore[] = [];
      const todayIso = today.toISOString();

      for (const name in entities) {
        const entity = entities[name];
        let score = 50; // Base

        const onTimePercentage = entity.delaysCount > 0 
          ? (entity.onTimeCount / entity.delaysCount) * 100 
          : 80; // Default se non ci sono scadenze collegate

        const avgDelay = entity.delaysCount > 0 
          ? entity.totalDelayDays / entity.delaysCount 
          : 0;

        // Applicazione logica a punti
        if (onTimePercentage > 90) score += 20;
        else if (onTimePercentage > 75) score += 10;

        if (avgDelay > 30) score -= 20;
        else if (avgDelay > 15) score -= 10;

        // Trend (semplificato basato sulla frequenza)
        const recentFreq = entity.recentTransactions / 6;
        const olderFreq = entity.olderTransactions / 18;
        if (recentFreq > olderFreq * 1.2) score += 10;
        else if (recentFreq < olderFreq * 0.8) score -= 10;

        if (entity.totalTransactions > 20) score += 10;

        score = Math.max(0, Math.min(100, score));

        calculatedScores.push({
          id: `score_${societa}_${name.replace(/[^a-zA-Z0-9]/g, '_')}`,
          societa,
          userId,
          entityName: entity.name,
          entityType: entity.type,
          reliabilityScore: Math.round(score),
          averagePaymentDelay: Math.round(avgDelay),
          totalTransactions: entity.totalTransactions,
          onTimePercentage: Math.round(onTimePercentage),
          lastUpdated: todayIso,
          history: [{
            date: todayIso,
            score: Math.round(score),
            reason: "Analisi automatica storico movimenti"
          }]
        });
      }

      // 3. Generazione Narrativa con Gemini
      const analysisData = JSON.stringify(calculatedScores.map(s => ({
        n: s.entityName,
        t: s.entityType,
        s: s.reliabilityScore,
        d: s.averagePaymentDelay
      })));

      const { output } = await narrativePrompt({ analysisData });
      const summary = output?.summary || "Analisi score completata con successo.";

      // 4. Salvataggio su Firestore
      const batch = writeBatch(db);
      calculatedScores.forEach(score => {
        const scoreRef = doc(db, 'users', userId, 'entityScores', score.id);
        batch.set(scoreRef, score);
      });
      await batch.commit();

      return { scores: calculatedScores, summary };

    } catch (error) {
      console.error("Errore nel flow 'calculateEntityScoresFlow':", error);
      throw new Error("L'analisi dei punteggi di affidabilità non è riuscita.");
    }
  }
);
