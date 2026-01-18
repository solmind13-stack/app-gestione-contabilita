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
    "The file content as a data URI. Must include a MIME type and use Base64 encoding. e.g., 'data:<mimetype>;base64,<encoded_data>'"
  ).optional(),
  textContent: z.string().describe("The text content extracted from a file, like a CSV or JSON string.").optional(),
  fileType: z.string().describe("The MIME type of the file (e.g., 'image/png', 'application/pdf')."),
  company: z.string().describe("The company to assign to the transactions."),
  conto: z.string().optional().describe("The bank account to associate with the transactions."),
  inseritoDa: z.string().describe("The name of the user importing the file."),
});
export type ImportTransactionsInput = z.infer<typeof ImportTransactionsInputSchema>;

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
  prompt: `Your ONLY task is to extract transactions from the provided content.
You MUST return a raw JSON string. The JSON object must have a single key "movements", which is an array of objects.
For each transaction object, you MUST extract the following fields as TEXT STRINGS: 'data', 'descrizione', 'entrata', 'uscita'.
If a field value is not present for a transaction, use '0' as the string value. Do NOT format numbers or currencies.

{{#if textContent}}
The content below is a JSON string representing rows from a spreadsheet. The keys of the objects are the column headers. Your job is to analyze this JSON and extract the transaction data based on the values.
{{{textContent}}}
{{else}}
Analyze the following file (an image or PDF) to extract the transactions.
{{media url=fileDataUri}}
{{/if}}`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
});

const importTransactionsFlow = ai.defineFlow(
  {
    name: 'importTransactionsFlow',
    inputSchema: ImportTransactionsInputSchema,
    outputSchema: ImportTransactionsOutputSchema,
  },
  async (input) => {
    try {
      const response = await prompt(input);
      const rawJsonString = response.text;

      let parsedAiOutput;
      try {
        // AI might return a markdown code block, so we need to clean it
        const cleanedJsonString = rawJsonString.replace(/^```json\n|```$/g, '');
        parsedAiOutput = JSON.parse(cleanedJsonString);
      } catch (jsonError) {
        console.error("AI returned invalid JSON string:", rawJsonString);
        throw new Error("L'AI non ha restituito un formato di dati valido. Riprova.");
      }
      
      if (!parsedAiOutput || !Array.isArray(parsedAiOutput.movements)) {
          throw new Error("Il formato JSON restituito dall'AI non è corretto (manca l'array 'movements').");
      }
      
      const aiMovements: {data?: string, descrizione?: string, entrata?: string, uscita?: string}[] = parsedAiOutput.movements;

      const parseAmount = (amount: string | number | undefined): number => {
          if (amount === undefined || amount === null) return 0;
          if (typeof amount === 'number') return amount;
          if (typeof amount === 'string') {
              const cleaned = amount
                .replace(/[€$£]/g, '')
                .trim()
                .replace(/\./g, (match, offset, fullString) => {
                    const rest = fullString.substring(offset + 1);
                    // This logic is tricky: it tries to remove thousand separators but keep decimal points.
                    // It assumes if a '.' is followed by a ',' or more than 3 digits, it's a thousand separator.
                    return rest.includes(',') || rest.length > 3 ? '' : '.';
                })
                .replace(',', '.');
              const parsed = parseFloat(cleaned);
              return isNaN(parsed) ? 0 : parsed;
          }
          return 0;
      };

      const cleanedMovements = aiMovements.map(mov => {
          if (!mov.descrizione || !mov.data) return null;
          
          let anno: number;
          let dataValida: string;
          try {
              // Attempt to parse various common date formats
              const dateString = String(mov.data).replace(/(\d{2})[./-](\d{2})[./-](\d{4})/, '$3-$2-$1');
              const parsedDate = new Date(dateString);
              if (isNaN(parsedDate.getTime())) {
                  // Try to handle Excel's numeric date format if it comes as a string
                  const excelDateNumber = parseInt(dateString, 10);
                  if (!isNaN(excelDateNumber) && excelDateNumber > 25569) { // Basic check for Excel date number
                     const excelEpoch = new Date(1899, 11, 30);
                     parsedDate.setTime(excelEpoch.getTime() + excelDateNumber * 86400000);
                  } else {
                     throw new Error('Invalid date');
                  }
              }
              anno = parsedDate.getFullYear();
              dataValida = parsedDate.toISOString().split('T')[0];
          } catch(e) {
              console.warn(`Could not parse date "${mov.data}", using today's date.`);
              anno = new Date().getFullYear();
              dataValida = new Date().toISOString().split('T')[0]; 
          }

          const entrataLorda = parseAmount(mov.entrata);
          const uscitaLorda = parseAmount(mov.uscita);
          
          let finalEntrata = 0;
          let finalUscita = 0;

          // The AI might put a negative number in 'entrata' for an expense.
          if(entrataLorda < 0) {
              finalUscita = Math.abs(entrataLorda);
          } else {
              finalEntrata = entrataLorda;
          }
          if(uscitaLorda > 0) {
              finalUscita = uscitaLorda;
          }


          return {
              societa: input.company,
              anno: anno,
              data: dataValida,
              descrizione: mov.descrizione,
              categoria: 'Da categorizzare',
              sottocategoria: 'Da categorizzare',
              entrata: finalEntrata,
              uscita: finalUscita,
              iva: 0.22,
              conto: input.conto || '',
              inseritoDa: input.inseritoDa,
              operatore: `Acquisizione da ${input.inseritoDa}`,
              metodoPag: 'Importato',
              note: `Importato da file: ${input.fileType}`,
              status: 'manual_review' as const,
          };
      }).filter((mov): mov is NonNullable<typeof mov> => mov !== null);

      return { movements: cleanedMovements };
    } catch(e: any) {
        console.error("Error in importTransactionsFlow", e);
        throw new Error(
          e.message || 'L\'analisi AI non è riuscita. Ciò potrebbe essere dovuto a un file di formato non supportato, illeggibile o a un errore temporaneo del servizio. Prova con un file diverso o riprova più tardi.'
        );
    }
  }
);
