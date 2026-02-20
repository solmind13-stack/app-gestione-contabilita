'use server';

/**
 * @fileOverview Un flow AI per confrontare i KPI dell'azienda con i benchmark di settore italiani.
 * Utilizza lo storico dei movimenti per calcolare i KPI e Gemini per il confronto con le medie pubbliche (ISTAT/Cerved).
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { Movimento } from '@/lib/types';
import { subMonths, startOfToday } from 'date-fns';

if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const BenchmarkResultSchema = z.object({
  kpiName: z.string(),
  companyValue: z.number().describe("Valore calcolato per l'azienda."),
  sectorAverage: z.number().describe("Media stimata del settore in Italia."),
  comparison: z.enum(['above', 'below', 'in_line']),
  insight: z.string().describe("Spiegazione del confronto in italiano."),
  suggestion: z.string().optional().describe("Suggerimento pratico se il valore è critico."),
});

const FetchSectorBenchmarksInputSchema = z.object({
  societa: z.string().describe("La società per cui recuperare i benchmark."),
  userId: z.string().describe("L'ID dell'utente che richiede l'analisi."),
});

const FetchSectorBenchmarksOutputSchema = z.object({
  benchmarks: z.array(BenchmarkResultSchema),
  sector: z.string().describe("Il settore economico identificato dall'AI."),
  narrative: z.string().describe("Un commento complessivo sulla posizione dell'azienda nel mercato."),
  disclaimer: z.string(),
});

export async function fetchSectorBenchmarks(input: z.infer<typeof FetchSectorBenchmarksInputSchema>) {
  return fetchSectorBenchmarksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'sectorBenchmarksPrompt',
  input: { 
    schema: z.object({ 
      societa: z.string(), 
      kpiData: z.string(),
      categories: z.string()
    }) 
  },
  output: { schema: FetchSectorBenchmarksOutputSchema },
  prompt: `
    Sei un Senior Financial Analyst specializzato in PMI italiane. 
    Il tuo compito è analizzare i KPI di un'azienda e confrontarli con le medie di settore in Italia (basandoti su dati ISTAT, Cerved e rapporti di settore).

    AZIENDA: {{societa}}
    
    DATI KPI (Ultimi 12 mesi):
    {{{kpiData}}}

    CATEGORIE DI SPESA RILEVATE:
    {{{categories}}}

    IL TUO COMPITO:
    1. Deduci il settore economico prevalente basandoti sulla descrizione delle categorie e dei KPI (es. Immobiliare, Manifattura, Servizi, Commercio).
    2. Per ogni KPI fornito, individua la media di settore italiana corrispondente.
    3. Genera un oggetto JSON che includa:
       - 'sector': Il settore identificato.
       - 'benchmarks': Array con il confronto per ogni KPI.
       - 'narrative': Un riassunto professionale (3-4 frasi) sulla salute competitiva dell'azienda.
       - 'disclaimer': Il testo standard sulla natura stimata dei dati.

    REGOLE PER IL CONFRONTO:
    - kpiName deve essere chiaro (es. "Margine Operativo Lordo %", "Incidenza Costi Servizi").
    - comparison: 'above' se l'azienda performa meglio della media (es. costi più bassi o ricavi più alti), 'below' se peggio, 'in_line' se simile.
    - Sii specifico negli insight: cita il motivo per cui un valore potrebbe scostarsi dalla media.

    Rispondi esclusivamente in formato JSON.
  `,
});

const fetchSectorBenchmarksFlow = ai.defineFlow(
  {
    name: 'fetchSectorBenchmarksFlow',
    inputSchema: FetchSectorBenchmarksInputSchema,
    outputSchema: FetchSectorBenchmarksOutputSchema,
  },
  async (input) => {
    const { societa, userId } = input;
    const today = startOfToday();
    const oneYearAgo = subMonths(today, 12).toISOString();

    try {
      // 1. Recupero Dati Storici
      const movementsRef = collection(db, 'movements');
      const q = query(movementsRef, where('societa', '==', societa), where('data', '>=', oneYearAgo));
      const snap = await getDocs(q);
      const movements = snap.docs.map(d => d.data() as Movimento);

      if (movements.length < 5) {
        throw new Error("Dati insufficienti per un'analisi di benchmark significativa (minimo 12 mesi di storico).");
      }

      // 2. Calcolo KPI Interni
      const totalRevenue = movements.reduce((s, m) => s + (m.entrata || 0), 0);
      const totalCosts = movements.reduce((s, m) => s + (m.uscita || 0), 0);
      
      const categoryStats: Record<string, number> = {};
      movements.forEach(m => {
        if (m.uscita > 0) {
          categoryStats[m.categoria] = (categoryStats[m.categoria] || 0) + m.uscita;
        }
      });

      const kpis = {
        costToRevenueRatio: totalRevenue > 0 ? (totalCosts / totalRevenue) * 100 : 0,
        operatingMargin: totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0,
        fixedCostsRatio: totalCosts > 0 ? calculateFixedCosts(movements, totalCosts) : 0,
        categoryIncidence: Object.entries(categoryStats).map(([cat, val]) => ({
          cat,
          percent: totalCosts > 0 ? (val / totalCosts) * 100 : 0
        }))
      };

      const categoriesStr = Object.keys(categoryStats).join(', ');

      // 3. Chiamata a Gemini per il confronto
      const { output } = await prompt({
        societa,
        kpiData: JSON.stringify(kpis),
        categories: categoriesStr
      });

      if (!output) {
        throw new Error("L'AI non è riuscita a generare i benchmark.");
      }

      const finalResult = {
        ...output,
        disclaimer: "I benchmark di settore sono stime basate su dati pubblici e rapporti di settore. Per confronti precisi, consulta i rapporti Cerved o ISTAT specifici."
      };

      // 4. Salvataggio su Firestore
      await addDoc(collection(db, 'externalInsights'), {
        ...finalResult,
        type: 'benchmark',
        societa,
        userId,
        createdAt: new Date().toISOString()
      });

      return finalResult;

    } catch (error: any) {
      console.error("Fetch sector benchmarks failed:", error);
      throw new Error(error.message || "Errore durante l'acquisizione dei benchmark di settore.");
    }
  }
);

/**
 * Euristiche semplici per dividere costi fissi da variabili basandosi sulle categorie.
 */
function calculateFixedCosts(movements: Movimento[], totalCosts: number): number {
  const fixedCategories = ['Affitti', 'Finanziamenti', 'Tasse', 'Telefonia', 'Utenze', 'Personale'];
  const fixedSum = movements
    .filter(m => m.uscita > 0 && (fixedCategories.includes(m.categoria) || fixedCategories.includes(m.sottocategoria)))
    .reduce((s, m) => s + m.uscita, 0);
  
  return (fixedSum / totalCosts) * 100;
}
