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
  entrata: z.union([z.string(), z.number()]).default(0).describe("L'importo dell'entrata (dare/accrediti). Se non è un'entrata, questo deve essere 0."),
  uscita: z.union([z.string(), z.number()]).default(0).describe("L'importo dell'uscita (avere/addebiti). Se non è un'uscita, questo deve essere 0."),
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
  prompt: `Sei un assistente AI specializzato nell'estrazione di dati finanziari. Il tuo unico compito è analizzare il file fornito ed estrarre i dati grezzi delle transazioni.

Per ogni riga che rappresenta una transazione, estrai ESATTAMENTE e SOLTANTO i seguenti campi:
- 'data': La data della transazione. Formattala come YYYY-MM-DD. Se l'anno non è esplicitamente presente, usa l'anno corrente: ${new Date().getFullYear()}.
- 'descrizione': La descrizione completa e originale della transazione, senza alterazioni.
- 'entrata': L'importo che risulta essere un'entrata o un accredito. Se la colonna è vuota o la transazione è un'uscita, il valore deve essere 0.
- 'uscita': L'importo che risulta essere un'uscita o un addebito. Se la colonna è vuota o la transazione è un'entrata, il valore deve essere 0.

IMPORTANTE: Non devi categorizzare, interpretare o aggiungere alcun altro campo. La tua unica responsabilità è l'estrazione pura.

Il tuo output DEVE essere un oggetto JSON con una singola chiave "movements", che contiene un array degli oggetti transazione estratti.
Se il file è vuoto o illeggibile, restituisci un array vuoto: {"movements": []}.

File da analizzare:
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

          // All imported movements will need manual review for categorization
          return {
              societa: input.company,
              anno: anno,
              data: dataValida,
              descrizione: mov.descrizione,
              categoria: 'Da categorizzare',
              sottocategoria: 'Da categorizzare',
              entrata: parseAmount(mov.entrata),
              uscita: parseAmount(mov.uscita),
              iva: 0.22, // Default IVA, user will review
              conto: input.conto || '',
              inseritoDa: input.inseritoDa,
              operatore: `Acquisizione da ${input.inseritoDa}`,
              metodoPag: 'Importato',
              note: `Importato da file: ${input.fileType}`,
              status: 'manual_review' as const, // Always needs review
          };
      });

      return { movements: cleanedMovements };
    } catch(e) {
        console.error("Error in importTransactionsFlow", e);
        // This makes the error message more useful for debugging and for the user.
        throw new Error(
          'L\'analisi AI non è riuscita. Ciò potrebbe essere dovuto a un file di formato non supportato, illeggibile o a un errore temporaneo del servizio. Prova con un file diverso o riprova più tardi.'
        );
    }
  }
);
