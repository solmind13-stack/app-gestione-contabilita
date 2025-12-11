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
  company: z.enum(['LNC', 'STG', 'Tutte']).describe('The company to filter data by.'),
  // In a real app, you would pass real, structured data here.
  // For this example, we'll pass a summary string.
  financialData: z.string().describe('A string containing a summary of movements, deadlines, and forecasts.'),
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
Hai accesso ai dati di movimenti bancari, scadenze, previsioni entrate e uscite. Rispondi sempre in italiano. Formatta gli importi in euro con due decimali (es: €1.234,56). Quando fornisci dati numerici sii preciso.

Le tue capacità principali sono:
1.  **Analisi e Risposte Puntuali:** Rispondi a domande specifiche sui dati forniti.
2.  **Previsione di Liquidità:** Se l'utente chiede la disponibilità economica per un certo periodo (giorno, settimana, mese), analizza tutti i dati (movimenti passati, scadenze future, previsioni di entrata e uscita con la loro probabilità) per calcolare un saldo di cassa previsto. Spiega i calcoli chiave.
3.  **Ottimizzazione Pagamenti:** Se l'utente chiede come scaglionare i pagamenti, analizza la liquidità prevista e le scadenze. Suggerisci un piano ottimale, indicando quali pagamenti potrebbero essere posticipati o anticipati per mantenere un cash flow positivo, se possibile.

Dati Finanziari a tua disposizione:
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
      return output!;
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
