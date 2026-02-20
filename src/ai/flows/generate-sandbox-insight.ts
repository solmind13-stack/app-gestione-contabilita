
'use server';

/**
 * @fileOverview Genera insight strategici basati sulle simulazioni della Sandbox.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SandboxInsightInputSchema = z.object({
  societa: z.string(),
  impactAmount: z.number(),
  monthsUnderThreshold: z.number(),
  actions: z.string(),
  currentStatus: z.string(),
});

const SandboxInsightOutputSchema = z.object({
  insight: z.string().describe("Un consiglio strategico in italiano (max 2-3 frasi)."),
});

export async function generateSandboxInsight(input: z.infer<typeof SandboxInsightInputSchema>) {
  return generateSandboxInsightFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSandboxInsightPrompt',
  input: { schema: SandboxInsightInputSchema },
  output: { schema: SandboxInsightOutputSchema },
  prompt: `
    Sei un consulente finanziario per l'azienda {{societa}}.
    L'utente sta simulando delle operazioni nella Sandbox ("what-if").
    
    AZIONI SIMULATE:
    {{{actions}}}
    
    IMPATTO RILEVATO:
    - Variazione balance a 3 mesi: {{impactAmount}}€
    - Mesi previsti sotto soglia sicurezza (5.000€): {{monthsUnderThreshold}}
    - Stato liquidità attuale: {{currentStatus}}
    
    Analizza queste simulazioni e fornisci un consiglio pratico e strategico in italiano.
    Sii specifico: se una spesa manda l'azienda sotto soglia, suggerisci quando sarebbe meglio farla o come compensare.
    Mantieni un tono professionale e orientato all'azione.
  `,
});

const generateSandboxInsightFlow = ai.defineFlow(
  {
    name: 'generateSandboxInsightFlow',
    inputSchema: SandboxInsightInputSchema,
    outputSchema: SandboxInsightOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output || { insight: "L'analisi delle simulazioni non ha rilevato criticità strutturali immediate. Procedi con cautela monitorando gli incassi previsti." };
  }
);
