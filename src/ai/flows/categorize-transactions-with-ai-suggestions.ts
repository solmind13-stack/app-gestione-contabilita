// categorize-transactions-with-ai-suggestions.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting transaction categories, subcategories, and IVA percentages using AI.
 *
 * categorizeTransaction - A function that takes a transaction description and returns AI-powered suggestions for category, subcategory, and IVA percentage.
 * CategorizeTransactionInput - The input type for the categorizeTransaction function.
 * CategorizeTransactionOutput - The return type for the categorizeTransaction function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CategorizeTransactionInputSchema = z.object({
  description: z.string().describe('The description of the transaction.'),
});
export type CategorizeTransactionInput = z.infer<typeof CategorizeTransactionInputSchema>;

const CategorizeTransactionOutputSchema = z.object({
  category: z.string().describe('The suggested category for the transaction.'),
  subcategory: z.string().describe('The suggested subcategory for the transaction.'),
  ivaPercentage: z.number().describe('The suggested IVA percentage for the transaction.'),
  isRecurring: z.boolean().describe('Whether the transaction is likely to be recurring.'),
});
export type CategorizeTransactionOutput = z.infer<typeof CategorizeTransactionOutputSchema>;

export async function categorizeTransaction(input: CategorizeTransactionInput): Promise<CategorizeTransactionOutput | null> {
  return categorizeTransactionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'categorizeTransactionPrompt',
  input: {schema: CategorizeTransactionInputSchema},
  output: {schema: CategorizeTransactionOutputSchema},
  prompt: `You are an expert financial assistant specializing in categorizing transactions for Italian companies.

  Given the following transaction description, suggest the most appropriate category, subcategory, IVA percentage, and whether it's a recurring transaction.

  Description: {{{description}}}

  Respond in JSON format. Categories, subcategories and IVA percentages must be selected from the lists that follow.

  Categories: Immobiliare, Energia, Fornitori, Gestione Immobili, Gestione Generale, Tasse, Finanziamenti, Movimenti Interni
  Subcategories (per Immobiliare): Affitti, Depositi Cauzionali, Recupero Spese, Immobili
  Subcategories (per Energia): Quote CEF, Pratiche Contributo, Incentivi GSE, Vendita Energia
  Subcategories (per Fornitori): Materiali, Lavori/Manutenzione, Impianti, Servizi
  Subcategories (per Gestione Immobili): Spese Condominiali, Manutenzione, Ristrutturazione, Utenze
  Subcategories (per Gestione Generale): Spese Bancarie, Commercialista, Telefonia, Altre Spese
  Subcategories (per Tasse): IVA Trimestrale, IMU, IRES, IRAP, F24 Vari, Bolli, Cartelle Esattoriali
  Subcategories (per Finanziamenti): Rate Mutuo, Rate Prestito, Rimborso
  Subcategories (per Movimenti Interni): Giroconto, Trasferimento
  IVA Percentages: 0.22, 0.10, 0.04, 0.00
  `,
});

const categorizeTransactionFlow = ai.defineFlow(
  {
    name: 'categorizeTransactionFlow',
    inputSchema: CategorizeTransactionInputSchema,
    outputSchema: z.nullable(CategorizeTransactionOutputSchema),
  },
  async input => {
    try {
      const {output} = await prompt(input);
      return output!;
    } catch (error) {
      console.error('Error in categorizeTransactionFlow:', error);
      // Return null on error to not break batch processing
      return null;
    }
  }
);
