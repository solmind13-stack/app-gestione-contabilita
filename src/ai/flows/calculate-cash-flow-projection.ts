'use server';

/**
 * @fileOverview Un flow AI per calcolare proiezioni di flusso di cassa dettagliate.
 *
 * - calculateCashFlowProjection - La funzione principale che orchestra l'analisi.
 * - CalculateCashFlowProjectionInput - Lo schema di input per il flow.
 * - CalculateCashFlowProjectionOutput - Lo schema di output del flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { CashFlowProjection } from '@/lib/types/pianificazione';

// Schema Zod per la validazione interna, che corrisponde a CashFlowProjection
const CashFlowProjectionSchema = z.object({
  id: z.string(),
  societa: z.string(),
  userId: z.string(),
  weeklyProjections: z.array(z.object({
    weekStart: z.string(),
    weekEnd: z.string(),
    inflows: z.number(),
    outflows: z.number(),
    netFlow: z.number(),
    cumulativeBalance: z.number(),
  })),
  monthlyProjections: z.array(z.object({
    month: z.number(),
    year: z.number(),
    inflows: z.number(),
    outflows: z.number(),
    netFlow: z.number(),
    cumulativeBalance: z.number(),
  })),
  scenarioType: z.enum(['optimistic', 'realistic', 'pessimistic']),
  confidenceScore: z.number(),
  generatedAt: z.string(),
  baseBalance: z.number(),
});

export const CalculateCashFlowProjectionInputSchema = z.object({
  societa: z.string().describe("La società per cui calcolare la proiezione ('LNC' o 'STG')."),
  userId: z.string().describe("L'ID dell'utente che richiede la proiezione."),
  baseBalance: z.number().describe("Il saldo di cassa di partenza per la proiezione."),
  movements: z.string().describe("Un JSON stringato di tutti i movimenti degli ultimi 24 mesi per la società."),
  deadlines: z.string().describe("Un JSON stringato di tutte le scadenze future per la società."),
  incomeForecasts: z.string().describe("Un JSON stringato di tutte le previsioni di entrata attive per la società."),
  expenseForecasts: z.string().describe("Un JSON stringato di tutte le previsioni di uscita attive per la società."),
});
export type CalculateCashFlowProjectionInput = z.infer<typeof CalculateCashFlowProjectionInputSchema>;

export const CalculateCashFlowProjectionOutputSchema = z.object({
  optimistic: CashFlowProjectionSchema,
  realistic: CashFlowProjectionSchema,
  pessimistic: CashFlowProjectionSchema,
  narrative: z.string().describe("Una spiegazione testuale in italiano dell'analisi e dei risultati."),
  confidenceScore: z.number().min(0).max(100).describe("Un punteggio da 0 a 100 che indica l'affidabilità della previsione."),
});
export type CalculateCashFlowProjectionOutput = z.infer<typeof CalculateCashFlowProjectionOutputSchema>;


export async function calculateCashFlowProjection(input: CalculateCashFlowProjectionInput): Promise<CalculateCashFlowProjectionOutput> {
  return calculateCashFlowProjectionFlow(input);
}


const prompt = ai.definePrompt({
  name: 'calculateCashFlowProjectionPrompt',
  input: { schema: CalculateCashFlowProjectionInputSchema },
  output: { schema: CalculateCashFlowProjectionOutputSchema },
  prompt: `
    Sei un analista finanziario esperto specializzato in aziende italiane. Il tuo compito è creare una proiezione di cassa dettagliata per la società {{societa}}.

    DATI A DISPOSIZIONE (in formato JSON stringato):
    - Movimenti bancari degli ultimi 24 mesi: {{{movements}}}
    - Scadenze future da pagare: {{{deadlines}}}
    - Previsioni di entrata future: {{{incomeForecasts}}}
    - Previsioni di spesa future: {{{expenseForecasts}}}
    - Saldo di cassa iniziale: {{baseBalance}}

    IL TUO PROCESSO DI ANALISI:
    1.  **Analisi Dati Storici**: Analizza i movimenti degli ultimi 24 mesi per identificare:
        - Media mensile di entrate e uscite per ogni categoria.
        - Pattern stagionali: ci sono mesi con picchi di spesa (es. tasse a Giugno/Novembre) o di entrate (es. affitti)?
        - Trend di crescita o calo generale delle entrate e uscite.

    2.  **Generazione Scenari**: Crea 3 scenari di proiezione distinti:
        - **Realistico**: Basato sul trend storico e corretto con i pattern stagionali identificati. Usa le previsioni e le scadenze esistenti come base, applicando il loro fattore di probabilità.
        - **Ottimistico**: Partendo dallo scenario realistico, aumenta le entrate non certe del 15% e diminuisci le uscite non certe del 10%.
        - **Pessimistico**: Partendo dallo scenario realistico, diminuisci le entrate non certe del 20% e aumenta le uscite non certe del 15%.

    3.  **Proiezione Temporale**: Per OGNUNO dei 3 scenari, devi calcolare:
        - **Proiezione Settimanale (13 settimane)**: Un array 'weeklyProjections' con oggetti per ogni settimana.
        - **Proiezione Mensile (12 mesi)**: Un array 'monthlyProjections' con oggetti per ogni mese.
        - Ogni oggetto deve contenere: inflows, outflows, netFlow, e cumulativeBalance (che parte dal baseBalance).

    4.  **Punteggio di Affidabilità (Confidence Score)**: Calcola un 'confidenceScore' (da 0 a 100) basato su:
        - Quantità di dati storici (più dati = più alto).
        - Varianza e prevedibilità dei flussi (flussi stabili = più alto).
        - Percentuale di entrate/uscite "certe" vs "probabili".
        - Un punteggio < 50 è poco affidabile, 50-75 è affidabile, >75 è molto affidabile.

    5.  **Narrativa Sintetica**: Scrivi una 'narrative' in italiano. Deve essere una spiegazione chiara e concisa (massimo 3-4 frasi) dello scenario realistico, evidenziando i momenti chiave. Esempio: "Nei prossimi 3 mesi le entrate sono previste stabili intorno a 45k/mese. Attenzione a marzo: la scadenza dell'IVA trimestrale (stimata 12k) e il pagamento al fornitore X (8k) creeranno tensione di liquidità nella seconda settimana."

    REQUISITI FINALI:
    - L'output DEVE essere un singolo oggetto JSON che rispetta esattamente lo schema definito.
    - Tutti i campi (id, userId, generatedAt) devono essere compilati. Usa l'ISO string per le date.
    - Assicurati che 'cumulativeBalance' sia calcolato progressivamente.
    - Sii accurato e fornisci un'analisi plausibile.
  `,
});


const calculateCashFlowProjectionFlow = ai.defineFlow(
  {
    name: 'calculateCashFlowProjectionFlow',
    inputSchema: CalculateCashFlowProjectionInputSchema,
    outputSchema: CalculateCashFlowProjectionOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (!output) {
        throw new Error('Il modello AI non ha restituito un output valido.');
      }
      return output;
    } catch (error) {
      console.error("Errore nel flow 'calculateCashFlowProjectionFlow':", error);
      throw new Error(
        "L'analisi della proiezione di cassa non è riuscita. Potrebbe esserci un problema con i dati forniti o con il servizio AI."
      );
    }
  }
);
