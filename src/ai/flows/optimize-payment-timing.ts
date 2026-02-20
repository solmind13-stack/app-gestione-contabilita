'use server';

/**
 * @fileOverview Un flow AI per ottimizzare il timing dei pagamenti in base alla liquidità.
 * Analizza sconti per pagamenti anticipati e rischi di liquidità per suggerire quando pagare.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, query, where, getDocs, orderBy, limit, addDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { addDays, startOfToday } from 'date-fns';

if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const OptimizationSuggestionSchema = z.object({
  paymentName: z.string().describe("Nome o descrizione del pagamento."),
  dueDate: z.string().describe("Data di scadenza originale."),
  amount: z.number().describe("Importo del pagamento."),
  recommendation: z.enum(['pay_now', 'pay_on_time', 'consider_delay', 'anticipate']).describe("Il suggerimento sul timing."),
  reason: z.string().describe("La motivazione del suggerimento."),
  savingsOrImpact: z.number().describe("L'impatto economico stimato (risparmio o variazione cassa)."),
});

const OptimizePaymentTimingInputSchema = z.object({
  societa: z.string().describe("La società per cui ottimizzare i pagamenti."),
  userId: z.string().describe("L'ID dell'utente che richiede l'analisi."),
});

const OptimizePaymentTimingOutputSchema = z.object({
  suggestions: z.array(OptimizationSuggestionSchema),
  narrative: z.string().describe("Un riepilogo strategico complessivo dei suggerimenti."),
});

export async function optimizePaymentTiming(input: z.infer<typeof OptimizePaymentTimingInputSchema>) {
  return optimizePaymentTimingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'optimizePaymentTimingPrompt',
  input: {
    schema: z.object({
      societa: z.string(),
      payments: z.string(),
      projection: z.string(),
      safetyThreshold: z.number(),
    })
  },
  output: { schema: OptimizePaymentTimingOutputSchema },
  prompt: `
    Sei un Tesoriere Aziendale esperto per la società {{societa}}.
    Il tuo compito è analizzare i pagamenti in uscita dei prossimi 60 giorni e suggerire il timing ottimale per ognuno, bilanciando risparmi (sconti) e mantenimento della liquidità di sicurezza.

    DATI DISPONIBILI:
    - Pagamenti in scadenza (JSON): {{{payments}}}
    - Proiezione Liquidità Realistica (JSON): {{{projection}}}
    - Soglia di Sicurezza: {{safetyThreshold}}€

    REGOLE DI ANALISI:
    1. **Sconti**: Se una scadenza menziona sconti (es. "2%", "sconto", "10gg") e il balance previsto lo permette senza scendere sotto soglia, suggerisci 'pay_now'.
    2. **Liquidità Bassa**: Se pagare alla scadenza manda il balance sotto la soglia di sicurezza (o vicino ad essa, < 150%), e non c'è uno sconto, valuta 'consider_delay' se il fornitore lo permette o se ci sono incassi importanti subito dopo.
    3. **Distribuzione Carico**: Se un mese è molto carico, suggerisci 'anticipate' per pagamenti minori se c'è surplus nel mese corrente per liberare budget futuro.
    4. **Default**: Altrimenti suggerisci 'pay_on_time'.

    PER OGNI PAGAMENTO:
    - Genera un oggetto nello schema 'suggestions'.
    - 'reason' deve spiegare chiaramente il perché in italiano (es. "Risparmio di 50€", "Evita picco di uscite a fine mese", "Coperto da incasso Cliente X").
    - 'savingsOrImpact' è l'importo risparmiato o l'impatto sulla cassa.

    NARRATIVE FINALE:
    - Genera un breve riepilogo strategico (3-4 frasi) che evidenzi i risparmi totali possibili e i periodi di massima attenzione.
  `,
});

const optimizePaymentTimingFlow = ai.defineFlow(
  {
    name: 'optimizePaymentTimingFlow',
    inputSchema: OptimizePaymentTimingInputSchema,
    outputSchema: OptimizePaymentTimingOutputSchema,
  },
  async (input) => {
    const { societa, userId } = input;
    const today = startOfToday();
    const sixtyDaysLater = addDays(today, 60).toISOString().split('T')[0];

    try {
      // 1. Recupero Scadenze
      const deadlinesRef = collection(db, 'deadlines');
      const dlQuery = query(deadlinesRef, where('societa', '==', societa), where('stato', '!=', 'Pagato'), where('dataScadenza', '<=', sixtyDaysLater));
      const dlSnap = await getDocs(dlQuery);
      const deadlines = dlSnap.docs.map(d => ({ ...d.data(), id: d.id }));

      // 2. Recupero Previsioni Uscita
      const expRef = collection(db, 'expenseForecasts');
      const expQuery = query(expRef, where('societa', '==', societa), where('stato', '!=', 'Pagato'), where('dataScadenza', '<=', sixtyDaysLater));
      const expSnap = await getDocs(expQuery);
      const forecasts = expSnap.docs.map(d => ({ ...d.data(), id: d.id }));

      // 3. Recupero Proiezione più recente
      const projRef = collection(db, 'cashFlowProjections');
      const projQuery = query(projRef, where('societa', '==', societa), where('scenarioType', '==', 'realistic'), orderBy('generatedAt', 'desc'), limit(1));
      const projSnap = await getDocs(projQuery);
      const projection = projSnap.docs[0]?.data();

      if (!projection) {
        throw new Error("Nessuna proiezione trovata. Genera una proiezione prima di ottimizzare i pagamenti.");
      }

      const payments = [...deadlines, ...forecasts].map(p => ({
        name: (p as any).descrizione,
        date: (p as any).dataScadenza,
        amount: (p as any).importoLordo || (p as any).importoPrevisto,
        notes: (p as any).note || ''
      }));

      if (payments.length === 0) {
        return {
          suggestions: [],
          narrative: "Nessun pagamento in uscita rilevato nei prossimi 60 giorni."
        };
      }

      // 4. Chiamata a Gemini per l'ottimizzazione
      const { output } = await prompt({
        societa,
        payments: JSON.stringify(payments),
        projection: JSON.stringify(projection),
        safetyThreshold: 5000,
      });

      if (!output) {
        throw new Error("L'AI non ha restituito suggerimenti validi.");
      }

      // 5. Salvataggio su Firestore per consultazione successiva
      await addDoc(collection(db, 'paymentOptimizations'), {
        ...output,
        societa,
        userId,
        createdAt: new Date().toISOString(),
      });

      return output;

    } catch (error: any) {
      console.error("Optimize payment timing flow failed:", error);
      throw new Error(error.message || "Errore durante l'ottimizzazione dei pagamenti.");
    }
  }
);