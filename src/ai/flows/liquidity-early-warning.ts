'use server';

/**
 * @fileOverview Un flow AI per analizzare le proiezioni di cassa e generare alert di liquidità.
 *
 * - liquidityEarlyWarning - La funzione principale che orchestra l'analisi.
 * - LiquidityEarlyWarningInput - Lo schema di input per il flow.
 * - LiquidityEarlyWarningOutput - Lo schema di output del flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { LiquidityAlert } from '@/lib/types/pianificazione';

// Schema Zod che corrisponde all'interfaccia LiquidityAlert.
// Le date sono stringhe per il trasporto JSON.
const LiquidityAlertSchema = z.object({
  id: z.string().describe("Un ID univoco fittizio per l'alert."),
  societa: z.string(),
  userId: z.string(),
  status: z.enum(['green', 'yellow', 'red']),
  message: z.string().describe("Il messaggio di alert dettagliato o di stato."),
  projectedDate: z.string().describe("La data in cui si prevede che il saldo scenda sotto la soglia (formato ISO)."),
  projectedBalance: z.number().describe("Il saldo previsto in quella data."),
  triggeredAt: z.string().describe("La data di generazione dell'alert (formato ISO)."),
  acknowledged: z.boolean().default(false),
});

export const LiquidityEarlyWarningInputSchema = z.object({
  societa: z.string().describe("La società per cui generare l'alert ('LNC' o 'STG')."),
  userId: z.string().describe("L'ID dell'utente che richiede l'analisi."),
  safetyThreshold: z.number().optional().default(5000).describe("La soglia di sicurezza del saldo di cassa."),
  cashFlowProjection: z.string().describe("Un JSON stringato della proiezione di cassa realistica (oggetto CashFlowProjection)."),
  previousAlertStatus: z.enum(['green', 'yellow', 'red']).optional().describe("Lo stato dell'ultimo alert generato, per confronto."),
});
export type LiquidityEarlyWarningInput = z.infer<typeof LiquidityEarlyWarningInputSchema>;

export const LiquidityEarlyWarningOutputSchema = z.object({
  alert: LiquidityAlertSchema,
  hasChanged: z.boolean().describe("Indica se lo stato dell'alert è cambiato rispetto al precedente."),
});
export type LiquidityEarlyWarningOutput = z.infer<typeof LiquidityEarlyWarningOutputSchema>;


export async function liquidityEarlyWarning(input: LiquidityEarlyWarningInput): Promise<LiquidityEarlyWarningOutput> {
  return liquidityEarlyWarningFlow(input);
}


const prompt = ai.definePrompt({
  name: 'liquidityEarlyWarningPrompt',
  input: { schema: LiquidityEarlyWarningInputSchema },
  output: { schema: LiquidityEarlyWarningOutputSchema },
  prompt: `
    Sei un sistema di allerta precoce per la liquidità di un'azienda italiana.
    Il tuo compito è analizzare una proiezione di cash flow e generare un alert di stato (verde, giallo, rosso).

    DATI A DISPOSIZIONE:
    - Società: {{societa}}
    - Proiezione di cassa (scenario realistico, JSON stringato): {{{cashFlowProjection}}}
    - Soglia di sicurezza (safetyThreshold): {{safetyThreshold}}
    - Stato dell'alert precedente (previousAlertStatus): {{#if previousAlertStatus}}{{previousAlertStatus}}{{else}}nessuno{{/if}}

    LOGICA DI ANALISI:
    1.  Analizza l'array 'weeklyProjections' all'interno della proiezione di cassa JSON. Concentrati sul campo 'cumulativeBalance'.
    2.  Determina lo stato dell'alert basandoti sulla prima volta che il 'cumulativeBalance' scende sotto la 'safetyThreshold'.
        - **ROSSO**: Se il saldo scende sotto la soglia entro i prossimi 14 giorni dalla data attuale.
        - **GIALLO**: Se lo stato non è ROSSO, e il saldo scende sotto la soglia tra 15 e 60 giorni dalla data attuale.
        - **VERDE**: In tutti gli altri casi (il saldo rimane sopra la soglia per i prossimi 60 giorni).

    GENERAZIONE MESSAGGIO:
    - Se lo stato è **VERDE**: il 'message' deve essere un riassunto positivo come "La liquidità è stabile e si prevede rimanga sopra la soglia di sicurezza per i prossimi 90 giorni."
    - Se lo stato è **GIALLO** o **ROSSO**:
        - Genera un 'message' dettagliato in italiano che spieghi la situazione.
        - Il messaggio DEVE includere:
            - La data esatta (usa il campo 'weekEnd' della proiezione settimanale) in cui si prevede il calo sotto soglia.
            - Le cause principali del calo (basandoti sui valori di 'inflows' e 'outflows' di quella settimana).
            - 2-3 suggerimenti di azione concisi e pratici (es. "Posticipare pagamento X", "Sollecitare incasso da Y").

    REQUISITI DI OUTPUT:
    - Devi produrre un singolo oggetto JSON che rispetti esattamente lo schema 'LiquidityEarlyWarningOutputSchema'.
    - 'alert.status': lo stato calcolato ('green', 'yellow', o 'red').
    - 'alert.message': il messaggio generato.
    - 'alert.projectedDate': la data 'weekEnd' della prima settimana in cui il saldo scende sotto soglia. Se lo stato è VERDE, usa la data di 'generatedAt'.
    - 'alert.projectedBalance': il 'cumulativeBalance' previsto in quella data. Se lo stato è VERDE, usa il saldo finale dell'ultima proiezione settimanale.
    - 'hasChanged': imposta a 'true' se il nuovo 'alert.status' è diverso da 'previousAlertStatus' (se fornito), altrimenti 'false'.
    - Compila gli altri campi dell'alert: per 'id' usa un placeholder, per 'triggeredAt' usa la data ISO di oggi, e imposta 'acknowledged' a 'false'.
  `,
});


const liquidityEarlyWarningFlow = ai.defineFlow(
  {
    name: 'liquidityEarlyWarningFlow',
    inputSchema: LiquidityEarlyWarningInputSchema,
    outputSchema: LiquidityEarlyWarningOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (!output) {
        throw new Error('Il modello AI non ha restituito un output valido per l\'early warning.');
      }
      return output;
    } catch (error) {
      console.error("Errore nel flow 'liquidityEarlyWarningFlow':", error);
      throw new Error(
        "L'analisi per l'allerta di liquidità non è riuscita."
      );
    }
  }
);
