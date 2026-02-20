// src/lib/data-validation.ts
import { Movimento, Scadenza, PrevisioneEntrata, PrevisioneUscita, CompanyProfile } from './types';
import { CATEGORIE } from './constants';
import { parseDate } from './utils';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valida un movimento bancario (Movement).
 */
export function validateMovement(
  data: Partial<Movimento>, 
  existingMovements: Movimento[], 
  companies: CompanyProfile[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const amount = (data.entrata || 0) + (data.uscita || 0);
  if (amount <= 0) {
    errors.push("L'importo deve essere maggiore di zero.");
  }

  if (data.data) {
    const movementDate = parseDate(data.data);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (movementDate > today) {
      errors.push("La data del movimento non può essere nel futuro.");
    }
  } else {
    errors.push("La data è obbligatoria.");
  }

  if (!data.categoria || !Object.keys(CATEGORIE).includes(data.categoria)) {
    errors.push("La categoria selezionata non è valida.");
  }

  if (!data.societa || !companies.some(c => c.sigla === data.societa)) {
    errors.push("La società specificata non è registrata nel sistema.");
  }

  if (!data.descrizione || data.descrizione.trim().length < 3) {
    errors.push("La descrizione deve contenere almeno 3 caratteri.");
  }

  // Check for duplicates
  const dupCheck = checkDuplicate(existingMovements, data);
  if (dupCheck.isDuplicate) {
    warnings.push("Attenzione: questo movimento sembra essere identico a uno già presente (stessa data, importo e descrizione).");
  }

  // Requirement: if type is entry, must have a source implied in desc
  if (data.entrata && data.entrata > 0) {
    const lowerDesc = data.descrizione?.toLowerCase() || '';
    if (!lowerDesc.includes('da') && !lowerDesc.includes('incasso') && !lowerDesc.includes('fattura')) {
      warnings.push("Si consiglia di indicare chiaramente la fonte o il cliente dell'entrata nella descrizione.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida una scadenza (Deadline).
 */
export function validateDeadline(
  data: Partial<Scadenza>, 
  existingDeadlines: Scadenza[], 
  companies: CompanyProfile[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.dataScadenza) {
    const deadlineDate = parseDate(data.dataScadenza);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deadlineDate < today) {
      errors.push("La data di scadenza non può essere nel passato.");
    }
  } else {
    errors.push("La data di scadenza è obbligatoria.");
  }

  if ((data.importoPrevisto || 0) <= 0) {
    errors.push("L'importo previsto deve essere un valore positivo.");
  }

  if (!data.societa || !companies.some(c => c.sigla === data.societa)) {
    errors.push("La società specificata non è valida.");
  }

  if (!data.descrizione || data.descrizione.trim().length < 3) {
    errors.push("La descrizione della scadenza è obbligatoria.");
  }

  const dupCheck = checkDuplicate(existingDeadlines, data);
  if (dupCheck.isDuplicate) {
    warnings.push("Esiste già una scadenza con la stessa data, importo e descrizione per questa società.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida una previsione di entrata (Income Forecast).
 */
export function validateIncomeForecast(
  data: Partial<PrevisioneEntrata>, 
  companies: CompanyProfile[], 
  historicalMovements: Movimento[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if ((data.importoLordo || 0) <= 0) {
    errors.push("L'importo della previsione deve essere maggiore di zero.");
  }

  if (data.dataPrevista) {
    const forecastDate = parseDate(data.dataPrevista);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (forecastDate <= today) {
      errors.push("La data prevista deve essere nel futuro.");
    }
  } else {
    errors.push("La data prevista è obbligatoria.");
  }

  if (!data.categoria) {
    errors.push("La categoria è obbligatoria per le previsioni.");
  }

  if (!data.societa || !companies.some(c => c.sigla === data.societa)) {
    errors.push("La società specificata non è valida.");
  }

  // Warning for unknown client
  if (data.descrizione && historicalMovements.length > 0) {
    const firstWord = data.descrizione.trim().split(' ')[0].toLowerCase();
    const knownEntities = new Set(
      historicalMovements
        .filter(m => m.entrata > 0)
        .map(m => m.descrizione.trim().split(' ')[0].toLowerCase())
    );
    if (firstWord.length > 3 && !knownEntities.has(firstWord)) {
      warnings.push(`Il cliente o l'entità "${firstWord}" non è mai apparso negli incassi passati. Verifica la correttezza.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida una previsione di uscita (Expense Forecast).
 */
export function validateExpenseForecast(
  data: Partial<PrevisioneUscita>, 
  companies: CompanyProfile[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if ((data.importoLordo || 0) <= 0) {
    errors.push("L'importo della spesa prevista deve essere positivo.");
  }

  if (data.dataScadenza) {
    const forecastDate = parseDate(data.dataScadenza);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (forecastDate <= today) {
      errors.push("La data della spesa prevista deve essere nel futuro.");
    }
  } else {
    errors.push("La data prevista è obbligatoria.");
  }

  if (!data.societa || !companies.some(c => c.sigla === data.societa)) {
    errors.push("La società specificata non è valida.");
  }

  if (data.ricorrenza && data.ricorrenza !== 'Nessuna') {
    if (data.ricorrenza === 'Altro' && (!data.note || data.note.length < 5)) {
      warnings.push("Per ricorrenze personalizzate, specifica la frequenza dettagliata nelle note.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Controlla se un nuovo elemento è un duplicato di uno esistente.
 */
export function checkDuplicate(items: any[], newItem: any): { isDuplicate: boolean, similarDocId?: string } {
  const newDate = newItem.data || newItem.dataScadenza || newItem.dataPrevista;
  const newAmount = newItem.importo || newItem.importoPrevisto || newItem.importoLordo || (newItem.entrata || 0) + (newItem.uscita || 0);
  const newDesc = newItem.descrizione?.trim().toLowerCase();
  const newSocieta = newItem.societa;

  if (!newDate || !newAmount || !newDesc || !newSocieta) return { isDuplicate: false };

  const duplicate = items.find(item => {
    const itemDate = item.data || item.dataScadenza || item.dataPrevista;
    const itemAmount = item.importo || item.importoPrevisto || item.importoLordo || (item.entrata || 0) + (item.uscita || 0);
    const itemDesc = item.descrizione?.trim().toLowerCase();
    const itemSocieta = item.societa;

    return itemDate === newDate && 
           Math.abs(itemAmount - newAmount) < 0.01 && 
           itemDesc === newDesc && 
           itemSocieta === newSocieta &&
           item.id !== newItem.id;
  });

  return {
    isDuplicate: !!duplicate,
    similarDocId: duplicate?.id
  };
}

/**
 * Esegue validazioni incrociate basate sullo storico.
 */
export function crossValidate(
  data: { importoLordo: number, categoria: string, societa: string, type: 'income' | 'expense' }, 
  historicalMovements: Movimento[]
): { warnings: string[] } {
  const warnings: string[] = [];
  const companyMovements = historicalMovements.filter(m => m.societa === data.societa);
  
  // 1. Check for unusually large amounts (> 10x historical average for category)
  const catMovements = companyMovements.filter(m => m.categoria === data.categoria && (data.type === 'income' ? m.entrata > 0 : m.uscita > 0));
  if (catMovements.length >= 3) {
    const avg = catMovements.reduce((sum, m) => sum + (data.type === 'income' ? m.entrata : m.uscita), 0) / catMovements.length;
    if (avg > 0 && data.importoLordo > avg * 10) {
      warnings.push(`L'importo (€${data.importoLordo}) è oltre 10 volte superiore alla media storica per la categoria ${data.categoria} (€${avg.toFixed(2)}).`);
    }
  }

  // 2. Check for high monthly concentration
  if (data.type === 'expense') {
    const monthlyIncomes = companyMovements
      .filter(m => m.entrata > 0)
      .reduce((acc, m) => {
        const monthKey = m.data.substring(0, 7);
        acc[monthKey] = (acc[monthKey] || 0) + m.entrata;
        return acc;
      }, {} as Record<string, number>);
    
    const incomeValues = Object.values(monthlyIncomes);
    if (incomeValues.length > 0) {
      const avgMonthlyIncome = incomeValues.reduce((a, b) => a + b, 0) / incomeValues.length;
      if (data.importoLordo > avgMonthlyIncome * 3) {
        warnings.push(`Questa uscita (€${data.importoLordo}) è molto elevata rispetto alla media degli incassi mensili (€${avgMonthlyIncome.toFixed(2)}).`);
      }
    }
  }

  return { warnings };
}
