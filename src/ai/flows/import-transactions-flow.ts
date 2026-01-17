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
import { CATEGORIE } from '@/lib/constants';

const ImportTransactionsInputSchema = z.object({
  fileDataUri: z.string().describe(
    "The file content as a data URI. Must include a MIME type and use Base64 encoding. e.g., 'data:<mimetype>;base64,<encoded_data>'."
  ),
  fileType: z.string().describe("The MIME type of the file (e.g., 'image/png', 'application/pdf')."),
  company: z.string().describe("The company to assign to the transactions."),
  conto: z.string().optional().describe("The bank account to associate with the transactions."),
  inseritoDa: z.string().describe("The name of the user importing the file."),
});
export type ImportTransactionsInput = z.infer<typeof ImportTransactionsInputSchema>;

// Schema for what the AI model should extract. Now more lenient on amounts.
const AiExtractedMovementSchema = z.object({
  data: z.string().describe("The date of the transaction in YYYY-MM-DD format."),
  descrizione: z.string().describe("The full description of the transaction."),
  entrata: z.union([z.string(), z.number()]).default(0).describe("The income amount. If it's an expense, this should be 0."),
  uscita: z.union([z.string(), z.number()]).default(0).describe("The expense amount. If it's an income, this should be 0."),
});

// The schema for the AI's direct output.
const AiOutputSchema = z.object({
    movements: z.array(AiExtractedMovementSchema),
});

// This is what the final flow will return.
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

// SIMPLIFIED PROMPT
const prompt = ai.definePrompt({
  name: 'importTransactionsPrompt',
  input: { schema: ImportTransactionsInputSchema },
  output: { schema: AiOutputSchema },
  prompt: `Sei un assistente per l'estrazione di dati. Il tuo unico compito è estrarre i movimenti finanziari dal file fornito e restituirli in formato JSON.

**Istruzioni:**
1.  Analizza il file (immagine, PDF, o altro).
2.  Per ogni riga che rappresenta una transazione, estrai i seguenti campi:
    - 'data': La data della transazione in formato YYYY-MM-DD. Se manca l'anno, usa l'anno corrente: ${new Date().getFullYear()}.
    - 'descrizione': La descrizione completa e originale della transazione.
    - 'entrata': L'importo dell'entrata (lordo). Se non è un'entrata, deve essere 0.
    - 'uscita': L'importo dell'uscita (lordo). Se non è un'uscita, deve essere 0.
3.  Non inventare dati. Se un campo non è presente, omettilo o usa il valore di default (0 per gli importi).
4.  Non tentare di categorizzare o suggerire l'IVA. Concentrati solo sull'estrazione dei 4 campi richiesti.

**Formato di Output Obbligatorio:**
La tua risposta deve essere ESCLUSIVAMENTE un oggetto JSON con una singola chiave "movements", che contiene un array di oggetti transazione.
Esempio: {"movements": [{"data": "2024-07-29", "descrizione": "PAGAMENTO F24", "entrata": 0, "uscita": 150.55}]}
Se non trovi transazioni, restituisci: {"movements": []}

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

      // Post-process the AI's output to enrich it and fit the final schema.
      const cleanedMovements = output.movements.map(mov => {
          let anno: number;
          let dataValida: string = mov.data;
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

          // All categorization is now defaulted here, not by the AI.
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
              operatore: input.inseritoDa, // Set the operator as the user who imported
              metodoPag: 'Importato', // Default payment method
              note: `Importato da file`,
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
