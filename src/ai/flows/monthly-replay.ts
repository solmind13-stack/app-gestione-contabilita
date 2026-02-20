'use server';

/**
 * @fileOverview Un flow AI per eseguire il "Replay Mensile".
 * Confronta le previsioni passate con i dati reali del mese per calcolare l'accuratezza
 * e generare suggerimenti di calibrazione per il modello.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, query, where, getDocs, addDoc, orderBy, limit } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { MonthlyReplay, Movimento, CashFlowProjection, Scadenza } from '@/lib/types';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const MonthlyReplayInputSchema = z.object({
  societa: z.string().describe("La società da analizzare."),
  userId: z.string().describe("L'ID dell'utente."),
  month: z.number().min(1).max(12).describe("Il mese (1-12)."),
  year: z.number().describe("L'anno."),
});

const CategoryComparisonSchema = z.object({
  category: z.string(),
  predicted: z.number(),
  actual: z.number(),
  deviation: z.number(),
});

const MonthlyReplayOutputSchema = z.object({
  replay: z.any().describe("L'oggetto MonthlyReplay completo."),
  calibrations: z.array(z.object({
    type: z.string(),
    target: z.string(),
    adjustment: z.number(),
    reason: z.string()
  })),
  categoryBreakdown: z.array(CategoryComparisonSchema),
});

export async function monthlyReplay(input: z.infer<typeof MonthlyReplayInputSchema>) {
  return monthlyReplayFlow(input);
}

const prompt = ai.definePrompt({
  name: 'monthlyReplayPrompt',
  input: { 
    schema: z.object({ 
      societa: z.string(), 
      monthName: z.string(),
      year: z.number(),
      stats: z.string(),
      categories: z.string()
    }) 
  },
  output: { schema: MonthlyReplayOutputSchema },
  prompt: `
    Sei un Senior Financial Controller. Devi analizzare il "Replay" del mese di {{monthName}} {{year}} per la società {{societa}}.
    
    DATI DI CONFRONTO (JSON):
    {{{stats}}}
    
    DETTAGLIO CATEGORIE:
    {{{categories}}}

    IL TUO COMPITO:
    1. Calcola l'accuratezza complessiva (0-100) basandoti sugli scostamenti.
    2. Identifica i BIAS del modello (es: "Le entrate sono sovrastimate del 10%", "La categoria Tasse è sempre sottostimata").
    3. Genera un report narrativo in italiano (max 5-6 frasi) che spieghi all'imprenditore perché ci sono stati scostamenti (es: ritardo clienti, spese impreviste).
    4. Proponi delle 'calibrations' tecniche per il futuro (es: adjustment -0.1 per le entrate se sovrastimate).
    
    Sii molto tecnico ma chiaro. Usa un tono professionale.
    Rispondi esclusivamente in formato JSON.
  `,
});

const monthlyReplayFlow = ai.defineFlow(
  {
    name: 'monthlyReplayFlow',
    inputSchema: MonthlyReplayInputSchema,
    outputSchema: MonthlyReplayOutputSchema,
  },
  async (input) => {
    const { societa, userId, month, year } = input;
    const targetDate = new Date(year, month - 1, 1);
    const monthName = format(targetDate, 'MMMM', { locale: it });

    try {
      // 1. Recupero Movimenti Reali
      const movementsRef = collection(db, 'movements');
      const start = startOfMonth(targetDate).toISOString().split('T')[0];
      const end = endOfMonth(targetDate).toISOString().split('T')[0];
      const mvQuery = query(movementsRef, where('societa', '==', societa), where('data', '>=', start), where('data', '<=', end));
      const mvSnap = await getDocs(mvQuery);
      const actualMovements = mvSnap.docs.map(d => d.data() as Movimento);

      // 2. Recupero Proiezione passata (generata prima dell'inizio del mese target)
      const projRef = collection(db, 'cashFlowProjections');
      const projQuery = query(
        projRef, 
        where('societa', '==', societa), 
        where('scenarioType', '==', 'realistic'),
        where('generatedAt', '<', start),
        orderBy('generatedAt', 'desc'),
        limit(1)
      );
      const projSnap = await getDocs(projQuery);
      const baseline = projSnap.docs[0]?.data() as CashFlowProjection;

      if (!baseline) {
        throw new Error(`Nessuna proiezione trovata per il periodo precedente a ${monthName} ${year}.`);
      }

      // 3. Elaborazione Dati (TypeScript)
      const predictedMonth = baseline.monthlyProjections.find(p => p.month === month && p.year === year);
      
      const actualIn = actualMovements.reduce((s, m) => s + (m.entrata || 0), 0);
      const actualOut = actualMovements.reduce((s, m) => s + (m.uscita || 0), 0);
      
      const predIn = predictedMonth?.inflows || 0;
      const predOut = predictedMonth?.outflows || 0;

      // Breakdown per categoria
      const catStats: Record<string, { pred: number, act: number }> = {};
      actualMovements.forEach(m => {
        const cat = m.categoria || 'Altro';
        if (!catStats[cat]) catStats[cat] = { pred: 0, act: 0 };
        catStats[cat].act += (m.entrata || m.uscita || 0);
      });

      const stats = {
        predictedInflows: predIn,
        actualInflows: actualIn,
        predictedOutflows: predOut,
        actualOutflows: actualOut,
        netGap: (actualIn - actualOut) - (predIn - predOut)
      };

      // 4. Chiamata a Gemini per interpretazione
      const { output } = await prompt({
        societa,
        monthName,
        year,
        stats: JSON.stringify(stats),
        categories: JSON.stringify(catStats)
      });

      if (!output) throw new Error("L'AI non è riuscita a generare il replay.");

      const finalReplay: MonthlyReplay = {
        id: `replay_${societa}_${year}_${month}`,
        societa,
        userId,
        month,
        year,
        predictedInflows: predIn,
        actualInflows: actualIn,
        predictedOutflows: predOut,
        actualOutflows: actualOut,
        accuracyScore: output.replay.accuracyScore,
        narrative: output.replay.narrative,
        corrections: output.calibrations.map((c: any) => c.reason),
        generatedAt: new Date().toISOString(),
      };

      // 5. Salvataggio su Firestore
      await addDoc(collection(db, 'monthlyReplays'), finalReplay);
      
      for (const cal of output.calibrations) {
        await addDoc(collection(db, 'modelCalibrations'), {
          ...cal,
          societa,
          userId,
          applied: false,
          createdAt: new Date().toISOString()
        });
      }

      return output;

    } catch (error: any) {
      console.error("Monthly Replay flow failed:", error);
      throw new Error(error.message || "Errore durante l'analisi del replay mensile.");
    }
  }
);
