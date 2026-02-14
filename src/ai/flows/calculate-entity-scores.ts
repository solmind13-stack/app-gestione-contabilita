'use server';

/**
 * @fileOverview Un flow AI per analizzare lo storico dei movimenti e calcolare un punteggio di affidabilità per clienti e fornitori.
 *
 * - calculateEntityScores - La funzione principale che orchestra l'analisi.
 * - CalculateEntityScoresInput - Lo schema di input per il flow.
 * - CalculateEntityScoresOutput - Lo schema di output del flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { EntityScore } from '@/lib/types/pianificazione';

// Schema Zod che corrisponde all'interfaccia EntityScore.
// I Timestamp di Firebase sono rappresentati come stringhe per il trasporto JSON.
const EntityScoreSchema = z.object({
  id: z.string().describe("Un ID univoco fittizio per l'entità."),
  societa: z.string(),
  userId: z.string(),
  entityName: z.string().describe("Il nome del cliente o fornitore."),
  entityType: z.enum(['client', 'supplier']),
  reliabilityScore: z.number().min(0).max(100).describe("Il punteggio di affidabilità calcolato."),
  averagePaymentDelay: z.number().describe("Il ritardo medio di pagamento in giorni (solo per fornitori)."),
  totalTransactions: z.number().describe("Il numero totale di transazioni con l'entità."),
  onTimePercentage: z.number().min(0).max(100).describe("La percentuale di pagamenti puntuali (solo per fornitori)."),
  lastUpdated: z.string().describe("Data ISO dell'ultimo aggiornamento."),
  history: z.array(z.object({
    date: z.string().describe("Data ISO della registrazione storica."),
    score: z.number(),
    reason: z.string(),
  })),
});


const CalculateEntityScoresInputSchema = z.object({
  societa: z.string().describe("La società per cui calcolare i punteggi ('LNC' o 'STG')."),
  userId: z.string().describe("L'ID dell'utente che richiede l'analisi."),
  movements: z.string().describe("Un JSON stringato di tutti i movimenti degli ultimi 24 mesi per la società."),
  deadlines: z.string().describe("Un JSON stringato di tutte le scadenze (pagate e non) per la società, per correlare pagamenti e date previste."),
});
export type CalculateEntityScoresInput = z.infer<typeof CalculateEntityScoresInputSchema>;

const CalculateEntityScoresOutputSchema = z.object({
  scores: z.array(EntityScoreSchema),
  summary: z.string().describe("Un riepilogo testuale in italiano dell'analisi e dei risultati chiave."),
});
export type CalculateEntityScoresOutput = z.infer<typeof CalculateEntityScoresOutputSchema>;


export async function calculateEntityScores(input: CalculateEntityScoresInput): Promise<CalculateEntityScoresOutput> {
  return calculateEntityScoresFlow(input);
}


const prompt = ai.definePrompt({
  name: 'calculateEntityScoresPrompt',
  input: { schema: CalculateEntityScoresInputSchema },
  output: { schema: CalculateEntityScoresOutputSchema },
  prompt: `
    Sei un analista finanziario specializzato nel valutare l'affidabilità di clienti e fornitori per aziende italiane.
    Il tuo compito è analizzare i dati finanziari forniti per la società {{societa}} e calcolare un punteggio di affidabilità (reliabilityScore) per ogni entità.

    DATI A DISPOSIZIONE (in formato JSON stringato):
    - Movimenti bancari degli ultimi 24 mesi: {{{movements}}}
    - Scadenze (pagate e non pagate): {{{deadlines}}}

    IL TUO PROCESSO DI ANALISI DETTAGLIATO:

    1.  **Raggruppa Movimenti**: Analizza i movimenti e raggruppali per entità (cliente o fornitore). Usa la 'descrizione' per identificare l'entità. Ad esempio, i movimenti con descrizioni "Affitto Rossi Srl" e "Pagamento fattura Rossi Srl" appartengono entrambi a "Rossi Srl".
    2.  **Identifica Tipo Entità**: Per ogni entità, determina se è un 'client' (principalmente entrate) o un 'supplier' (principalmente uscite).
    3.  **Correlazione Pagamenti-Scadenze**: Per ogni entità fornitore, cerca di abbinare i movimenti di uscita con le scadenze corrispondenti nel JSON 'deadlines'. Un abbinamento è valido se la descrizione è simile e l'importo è compatibile.
    4.  **Calcola Metriche per Ogni Entità**:
        - **totalTransactions**: Il numero totale di movimenti associati all'entità.
        - **averagePaymentDelay**: SOLO per i fornitori, calcola la differenza media in giorni tra la 'dataScadenza' della scadenza e la 'data' del movimento di pagamento. Se il pagamento è in anticipo, il ritardo è negativo. Se non trovi scadenze abbinate, metti 0.
        - **onTimePercentage**: La percentuale di pagamenti effettuati entro la data di scadenza. Se non trovi scadenze abbinate, metti 100.
    5.  **Calcola reliabilityScore (0-100)**:
        - Parti da un punteggio base di 50.
        - Aggiungi/sottrai punti in base a queste regole:
          - **Puntualità**: +20 se onTimePercentage > 90%; +10 se > 75%.
          - **Ritardo**: -20 se averagePaymentDelay > 30 giorni; -10 se > 15 giorni.
          - **Affidabilità Storica**: +10 se totalTransactions > 20.
        - Il punteggio non può superare 100 o scendere sotto 0.
    6.  **Genera Storico (Semplificato)**: Per il campo 'history', crea solo una voce con la data odierna, lo score calcolato e "Initial analysis" come 'reason'.
    7.  **Crea l'Output**: Assembla tutti i dati calcolati in un array 'scores', rispettando lo schema.
    8.  **Scrivi il Sommario**: Crea un 'summary' testuale in italiano di 2-3 frasi che evidenzi le entità più e meno affidabili. Esempio: "Analizzati 15 clienti e 8 fornitori. L'entità più affidabile risulta Rossi Srl (score 92). Particolare attenzione a Bianchi Spa (score 45, con un ritardo medio di 18 giorni)."

    REQUISITI FINALI:
    - L'output DEVE essere un singolo oggetto JSON che rispetta esattamente lo schema definito.
    - Tutti i campi (id, userId, lastUpdated) devono essere compilati. Per l'id usa un UUID fittizio, per le date usa l'ISO string.
  `,
});


const calculateEntityScoresFlow = ai.defineFlow(
  {
    name: 'calculateEntityScoresFlow',
    inputSchema: CalculateEntityScoresInputSchema,
    outputSchema: CalculateEntityScoresOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (!output) {
        throw new Error('Il modello AI non ha restituito un output valido.');
      }
      return output;
    } catch (error) {
      console.error("Errore nel flow 'calculateEntityScoresFlow':", error);
      throw new Error(
        "L'analisi dei punteggi di affidabilità non è riuscita. Potrebbe esserci un problema con i dati forniti o con il servizio AI."
      );
    }
  }
);
