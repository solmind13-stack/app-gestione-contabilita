'use server';

/**
 * @fileOverview Un flow AI per eseguire stress test finanziari sulla resilienza aziendale.
 * Analizza scenari "peggiori" e calcola l'impatto sulla liquidità.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, query, where, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { CashFlowProjection, Movimento, Scadenza, PrevisioneEntrata, PrevisioneUscita } from '@/lib/types';
import { subMonths, addMonths, startOfToday, parseISO, isWithinInterval, addDays, startOfMonth, endOfMonth } from 'date-fns';

if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const StressTestResultSchema = z.object({
  name: z.string(),
  scenario: z.string(),
  result: z.enum(['passed', 'critical', 'severe']),
  minBalance: z.number(),
  impactAmount: z.number(),
});

const RunStressTestsInputSchema = z.object({
  societa: z.string(),
  userId: z.string(),
  safetyThreshold: z.number().optional().default(5000),
});

const RunStressTestsOutputSchema = z.object({
  tests: z.array(StressTestResultSchema),
  passedCount: z.number(),
  totalCount: z.number(),
  narrative: z.string(),
});

export async function runStressTests(input: z.infer<typeof RunStressTestsInputSchema>) {
  return runStressTestsFlow(input);
}

const narrativePrompt = ai.definePrompt({
  name: 'stressTestsNarrativePrompt',
  input: { schema: z.object({ analysisData: z.string(), societa: z.string(), threshold: z.number() }) },
  output: { schema: z.object({ narrative: z.string() }) },
  prompt: `
    Sei un Risk Manager finanziario per la società {{societa}}.
    Ho eseguito 5 stress test per verificare la resilienza della cassa. La soglia di sicurezza impostata è di {{threshold}}€.
    
    RISULTATI TEST:
    {{analysisData}}
    
    Genera un report narrativo in italiano (max 4-5 frasi) che riassuma i risultati.
    Sii diretto: evidenzia quanti test sono stati superati, quali sono le vulnerabilità più gravi (dove il balance scende sotto soglia o sotto zero) e fornisci un consiglio pratico per mitigare i rischi (es. aumentare le riserve, rinegoziare termini con fornitori).
  `,
});

const runStressTestsFlow = ai.defineFlow(
  {
    name: 'runStressTestsFlow',
    inputSchema: RunStressTestsInputSchema,
    outputSchema: RunStressTestsOutputSchema,
  },
  async (input) => {
    const { societa, userId, safetyThreshold } = input;
    const today = startOfToday();

    try {
      // 1. Recupero Dati Baseline
      const projRef = collection(db, 'cashFlowProjections');
      const projQuery = query(projRef, where('societa', '==', societa), where('scenarioType', '==', 'realistic'), orderBy('generatedAt', 'desc'), limit(1));
      const projSnap = await getDocs(projQuery);
      
      if (projSnap.empty) throw new Error("Nessuna proiezione realistica trovata. Genera prima una proiezione.");
      const baseline = projSnap.docs[0].data() as CashFlowProjection;

      const movementsRef = collection(db, 'movements');
      const histQuery = query(movementsRef, where('societa', '==', societa), where('data', '>=', subMonths(today, 12).toISOString()));
      const histSnap = await getDocs(histQuery);
      const movements: Movimento[] = [];
      histSnap.forEach(d => movements.push(d.data() as any));

      // 2. Identificazione Top Client e Top Supplier
      const entityStats: Record<string, { income: number, expense: number }> = {};
      movements.forEach(m => {
        const name = m.descrizione.split(' ')[0].toUpperCase();
        if (!entityStats[name]) entityStats[name] = { income: 0, expense: 0 };
        if (m.entrata > 0) entityStats[name].income += m.entrata;
        if (m.uscita > 0) entityStats[name].expense += m.uscita;
      });

      const topClient = Object.entries(entityStats).sort((a, b) => b[1].income - a[1].income)[0]?.[0] || 'Cliente Principale';
      const topSupplier = Object.entries(entityStats).sort((a, b) => b[1].expense - a[1].expense)[0]?.[0] || 'Fornitore Principale';

      // 3. Esecuzione Stress Test (Simulazione Matematica)
      const runSimulation = (modifier: (monthData: any, index: number) => number) => {
        let currentBalance = baseline.baseBalance;
        let minBalance = currentBalance;
        
        baseline.monthlyProjections.forEach((m, idx) => {
          const impact = modifier(m, idx);
          currentBalance += (m.netFlow + impact);
          if (currentBalance < minBalance) minBalance = currentBalance;
        });
        
        const impactAmount = minBalance - Math.min(...baseline.monthlyProjections.map(p => p.cumulativeBalance));
        const result = minBalance < 0 ? 'severe' : minBalance < safetyThreshold ? 'critical' : 'passed';
        
        return { minBalance, impactAmount, result };
      };

      const tests: z.infer<typeof StressTestResultSchema>[] = [
        {
          name: "Ritardo Top Client",
          scenario: `Il cliente ${topClient} paga con 30gg di ritardo tutti i prossimi incassi.`,
          ...runSimulation((m, idx) => idx === 0 ? -(m.inflows * 0.4) : 0) // Semplificazione: togliamo il 40% degli incassi del primo mese
        },
        {
          name: "Contrazione Entrate",
          scenario: "Calo improvviso del 20% delle entrate per i prossimi 2 mesi.",
          ...runSimulation((m, idx) => idx < 2 ? -(m.inflows * 0.2) : 0)
        },
        {
          name: "Spesa Imprevista",
          scenario: "Uscita straordinaria di 10.000€ nel mese corrente (es. guasto o sanzione).",
          ...runSimulation((m, idx) => idx === 0 ? -10000 : 0)
        },
        {
          name: "Anticipo Fornitore",
          scenario: `Il fornitore ${topSupplier} richiede il pagamento anticipato di 30gg.`,
          ...runSimulation((m, idx) => idx === 0 ? -5000 : 0) // Stima forfettaria anticipo
        },
        {
          name: "Coincidenza Fiscale",
          scenario: "Due scadenze fiscali importanti cadono nello stesso mese per errore di pianificazione.",
          ...runSimulation((m, idx) => idx === 1 ? -8000 : 0) // Simulazione doppio carico fiscale mese 2
        }
      ];

      // 4. Generazione Narrativa con Gemini
      const analysisData = JSON.stringify(tests.map(t => ({ n: t.name, r: t.result, min: t.minBalance })));
      const { output } = await narrativePrompt({ analysisData, societa, threshold: safetyThreshold });

      const finalResult = {
        tests,
        passedCount: tests.filter(t => t.result === 'passed').length,
        totalCount: tests.length,
        narrative: output?.narrative || "Analisi completata."
      };

      // 5. Salvataggio su Firestore
      await addDoc(collection(db, 'stressTests'), {
        ...finalResult,
        societa,
        userId,
        createdAt: new Date().toISOString()
      });

      return finalResult;

    } catch (error: any) {
      console.error("Stress test flow failed:", error);
      throw new Error(error.message || "Errore durante l'esecuzione degli stress test.");
    }
  }
);
