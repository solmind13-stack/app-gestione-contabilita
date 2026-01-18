// src/ai/flows/import-transactions-flow.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for importing transactions from a file.
 *
 * importTransactions - A function that takes a file data URI and returns a list of extracted transactions.
 * ImportTransactionsInput - The input type for the importTransactions function.
 * ImportTransactionsOutput - The return type for the importTransactions function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ImportTransactionsInputSchema = z.object({
  fileDataUri: z.string().describe(
    "The file content as a data URI. Must include a MIME type and use Base64 encoding. e.g., 'data:<mimetype>;base64,<encoded_data>'."
  ),
  fileType: z.string().describe("The MIME type of the file (e.g., 'image/png', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')."),
  company: z.string().describe("The company to assign to the transactions."),
  conto: z.string().optional().describe("The bank account to associate with the transactions."),
  inseritoDa: z.string().describe("The name of the user importing the file."),
  categories: z.record(z.array(z.string())).describe("A JSON object of available categories and subcategories."),
});
export type ImportTransactionsInput = z.infer<typeof ImportTransactionsInputSchema>;

// Schema for what the AI model should extract. It includes optional category fields.
const AiExtractedMovementSchema = z.object({
  data: z.string().describe("La data della transazione in formato YYYY-MM-DD."),
  descrizione: z.string().describe("La descrizione completa della transazione."),
  entrata: z.union([z.string(), z.number()]).default(0).describe("L'importo dell'entrata. Se è un'uscita, questo deve essere 0."),
  uscita: z.union([z.string(), z.number()]).default(0).describe("L'importo dell'uscita. Se è un'entrata, questo deve essere 0."),
  categoria: z.string().optional().describe("La categoria più probabile scelta dalla lista fornita."),
  sottocategoria: z.string().optional().describe("La sotto-categoria più probabile scelta dalla lista fornita."),
});

// The schema for the AI's direct output.
const AiOutputSchema = z.object({
    movements: z.array(AiExtractedMovementSchema),
});

// This is what the final flow will return after our code processes the AI output.
const FinalMovementSchema = z.object({
    societa: z.string(),
    anno: z.number(),
    data: z.string(),
    descrizione: z.string(),
    categoria: z.string(),
    sottocategoria: z.string(),
    entrata: z.number(),
    uscita: z.number(),
    iva: z.number(),
    conto: z.string().optional(),
    operatore: z.string().optional(),
    metodoPag: z.string().optional(),
    note: z.string().optional(),
    inseritoDa: z.string().optional(),
    status: z.enum(['ok', 'manual_review']),
});


const ImportTransactionsOutputSchema = z.object({
  movements: z.array(FinalMovementSchema),
});
export type ImportTransactionsOutput = z.infer<typeof ImportTransactionsOutputSchema>;

export async function importTransactions(input: ImportTransactionsInput): Promise<ImportTransactionsOutput> {
  return importTransactionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'importTransactionsPrompt',
  input: { schema: ImportTransactionsInputSchema },
  output: { schema: AiOutputSchema },
  prompt: `Sei un assistente per l'acquisizione di dati finanziari. Il tuo compito è eseguire due passaggi:

**Fase 1: Estrazione Dati Grezzi**
Analizza il file fornito. Per ogni transazione, estrai i seguenti campi fondamentali:
- 'data': La data della transazione. Formattala come YYYY-MM-DD. Se l'anno non è presente, usa l'anno corrente: ${new Date().getFullYear()}.
- 'descrizione': La descrizione completa e originale della transazione.
- 'entrata': L'importo nella colonna delle entrate (dare/accrediti). Se non è un'entrata, deve essere 0.
- 'uscita': L'importo nella colonna delle uscite (avere/addebiti). Se non è un'uscita, deve essere 0.

**Fase 2: Classificazione**
Usa la descrizione estratta per assegnare la categoria e la sotto-categoria più appropriate.
- Scegli una 'categoria' dall'elenco delle chiavi principali del seguente oggetto JSON.
- Scegli una 'sottocategoria' dall'array corrispondente alla categoria scelta.

**Elenco Categorie/Sotto-categorie autorizzate:**
\`\`\`json
{{{json categories}}}
\`\`\`

**Regole di Classificazione:**
- Se sei sicuro della classificazione (confidenza > 90%), assegna i campi 'categoria' e 'sottocategoria'.
- Se NON sei sicuro, lascia i campi 'categoria' e 'sottocategoria' vuoti o null.

**Formato di Output Obbligatorio:**
La tua risposta DEVE essere un oggetto JSON con una singola chiave "movements", che contiene un array di oggetti transazione.
Se non trovi transazioni, restituisci un array vuoto: {"movements": []}

**File da analizzare:**
{{media url=fileDataUri}}`,
});

const importTransactionsFlow = ai.defineFlow(
  {
    name: 'importTransactionsFlow',
    inputSchema: ImportTransactionsInputSchema,
    outputSchema: ImportTransactionsOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      
      if (!output || !output.movements) {
          return { movements: [] };
      }

      const parseAmount = (amount: string | number | undefined): number => {
          if (typeof amount === 'number') return amount;
          if (typeof amount === 'string') {
              const cleaned = amount.replace(/[.€\s]/g, '').replace(',', '.');
              const parsed = parseFloat(cleaned);
              return isNaN(parsed) ? 0 : parsed;
          }
          return 0;
      };

      const cleanedMovements = output.movements.map(mov => {
          let anno: number;
          let dataValida: string;
          try {
              const parsedDate = new Date(mov.data);
              if (isNaN(parsedDate.getTime())) throw new Error('Invalid date');
              anno = parsedDate.getFullYear();
              dataValida = parsedDate.toISOString().split('T')[0];
          } catch(e) {
              anno = new Date().getFullYear();
              dataValida = new Date().toISOString().split('T')[0];
          }

          const needsReview = !mov.categoria || !input.categories[mov.categoria];
          
          return {
              societa: input.company,
              anno: anno,
              data: dataValida,
              descrizione: mov.descrizione,
              categoria: needsReview ? 'Da categorizzare' : mov.categoria!,
              sottocategoria: needsReview ? 'Da categorizzare' : (mov.sottocategoria || 'Da categorizzare'),
              entrata: parseAmount(mov.entrata),
              uscita: parseAmount(mov.uscita),
              iva: 0.22, // Default IVA
              conto: input.conto || '',
              inseritoDa: input.inseritoDa,
              operatore: `Acquisizione da ${input.inseritoDa}`,
              metodoPag: 'Importato',
              note: `Importato da file: ${input.fileType}`,
              status: needsReview ? 'manual_review' as const : 'ok' as const,
          };
      });

      return { movements: cleanedMovements };
    } catch(e) {
        console.error("Error in importTransactionsFlow", e);
        throw new Error(
          'L\'analisi AI non è riuscita. Ciò potrebbe essere dovuto a un file di formato non supportato, illeggibile o a un errore temporaneo del servizio. Prova con un file diverso o riprova più tardi.'
        );
    }
  }
);
