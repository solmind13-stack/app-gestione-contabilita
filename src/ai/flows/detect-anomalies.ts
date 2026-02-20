'use server';

/**
 * @fileOverview Un flow AI per monitorare i movimenti recenti e identificare spese anomale rispetto allo storico.
 * Esegue l'analisi statistica in TypeScript e usa Gemini per generare descrizioni esplicative.
 *
 * - detectAnomalies - Funzione principale per l'analisi.
 * - DetectAnomaliesInput - Schema di input (società e utente).
 * - DetectAnomaliesOutput - Schema di output con anomalie trovate.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, addDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { Movimento, AnomalyAlert } from '@/lib/types';
import { subMonths, subDays, startOfToday, parseISO } from 'date-fns';

// Inizializzazione Firebase lato server
if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const DetectAnomaliesInputSchema = z.object({
  societa: z.string().describe("La società per cui analizzare le anomalie ('LNC' o 'STG')."),
  userId: z.string().describe("L'ID dell'utente che richiede l'analisi."),
});

const DetectAnomaliesOutputSchema = z.object({
  anomalies: z.any().describe("Array di oggetti AnomalyAlert rilevati."),
  summary: z.string().describe("Breve riepilogo dell'analisi."),
});

// Prompt per Gemini dedicato alla spiegazione dell'anomalia
const explanationPrompt = ai.definePrompt({
  name: 'anomalyExplanationPrompt',
  input: { 
    schema: z.object({ 
      category: z.string(),
      amount: z.number(),
      avg: z.number(),
      max: z.number(),
      description: z.string()
    }) 
  },
  output: { schema: z.object({ explanation: z.string() }) },
  prompt: `Sei un supervisore finanziario. Ho rilevato una spesa anomala per la categoria {{category}}.
  Dettagli Movimento: {{description}}
  Importo: {{amount}}€
  Statistiche Storiche Categoria: Media={{avg}}€, Massimo Storico={{max}}€
  
  Genera una spiegazione sintetica (max 2 frasi) in italiano che avvisi l'imprenditore dello scostamento e suggerisca cosa verificare.
  Esempio: "Spesa di {{amount}}€ superiore del 50% rispetto alla media abituale per {{category}} ({{avg}}€). Verificare se si tratta di un costo straordinario o di un errore di fatturazione."`,
});

export async function detectAnomalies(input: z.infer<typeof DetectAnomaliesInputSchema>) {
  return detectAnomaliesFlow(input);
}

const detectAnomaliesFlow = ai.defineFlow(
  {
    name: 'detectAnomaliesFlow',
    inputSchema: DetectAnomaliesInputSchema,
    outputSchema: DetectAnomaliesOutputSchema,
  },
  async (input) => {
    const { societa, userId } = input;
    const today = startOfToday();
    const oneYearAgo = subMonths(today, 12).toISOString();
    const thirtyDaysAgo = subDays(today, 30).toISOString();

    try {
      // 1. Recupero dati storici (ultimi 12 mesi)
      const movementsRef = collection(db, 'movements');
      const histQuery = query(movementsRef, where('societa', '==', societa), where('data', '>=', oneYearAgo));
      const histSnapshot = await getDocs(histQuery);
      const allMovements: Movimento[] = [];
      histSnapshot.forEach(d => allMovements.push({ id: d.id, ...d.data() } as any));

      if (allMovements.length === 0) {
        return { anomalies: [], summary: "Dati storici insufficienti per l'analisi delle anomalie." };
      }

      // 2. Calcolo statistiche per categoria
      const stats: Record<string, { sum: number, count: number, max: number, values: number[] }> = {};
      
      allMovements.forEach(m => {
        if (m.uscita <= 0) return;
        const cat = m.categoria || 'Altro';
        if (!stats[cat]) stats[cat] = { sum: 0, count: 0, max: 0, values: [] };
        stats[cat].sum += m.uscita;
        stats[cat].count += 1;
        stats[cat].max = Math.max(stats[cat].max, m.uscita);
        stats[cat].values.push(m.uscita);
      });

      const categoryMetrics: Record<string, { avg: number, stdDev: number, max: number }> = {};
      for (const cat in stats) {
        const avg = stats[cat].sum / stats[cat].count;
        const squareDiffs = stats[cat].values.map(v => Math.pow(v - avg, 2));
        const stdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / stats[cat].count);
        categoryMetrics[cat] = { avg, stdDev, max: stats[cat].max };
      }

      // 3. Analisi movimenti recenti (ultimi 30 giorni)
      const recentMovements = allMovements.filter(m => m.data >= thirtyDaysAgo);
      const detectedAnomalies: Omit<AnomalyAlert, 'id'>[] = [];

      for (const m of recentMovements) {
        const metrics = categoryMetrics[m.categoria];
        if (!metrics || metrics.avg === 0) continue;

        // Logica di rilevamento: scostamento dalla media > 1.5 deviazioni standard
        // o importo che supera il massimo storico del 20%
        const threshold = metrics.avg + (1.5 * metrics.stdDev);
        const isAnomaly = m.uscita > threshold || m.uscita > (metrics.max * 1.2);

        if (isAnomaly) {
          // Generazione spiegazione con Gemini
          const { output } = await explanationPrompt({
            category: m.categoria,
            amount: m.uscita,
            avg: Math.round(metrics.avg),
            max: Math.round(metrics.max),
            description: m.descrizione
          });

          detectedAnomalies.push({
            societa,
            userId,
            category: m.categoria,
            amount: m.uscita,
            expectedRange: {
              min: Math.max(0, Math.round(metrics.avg - metrics.stdDev)),
              max: Math.round(threshold)
            },
            movementId: m.id,
            description: output?.explanation || `Spesa anomala per ${m.categoria}.`,
            status: 'pending',
            createdAt: new Date().toISOString()
          });
        }
      }

      // 4. Salvataggio anomalie su Firestore
      const alertsRef = collection(db, 'anomalyAlerts');
      const savedAnomalies: AnomalyAlert[] = [];

      for (const anomaly of detectedAnomalies) {
        // Evitiamo duplicati per lo stesso movimento
        const dupQuery = query(alertsRef, where('movementId', '==', anomaly.movementId));
        const dupSnap = await getDocs(dupQuery);
        if (dupSnap.empty) {
          const docRef = await addDoc(alertsRef, anomaly);
          savedAnomalies.push({ id: docRef.id, ...anomaly });
        }
      }

      return {
        anomalies: savedAnomalies,
        summary: `Analisi completata. Rilevate ${savedAnomalies.length} potenziali anomalie negli ultimi 30 giorni.`
      };

    } catch (error: any) {
      console.error("Errore nel flow 'detectAnomaliesFlow':", error);
      throw new Error("L'analisi delle anomalie non è riuscita.");
    }
  }
);
