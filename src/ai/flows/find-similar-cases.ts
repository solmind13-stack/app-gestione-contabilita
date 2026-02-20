'use server';

/**
 * @fileOverview Un flow AI per trovare casi simili e lezioni apprese da altri imprenditori italiani.
 * Aiuta a contestualizzare le decisioni basandosi su esperienze comuni nel settore PMI.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const CaseSchema = z.object({
  who: z.string().describe("Tipo di azienda o settore (es. 'PMI Manifatturiera in Lombardia')."),
  action: z.string().describe("La decisione presa."),
  result: z.string().describe("Il risultato ottenuto (successo o fallimento)."),
  lesson: z.string().describe("La lezione principale appresa."),
  applicability: z.enum(['high', 'medium', 'low']).describe("Quanto il caso è applicabile alla situazione dell'utente."),
});

const FindSimilarCasesInputSchema = z.object({
  societa: z.string().describe("La società che richiede l'analisi."),
  userId: z.string().describe("L'ID dell'utente."),
  decisionDescription: z.string().describe("Descrizione della decisione in valutazione."),
  decisionAmount: z.number().describe("Importo economico della decisione."),
  currentBalance: z.number().describe("Liquidità attuale dell'azienda."),
});

const FindSimilarCasesOutputSchema = z.object({
  cases: z.array(CaseSchema),
  resources: z.array(z.string()).describe("Community, forum o portali suggeriti."),
  narrative: z.string().describe("Un commento di sintesi dell'IA."),
  disclaimer: z.string(),
});

export async function findSimilarCases(input: z.infer<typeof FindSimilarCasesInputSchema>) {
  return findSimilarCasesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findSimilarCasesPrompt',
  input: { schema: FindSimilarCasesInputSchema },
  output: { schema: FindSimilarCasesOutputSchema },
  prompt: `
    Sei un consulente strategico per PMI italiane. Un imprenditore sta valutando una decisione importante e ha bisogno di confrontarsi con esperienze passate di altri.

    DETTAGLI DECISIONE:
    - Descrizione: {{decisionDescription}}
    - Importo: {{decisionAmount}}€
    - Liquidità Attuale: {{currentBalance}}€

    IL TUO COMPITO:
    1. Identifica 2-4 casi simili di imprenditori o PMI italiane che hanno affrontato decisioni analoghe.
    2. Per ogni caso, descrivi chi era l'azienda, cosa ha fatto, il risultato e la lezione appresa.
    3. Valuta l'applicabilità (high/medium/low) basandoti sulla coerenza tra l'importo e la liquidità disponibile.
    4. Suggerisci community o risorse online italiane dove trovare discussioni su questi temi (es. PMI.it, Reddit r/italypersonalfinance, community di settore).
    5. Genera una narrativa di sintesi che aiuti l'utente a riflettere sulla sua scelta.

    REQUISITI:
    - Rispondi esclusivamente in formato JSON.
    - Usa un tono professionale, empatico e consulenziale.
    - Specifica sempre che i casi sono illustrativi.

    DISCLAIMER OBBLIGATORIO:
    "Questi casi sono illustrativi e basati su esperienze comuni nel panorama delle PMI italiane. Non rappresentano consulenza legale o finanziaria specifica per la tua azienda."
  `,
});

const findSimilarCasesFlow = ai.defineFlow(
  {
    name: 'findSimilarCasesFlow',
    inputSchema: FindSimilarCasesInputSchema,
    outputSchema: FindSimilarCasesOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);

      if (!output) {
        throw new Error("L'AI non è riuscita a trovare casi simili.");
      }

      // Salvataggio su Firestore
      await addDoc(collection(db, 'externalInsights'), {
        ...output,
        type: 'similar_cases',
        societa: input.societa,
        userId: input.userId,
        createdAt: new Date().toISOString(),
      });

      return output;
    } catch (error: any) {
      console.error("Find similar cases flow failed:", error);
      throw new Error(error.message || "Errore durante la ricerca di casi simili.");
    }
  }
);
