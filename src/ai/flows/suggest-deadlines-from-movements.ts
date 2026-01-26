// src/ai/flows/suggest-deadlines-from-movements.ts
'use server';
/**
 * @fileOverview This file defines a heuristic-based function for suggesting deadlines from transaction movements.
 *
 * suggestDeadlines - A function that takes a list of transaction movements and returns potential deadlines.
 * SuggestDeadlinesInput - The input type for the suggestDeadlines function.
 * SuggestDeadlinesOutput - The return type for the suggestDeadlines function.
 */

import type { Movimento, Scadenza, DeadlineSuggestion } from '@/lib/types';
import { differenceInDays } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

// Define input/output types directly
export type SuggestDeadlinesInput = {
  movements: Movimento[];
  existingDeadlines: Scadenza[];
};

export type SuggestDeadlinesOutput = {
  suggestions: DeadlineSuggestion[];
};

// --- Helper Functions ---

// 1. Normalize counterparty/description
const normalizeText = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/s\.r\.l|srls|s\.p\.a|s\.a\.s|srl|spa|sas/g, '') // remove company suffixes
    .replace(/[^\w\s]/g, '') // remove punctuation
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
};

// 2. Keyword mapping for classification
const CLASSIFICATION_RULES = [
    { keywords: ['f24', 'tributi', 'imposte', 'ravvedimento'], category: 'Tasse', subcategory: 'F24 Vari' },
    { keywords: ['iva', 'liquidazione iva'], category: 'Tasse', subcategory: 'IVA Trimestrale' },
    { keywords: ['inps', 'contributi'], category: 'Tasse', subcategory: 'F24 Vari' },
    { keywords: ['assicurazione', 'polizza', 'rca'], category: 'Gestione Generale', subcategory: 'Altre Spese' },
    { keywords: ['canone', 'locazione', 'affitto'], category: 'Gestione Immobili', subcategory: 'Manutenzione' }, // Assuming expense
    { keywords: ['leasing'], category: 'Finanziamenti', subcategory: 'Rate Prestito' },
    { keywords: ['abbonamento', 'rinnovo', 'subscription', 'saas', 'hosting', 'canone software'], category: 'Gestione Generale', subcategory: 'Altre Spese' },
    { keywords: ['telecom', 'tim', 'vodafone', 'wind', 'iliad', 'telefonia'], category: 'Gestione Generale', subcategory: 'Telefonia' },
    { keywords: ['enel', 'servizio elettrico', 'energia', 'luce', 'gas', 'acqua'], category: 'Gestione Immobili', subcategory: 'Utenze' },
    { keywords: ['rata', 'finanziamento', 'mutuo'], category: 'Finanziamenti', subcategory: 'Rate Mutuo' },
];


// --- Main Heuristic Function ---

export async function suggestDeadlines(input: SuggestDeadlinesInput): Promise<SuggestDeadlinesOutput> {
  const { movements, existingDeadlines } = input;
  const MIN_OCCURRENCES = 3;

  // 1. Group movements by normalized description
  const groupedMovements = movements
    .filter(m => m.uscita > 0) // Only consider expenses
    .reduce((acc, mov) => {
        const key = `${mov.societa}_${normalizeText(mov.descrizione)}`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(mov);
        return acc;
    }, {} as Record<string, Movimento[]>);

  const suggestions: DeadlineSuggestion[] = [];

  // 2. Analyze each group
  for (const key in groupedMovements) {
    const group = groupedMovements[key].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

    if (group.length < MIN_OCCURRENCES) {
      continue;
    }

    // 3. Analyze Periodicity
    const intervals = [];
    for (let i = 1; i < group.length; i++) {
        intervals.push(differenceInDays(new Date(group[i].data), new Date(group[i - 1].data)));
    }
    
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    let recurrence: DeadlineSuggestion['recurrence'] = 'Nessuna';
    let periodicityScore = 0;
    
    if (avgInterval > 27 && avgInterval < 34) {
        recurrence = 'Mensile';
        periodicityScore = intervals.filter(i => i > 27 && i < 34).length / intervals.length > 0.6 ? 2 : 1;
    } else if (avgInterval > 85 && avgInterval < 97) {
        recurrence = 'Trimestrale';
        periodicityScore = intervals.filter(i => i > 85 && i < 97).length / intervals.length > 0.6 ? 2 : 1;
    } else if (avgInterval > 350 && avgInterval < 380) {
        recurrence = 'Annuale';
        periodicityScore = intervals.filter(i => i > 350 && i < 380).length / intervals.length > 0.6 ? 2 : 1;
    }

    if (recurrence === 'Nessuna') continue;

    // 4. Analyze Amount
    const amounts = group.map(m => m.uscita);
    const avgAmount = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
    const amountVariation = Math.max(...amounts) - Math.min(...amounts);
    const isAmountStable = (amountVariation / avgAmount) < 0.15; // 15% tolerance
    const amountScore = isAmountStable ? 1 : 0;
    
    // 5. Analyze Description for Keywords
    const descriptionSample = normalizeText(group[0].descrizione);
    let classification = { category: 'Da categorizzare', subcategory: 'Da categorizzare' };
    let keywordScore = 0;
    for (const rule of CLASSIFICATION_RULES) {
        if (rule.keywords.some(kw => descriptionSample.includes(kw))) {
            classification = { category: rule.category, subcategory: rule.subcategory };
            keywordScore = 2; // Strong match
            break;
        }
    }
    
    // 6. Calculate Confidence
    let confidenceScore = periodicityScore + amountScore + keywordScore + (group.length >= 4 ? 1 : 0);
    let confidence: DeadlineSuggestion['confidence'] = 'Bassa';
    if (confidenceScore >= 5) confidence = 'Alta';
    else if (confidenceScore >= 3) confidence = 'Media';

    // 7. Generate Reason
    let reason = `Rilevati ${group.length} pagamenti ${recurrence.toLowerCase()} a "${group[0].descrizione.substring(0, 25)}..." per un importo ${isAmountStable ? 'stabile' : 'variabile'} di circa ${formatCurrency(avgAmount)}.`;
    if (keywordScore > 0) reason += ` Classificato come '${classification.category}' per la presenza di parole chiave.`;

    // 8. Deduplication check
    const isDuplicate = existingDeadlines.some(d => 
        normalizeText(d.descrizione) === normalizeText(group[0].descrizione) &&
        d.societa === group[0].societa &&
        d.ricorrenza === recurrence
    );

    if (isDuplicate) continue;

    suggestions.push({
      description: group[0].descrizione,
      category: classification.category,
      subcategory: classification.subcategory,
      recurrence: recurrence,
      amount: avgAmount,
      originalMovementDescription: group[0].descrizione,
      confidence: confidence,
      reason: reason,
      movements: group.map(m => ({ id: m.id, data: m.data, importo: m.uscita })),
    });
  }

  // Sort by confidence
  const confidenceOrder = { 'Alta': 3, 'Media': 2, 'Bassa': 1 };
  return { suggestions: suggestions.sort((a,b) => confidenceOrder[b.confidence] - confidenceOrder[a.confidence]) };
}
