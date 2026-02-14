'use server';

/**
 * @fileOverview Un flow AI per analizzare i movimenti storici e identificare pattern stagionali ricorrenti.
 *
 * - detectSeasonalPatterns - La funzione principale che orchestra l'analisi.
 * - DetectSeasonalPatternsInput - Lo schema di input per il flow.
 * - DetectSeasonalPatternsOutput - Lo schema di output del flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const DetectSeasonalPatternsInputSchema = z.object({
  societa: z.string().describe("La società per cui calcolare i pattern ('LNC' o 'STG')."),
  userId: z.string().describe("L'ID dell'utente che richiede l'analisi."),
  movements: z.string().describe("Un JSON stringato di tutti i movimenti degli ultimi 24-36 mesi per la società."),
});
export type DetectSeasonalPatternsInput = z.infer<typeof DetectSeasonalPatternsInputSchema>;

export const DetectSeasonalPatternsOutputSchema = z.object({
  patterns: z.array(z.object({
    month: z.number().min(1).max(12).describe("Il mese a cui si riferisce il pattern (1=Gennaio, 12=Dicembre)."),
    type: z.enum(['expense_peak', 'expense_dip', 'income_peak', 'income_dip']).describe("Il tipo di pattern identificato."),
    changePercent: z.number().describe("Lo scostamento percentuale medio rispetto alla media annuale."),
    categories: z.array(z.string()).describe("Le categorie che contribuiscono maggiormente a questo pattern."),
    confidence: z.enum(['confirmed', 'probable']).describe("Il livello di confidenza del pattern."),
    description: z.string().describe("Una breve descrizione del pattern."),
  })),
  narrative: z.string().describe("Una narrativa sintetica in italiano che riassume i principali pattern stagionali trovati."),
});
export type DetectSeasonalPatternsOutput = z.infer<typeof DetectSeasonalPatternsOutputSchema>;

export async function detectSeasonalPatterns(input: DetectSeasonalPatternsInput): Promise<DetectSeasonalPatternsOutput> {
  return detectSeasonalPatternsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'detectSeasonalPatternsPrompt',
  input: { schema: DetectSeasonalPatternsInputSchema },
  output: { schema: DetectSeasonalPatternsOutputSchema },
  prompt: `
    Sei un analista finanziario AI per aziende italiane. Il tuo compito è analizzare i movimenti storici per la società {{societa}} e identificare pattern stagionali ricorrenti.

    DATI A DISPOSIZIONE (in formato JSON stringato):
    - Movimenti bancari degli ultimi 24-36 mesi: {{{movements}}}

    IL TUO PROCESSO DI ANALISI:
    1.  **Raggruppa per Mese e Categoria**: Analizza i movimenti e raggruppali per mese dell'anno e per categoria.
    2.  **Calcola Medie e Scostamenti**: Per ogni mese, calcola la media delle entrate e delle uscite negli anni disponibili. Confronta queste medie con la media annuale complessiva per determinare lo scostamento percentuale (es. Dicembre ha un +30% di spese rispetto alla media).
    3.  **Identifica Picchi**: Se un mese mostra uno scostamento significativo (es. > 20%) rispetto alla media, identificalo come un 'peak' (picco) o 'dip' (calo).
    4.  **Determina Confidenza**:
        - Se un pattern (es. picco di spese a Dicembre) si ripete per almeno 2 anni, contrassegnalo come 'confirmed'.
        - Se si verifica solo in un anno, contrassegnalo come 'probable'.
    5.  **Analizza Categorie**: Per ogni pattern identificato, elenca le 2-3 categorie principali che contribuiscono a quel picco o calo.
    6.  **Genera Descrizione Pattern**: Per ogni pattern, crea una breve 'description' (es. "Picco di uscite a Dicembre dovuto principalmente a Tasse e regali aziendali.").
    7.  **Genera Narrativa**: Scrivi una 'narrative' riassuntiva in italiano (3-4 frasi) che descriva i principali cicli stagionali dell'azienda. Esempio: "L'azienda mostra un ciclo di spesa prevedibile con picchi di tasse a Giugno e Dicembre. Le entrate sono più forti nel primo trimestre, mentre si nota un calo fisiologico ad Agosto."

    REQUISITI FINALI:
    - L'output DEVE essere un singolo oggetto JSON che rispetta esattamente lo schema definito.
    - Se non trovi pattern significativi, restituisci un array 'patterns' vuoto e una narrativa che lo indichi.
  `,
});

const detectSeasonalPatternsFlow = ai.defineFlow(
  {
    name: 'detectSeasonalPatternsFlow',
    inputSchema: DetectSeasonalPatternsInputSchema,
    outputSchema: DetectSeasonalPatternsOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (!output) {
        throw new Error('Il modello AI non ha restituito un output valido per l\'analisi stagionale.');
      }
      return output;
    } catch (error) {
      console.error("Errore nel flow 'detectSeasonalPatternsFlow':", error);
      throw new Error(
        "L'analisi dei pattern stagionali non è riuscita. Potrebbe esserci un problema con i dati forniti o con il servizio AI."
      );
    }
  }
);
