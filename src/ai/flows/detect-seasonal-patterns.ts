'use server';

/**
 * @fileOverview Un flow AI per analizzare i movimenti storici e identificare pattern stagionali ricorrenti.
 * Esegue i calcoli statistici in TypeScript e usa Gemini per generare la narrativa.
 *
 * - detectSeasonalPatterns - La funzione principale che orchestra l'analisi.
 * - DetectSeasonalPatternsInput - Lo schema di input per il flow.
 * - DetectSeasonalPatternsOutput - Lo schema di output del flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { Movimento } from '@/lib/types';
import { subMonths, startOfToday, getMonth, getYear, parseISO } from 'date-fns';

// Inizializzazione Firebase lato server
if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const DetectSeasonalPatternsInputSchema = z.object({
  societa: z.string().describe("La società per cui calcolare i pattern ('LNC' o 'STG')."),
  userId: z.string().describe("L'ID dell'utente che richiede l'analisi."),
});

const SeasonalPatternSchema = z.object({
  month: z.number().min(1).max(12),
  type: z.enum(['expense_peak', 'expense_dip', 'income_peak', 'income_dip']),
  changePercent: z.number(),
  categories: z.array(z.string()),
  confidence: z.enum(['confirmed', 'probable']),
  description: z.string(),
});

const DetectSeasonalPatternsOutputSchema = z.object({
  patterns: z.array(SeasonalPatternSchema),
  narrative: z.string(),
  monthsAnalyzed: z.number(),
});

export async function detectSeasonalPatterns(input: { societa: string, userId: string }) {
  return detectSeasonalPatternsFlow(input);
}

// Prompt per Gemini dedicato alla generazione della narrativa
const narrativePrompt = ai.definePrompt({
  name: 'seasonalPatternsNarrativePrompt',
  input: { schema: z.object({ analysisData: z.string(), societa: z.string() }) },
  output: { schema: z.object({ narrative: z.string() }) },
  prompt: `Sei un esperto analista finanziario per aziende italiane.
  Ho analizzato lo storico dei flussi di cassa degli ultimi 3 anni per la società {{societa}} e ho identificato questi pattern stagionali (mesi con picchi o cali ricorrenti):
  
  Dati Analisi:
  {{analysisData}}

  Genera una narrativa sintetica e professionale in italiano (3-4 frasi) che spieghi questi cicli stagionali all'imprenditore.
  Evidenzia i mesi più critici per le uscite e i periodi di forza delle entrate.
  Usa un tono consulenziale e orientato alla pianificazione.`,
});

const detectSeasonalPatternsFlow = ai.defineFlow(
  {
    name: 'detectSeasonalPatternsFlow',
    inputSchema: DetectSeasonalPatternsInputSchema,
    outputSchema: DetectSeasonalPatternsOutputSchema,
  },
  async (input) => {
    try {
      const { societa, userId } = input;
      const today = startOfToday();
      const thirtySixMonthsAgo = subMonths(today, 36).toISOString();

      // 1. Recupero dati da Firestore
      const movementsRef = collection(db, 'movements');
      const q = query(movementsRef, where('societa', '==', societa), where('data', '>=', thirtySixMonthsAgo));
      const snapshot = await getDocs(q);
      const movements: Movimento[] = [];
      snapshot.forEach(d => movements.push({ id: d.id, ...d.data() } as any));

      if (movements.length < 12) {
        return { patterns: [], narrative: "Dati storici insufficienti per rilevare pattern stagionali (minimo 12 mesi).", monthsAnalyzed: movements.length };
      }

      // 2. Analisi Statistica (TypeScript Puro)
      // Struttura: [month][year] = { income, expense }
      const monthlyStats: Record<number, Record<number, { income: number, expense: number, categories: Set<string> }>> = {};
      let globalTotalIncome = 0;
      let globalTotalExpense = 0;
      let dataPoints = 0;

      movements.forEach(m => {
        const date = parseISO(m.data);
        const mMonth = getMonth(date) + 1; // 1-12
        const mYear = getYear(date);

        if (!monthlyStats[mMonth]) monthlyStats[mMonth] = {};
        if (!monthlyStats[mMonth][mYear]) monthlyStats[mMonth][mYear] = { income: 0, expense: 0, categories: new Set() };

        if (m.entrata > 0) {
          monthlyStats[mMonth][mYear].income += m.entrata;
          globalTotalIncome += m.entrata;
        } else {
          monthlyStats[mMonth][mYear].expense += m.uscita;
          globalTotalExpense += m.uscita;
        }
        monthlyStats[mMonth][mYear].categories.add(m.categoria);
        dataPoints++;
      });

      const yearsCovered = new Set(movements.map(m => getYear(parseISO(m.data)))).size;
      const avgMonthlyIncome = globalTotalIncome / (yearsCovered * 12);
      const avgMonthlyExpense = globalTotalExpense / (yearsCovered * 12);

      const detectedPatterns: z.infer<typeof SeasonalPatternSchema>[] = [];

      for (let m = 1; m <= 12; m++) {
        const monthData = monthlyStats[m];
        if (!monthData) continue;

        const yearEntries = Object.values(monthData);
        const yearsActive = yearEntries.length;
        
        const avgMonthIncome = yearEntries.reduce((sum, y) => sum + y.income, 0) / yearsActive;
        const avgMonthExpense = yearEntries.reduce((sum, y) => sum + y.expense, 0) / yearsActive;

        const incomeChange = avgMonthlyIncome > 0 ? (avgMonthIncome - avgMonthlyIncome) / avgMonthlyIncome : 0;
        const expenseChange = avgMonthlyExpense > 0 ? (avgMonthExpense - avgMonthlyExpense) / avgMonthlyExpense : 0;

        const threshold = 0.15; // 15% scostamento per essere considerato pattern
        const allCategories = Array.from(new Set(yearEntries.flatMap(y => Array.from(y.categories))));

        // Verifica ricorrenza
        const isRecurring = (val: number, isIncome: boolean) => {
          const targetAvg = isIncome ? avgMonthlyIncome : avgMonthlyExpense;
          const matchingYears = yearEntries.filter(y => {
            const yearVal = isIncome ? y.income : y.expense;
            return Math.abs((yearVal - targetAvg) / targetAvg) > threshold;
          }).length;
          return matchingYears >= 2;
        };

        // Identificazione
        if (incomeChange > threshold) {
          detectedPatterns.push({
            month: m,
            type: 'income_peak',
            changePercent: Math.round(incomeChange * 100),
            categories: allCategories.slice(0, 3),
            confidence: isRecurring(avgMonthIncome, true) ? 'confirmed' : 'probable',
            description: `Picco di entrate riscontrato a ${m}`
          });
        } else if (incomeChange < -threshold) {
          detectedPatterns.push({
            month: m,
            type: 'income_dip',
            changePercent: Math.round(incomeChange * 100),
            categories: allCategories.slice(0, 3),
            confidence: isRecurring(avgMonthIncome, true) ? 'confirmed' : 'probable',
            description: `Calo di entrate riscontrato a ${m}`
          });
        }

        if (expenseChange > threshold) {
          detectedPatterns.push({
            month: m,
            type: 'expense_peak',
            changePercent: Math.round(expenseChange * 100),
            categories: allCategories.slice(0, 3),
            confidence: isRecurring(avgMonthExpense, false) ? 'confirmed' : 'probable',
            description: `Picco di uscite riscontrato a ${m}`
          });
        } else if (expenseChange < -threshold) {
          detectedPatterns.push({
            month: m,
            type: 'expense_dip',
            changePercent: Math.round(expenseChange * 100),
            categories: allCategories.slice(0, 3),
            confidence: isRecurring(avgMonthExpense, false) ? 'confirmed' : 'probable',
            description: `Calo di uscite riscontrato a ${m}`
          });
        }
      }

      // 3. Generazione Narrativa con Gemini
      const analysisData = JSON.stringify(detectedPatterns.map(p => ({
        mese: p.month,
        tipo: p.type,
        var: p.changePercent + "%",
        conf: p.confidence
      })));

      const { output } = await narrativePrompt({ analysisData, societa });
      const narrative = output?.narrative || "Analisi stagionale completata.";

      // 4. Salvataggio su Firestore
      const analysisId = `seasonal_${societa}_${today.getFullYear()}_${today.getMonth() + 1}`;
      const analysisDocRef = doc(db, 'users', userId, 'seasonalPatterns', analysisId);
      
      const result = {
        societa,
        userId,
        patterns: detectedPatterns,
        narrative,
        generatedAt: new Date().toISOString(),
        monthsAnalyzed: yearsCovered * 12
      };

      await setDoc(analysisDocRef, result);

      return result;

    } catch (error) {
      console.error("Errore nel flow 'detectSeasonalPatternsFlow':", error);
      throw new Error("L'analisi dei pattern stagionali non è riuscita.");
    }
  }
);
