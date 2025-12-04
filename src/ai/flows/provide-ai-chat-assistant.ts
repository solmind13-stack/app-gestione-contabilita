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
  chatHistory: z
    .array(z.object({role: z.enum(['user', 'assistant']), content: z.string()}))
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
Per le analisi, spiega brevemente il ragionamento. Se non hai abbastanza dati per rispondere, dillo chiaramente. Puoi suggerire azioni concrete quando appropriato.

Here's the user's query: {{{query}}}

{% if chatHistory %}
  Here's the chat history:
  {% each chatHistory %}
    {{this.role}}: {{this.content}}
  {% endeach %}
{% endif %}
`,
});

const provideAiChatAssistantFlow = ai.defineFlow(
  {
    name: 'provideAiChatAssistantFlow',
    inputSchema: ProvideAiChatAssistantInputSchema,
    outputSchema: ProvideAiChatAssistantOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
