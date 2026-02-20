
'use server';

/**
 * @fileOverview Un flow AI per generare report di impatto decisionale.
 * Analizza una proposta di spesa/investimento e fornisce una valutazione strategica.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { CashFlowProjection, LiquidityAlert } from '@/lib/types';

if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const DecisionReportInputSchema = z.object({
  societa: z.string(),
  userId: z.string(),
  decisionType: z.enum(['acquisto', 'assunzione', 'investimento', 'cambio_fornitore', 'altro']),
  description: z.string(),
  amount: z.number(),
  isRecurring: z.boolean(),
  frequency: z.enum(['mensile', 'trimestrale', 'annuale']).optional(),
});

const DecisionReportOutputSchema = z.object({
  report: z.object({
    financialImpact: z.string(),
    riskLevel: z.enum(['low', 'medium', 'high']),
    bestTiming: z.string(),
    historicalContext: z.string(),
    recommendation: z.string(),
    successProbability: z.number().min(0).max(100),
  }),
  simulatedBalance: z.object({
    month1: z.number(),
    month3: z.number(),
    month6: z.number(),
  }),
});

export async function generateDecisionReport(input: z.infer<typeof DecisionReportInputSchema>) {
  return generateDecisionReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDecisionReportPrompt',
  input: { schema: z.object({ input: DecisionReportInputSchema, context: z.string() }) },
  output: { schema: DecisionReportOutputSchema },
  prompt: `
    Sei un CFO virtuale di alto livello. Devi valutare una decisione aziendale proposta dall'imprenditore.
    
    DETTAGLI DECISIONE:
    - Tipo: {{input.decisionType}}
    - Descrizione: {{input.description}}
    - Importo: {{input.amount}}€
    - Ricorrente: {{#if input.isRecurring}}Sì, frequenza {{input.frequency}}{{else}}No{{/if}}
    
    CONTESTO FINANZIARIO ATTUALE (JSON):
    {{{context}}}
    
    IL TUO COMPITO:
    1. Simula matematicamente l'impatto dell'uscita di {{input.amount}}€ (e delle ricorrenze se presenti) sui prossimi 6 mesi.
    2. Calcola i valori 'simulatedBalance' per il mese 1, 3 e 6 partendo dal balance attuale.
    3. Genera un report testuale professionale in italiano strutturato come richiesto nello schema di output.
    
    LINEE GUIDA PER IL REPORT:
    - FINANCIAL IMPACT: Spiega come varia la liquidità netta.
    - RISK LEVEL: 'high' se il balance scende sotto 5.000€ o sotto zero. 'medium' se si avvicina alla soglia. 'low' se c'è ampio margine.
    - BEST TIMING: Indica se questo è il mese giusto o se è meglio aspettare (guarda i flussi futuri).
    - HISTORICAL CONTEXT: Se hai dati storici, cita se l'azienda ha gestito spese simili con successo.
    - RECOMMENDATION: Sii netto. Consiglia di procedere, procedere con cautela o rimandare.
    - SUCCESS PROBABILITY: Un punteggio da 0 a 100 che indica la sostenibilità finanziaria dell'operazione.
  `,
});

const generateDecisionReportFlow = ai.defineFlow(
  {
    name: 'generateDecisionReportFlow',
    inputSchema: DecisionReportInputSchema,
    outputSchema: DecisionReportOutputSchema,
  },
  async (input) => {
    const { societa } = input;

    // 1. Recupero dati contesto
    const projRef = collection(db, 'cashFlowProjections');
    const projQuery = query(projRef, where('societa', '==', societa), where('scenarioType', '==', 'realistic'), orderBy('generatedAt', 'desc'), limit(1));
    const projSnap = await getDocs(projQuery);
    const baseline = projSnap.docs[0]?.data() as CashFlowProjection;

    const alertRef = collection(db, 'liquidityAlerts');
    const alertQuery = query(alertRef, where('societa', '==', societa), orderBy('triggeredAt', 'desc'), limit(1));
    const alertSnap = await getDocs(alertQuery);
    const alert = alertSnap.docs[0]?.data() as LiquidityAlert;

    const context = JSON.stringify({
      projection: baseline || "Nessuna proiezione disponibile",
      alert: alert || "Nessun alert disponibile",
    });

    // 2. Chiamata a Gemini
    const { output } = await prompt({ input, context });

    if (!output) {
      throw new Error("Il modello AI non è riuscito a generare il report decisionale.");
    }

    return output;
  }
);
