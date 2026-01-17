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
});
export type ImportTransactionsInput = z.infer<typeof ImportTransactionsInputSchema>;

// Schema for what the AI model should extract. This is kept simple and tolerant.
const AiExtractedMovementSchema = z.object({
  data: z.string().describe("La data della transazione in formato YYYY-MM-DD."),
  descrizione: z.string().describe("La descrizione completa della transazione."),
  entrata: z.union([z.string(), z.number()]).default(0).describe("L'importo dell'entrata. Se è un'uscita, questo deve essere 0."),
  uscita: z.union([z.string(), z.number()]).default(0).describe("L'importo dell'uscita. Se è un'entrata, questo deve essere 0."),
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
});


const ImportTransactionsOutputSchema = z.object({
  movements: z.array(FinalMovementSchema),
});
export type ImportTransactionsOutput = z.infer<typeof ImportTransactionsOutputSchema>;

export async function importTransactions(input: ImportTransactionsInput): Promise<ImportTransactionsOutput> {
  return importTransactionsFlow(input);
}

// SIMPLIFIED PROMPT FOR ROBUST EXTRACTION
const prompt = ai.definePrompt({
  name: 'importTransactionsPrompt',
  input: { schema: ImportTransactionsInputSchema },
  output: { schema: AiOutputSchema },
  prompt: `Sei un assistente per l'estrazione di dati finanziari. Il tuo unico compito è estrarre i movimenti dal file fornito e restituirli in formato JSON.

**Istruzioni Fondamentali:**
1.  Analizza il file fornito (immagine, PDF, Excel).
2.  Per ogni transazione che identifichi, estrai **solo** i seguenti 4 campi:
    - 'data': La data della transazione. Prova a formattarla come YYYY-MM-DD. Se l'anno non è presente, usa l'anno corrente: ${new Date().getFullYear()}.
    - 'descrizione': La descrizione completa e originale della transazione, così com'è scritta.
    - 'entrata': L'importo nella colonna delle entrate (o dare/accrediti). Se non è un'entrata, il valore deve essere 0.
    - 'uscita': L'importo nella colonna delle uscite (o avere/addebiti). Se non è un'uscita, il valore deve essere 0.
3.  **NON** tentare di indovinare categorie, sotto-categorie o IVA.
4.  **NON** inventare dati. Se un campo non è presente, usa il valore di default (0 per gli importi).

**Formato di Output Obbligatorio:**
La tua risposta DEVE essere un oggetto JSON con una singola chiave "movements", che contiene un array di oggetti transazione.
Esempio: {"movements": [{"data": "2024-07-29", "descrizione": "PAGAMENTO F24 DELEGA", "entrata": 0, "uscita": 150.55}]}
Se non trovi transazioni valide, restituisci un array vuoto: {"movements": []}

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

      // This function handles various string formats for numbers
      const parseAmount = (amount: string | number | undefined): number => {
          if (typeof amount === 'number') {
              return amount;
          }
          if (typeof amount === 'string') {
              // Handles formats like "1.234,56" or "1,234.56" or "€ 1.234,56"
              const cleaned = amount.replace(/[.€\s]/g, '').replace(',', '.');
              const parsed = parseFloat(cleaned);
              return isNaN(parsed) ? 0 : parsed;
          }
          return 0;
      };

      // Post-process the AI's raw output to enrich it and fit the final schema.
      const cleanedMovements = output.movements.map(mov => {
          let anno: number;
          let dataValida: string;
          try {
              const parsedDate = new Date(mov.data);
              if (isNaN(parsedDate.getTime())) { // Check for invalid date
                  throw new Error('Invalid date format from AI');
              }
              anno = parsedDate.getFullYear();
              dataValida = parsedDate.toISOString().split('T')[0]; // Ensure YYYY-MM-DD format
          } catch(e) {
              anno = new Date().getFullYear(); // Fallback to current year
              dataValida = new Date().toISOString().split('T')[0];
          }

          // Set default values here, in the code, for reliability.
          const categoriaDefault = 'Da categorizzare';
          const sottocategoriaDefault = 'Da categorizzare';
          const ivaDefault = 0.22;

          return {
              societa: input.company,
              anno: anno,
              data: dataValida,
              descrizione: mov.descrizione,
              categoria: categoriaDefault,
              sottocategoria: sottocategoriaDefault,
              entrata: parseAmount(mov.entrata),
              uscita: parseAmount(mov.uscita),
              iva: ivaDefault,
              conto: input.conto || '',
              inseritoDa: input.inseritoDa,
              operatore: input.inseritoDa, // Default operator to the user who imported
              metodoPag: 'Importato', // Default payment method
              note: `Importato da file: ${input.fileType}`,
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
