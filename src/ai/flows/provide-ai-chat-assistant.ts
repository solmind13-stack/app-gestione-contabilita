'use server';

/**
 * @fileOverview An AI chat assistant for providing financial insights.
 *
 * - provideAiChatAssistant - A function that handles the AI chat assistant process.
 * - ProvideAiChatAssistantInput - The input type for the provideAiChatAssistant function.
 * - ProvideAiChatAssistantOutput - The return type for the provideAiChatAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProvideAiChatAssistantInputSchema = z.object({
  query: z.string().describe('The user question about their financial data.'),
  company: z.string().describe('The company to filter data by.'),
  // In a real app, you would pass real, structured data here.
  // For this example, we'll pass a summary string.
  financialData: z.string().describe('A string containing a summary of movements, deadlines, and forecasts, including planning data like projections and alerts.'),
  chatHistory: z
    .array(z.object({role: z.enum(['user', 'model']), content: z.string()}))
    .optional()
    .describe('Previous chat messages.'),
});
export type ProvideAiChatAssistantInput = z.infer<typeof ProvideAiChatAssistantInputSchema>;

const ProvideAiChatAssistantOutputSchema = z.object({
  response: z.string().describe('The AI assistant response to the user question.'),
});
export type ProvideAiChatAssistantOutput = z.infer<typeof ProvideAiChatAssistantOutputSchema>;

export async function provideAiChatAssistant(input: ProvideAiChatAssistantInput): Promise<ProvideAiChatAssistantOutput> {
  return provideAiChatAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'provideAiChatAssistantPrompt',
  input: {schema: ProvideAiChatAssistantInputSchema},
  output: {schema: ProvideAiChatAssistantOutputSchema},
  prompt: `Sei un assistente finanziario esperto per la gestione contabile di due società italiane: LNC (La Nuova Costruzione, immobiliare) e STG (Staygreen, affitti e comunità energetiche).
Hai accesso ai dati di movimenti bancari, scadenze, previsioni entrate e uscite, e soprattutto ai dati della sezione **Pianificazione Spese** (Digital Twin). 

Rispondi sempre in italiano. Formatta gli importi in euro con due decimali (es: €1.234,56). Quando fornisci dati numerici sii preciso.

Le tue capacità principali sono:
1.  **Analisi e Risposte Puntuali:** Rispondi a domande specifiche sui dati forniti.
2.  **Previsione di Liquidità e Digital Twin:** Hai accesso alle proiezioni di cassa, agli alert di liquidità (semaforo) e ai pattern stagionali. Se l'utente chiede se può permettersi una spesa o un'assunzione, analizza le proiezioni realistiche per dare una risposta basata sulla sostenibilità futura.
3.  **Ottimizzazione Pagamenti:** Suggerisci quando pagare una fattura per massimizzare gli sconti o proteggere la soglia di sicurezza (€5.000).
4.  **Valutazione Partner:** Usa gli "Entity Scores" per commentare l'affidabilità di clienti e fornitori.

**Istruzione Importante:** Quando ti vengono fatte domande su decisioni finanziarie, usa i dati di 'cashFlowProjections' e 'liquidityAlerts'. Se una spesa porta il saldo previsto sotto i €5.000, segnalalo chiaramente e suggerisci un timing alternativo.

Dati Finanziari e di Pianificazione a tua disposizione:
{{{financialData}}}

{{#if chatHistory}}
Storico della conversazione:
{{#each chatHistory}}
{{#if (eq role "user")}}Domanda Utente: {{content}}{{/if}}
{{#if (eq role "model")}}Tua Risposta: {{content}}{{/if}}
{{/each}}
{{/if}}

Domanda corrente dell'utente: {{{query}}}
`,
});

const provideAiChatAssistantFlow = ai.defineFlow(
  {
    name: 'provideAiChatAssistantFlow',
    inputSchema: ProvideAiChatAssistantInputSchema,
    outputSchema: ProvideAiChatAssistantOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      if (!output) {
        console.error('Error in provideAiChatAssistantFlow: AI returned no output.');
        return {
          response:
            'Mi dispiace, ma non sono riuscito a generare una risposta. Il modello AI non ha risposto.',
        };
      }
      return output;
    } catch (error) {
      console.error('Error in provideAiChatAssistantFlow:', error);
      // Return a controlled error response instead of letting the flow crash.
      return {
        response:
          'Mi dispiace, ma al momento non riesco a elaborare la tua richiesta. Ciò potrebbe essere dovuto a un volume elevato di domande o al superamento dei limiti di utilizzo del piano gratuito. Riprova tra qualche istante.',
      };
    }
  }
);