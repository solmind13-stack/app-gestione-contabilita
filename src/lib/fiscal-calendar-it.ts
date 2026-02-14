// src/lib/fiscal-calendar-it.ts
/**
 * @fileOverview Libreria TypeScript per la gestione delle scadenze fiscali italiane.
 * Contiene un array statico di tutte le scadenze ricorrenti e funzioni helper
 * per calcolare le scadenze future e stimare gli importi.
 *
 * - FISCAL_DEADLINES: Array statico delle scadenze fiscali ricorrenti.
 * - getUpcomingFiscalDeadlines: Calcola le scadenze per i prossimi N mesi.
 * - getFiscalDeadlinesForMonth: Restituisce le scadenze per un mese e anno specifici.
 * - estimateFiscalAmount: Stima l'importo di una scadenza basandosi sui pagamenti storici.
 */

import type { Timestamp } from 'firebase/firestore';

// Questo è un tipo di base per il nostro array statico.
// Le funzioni helper lo convertiranno nel tipo FiscalDeadline con date concrete.
type FiscalDeadlineTemplate = {
  name: string;
  type: 'IVA' | 'IRPEF' | 'IRES' | 'INPS' | 'INAIL' | 'IMU' | 'ALTRO';
  dueDay: number;
  dueMonth: number; // 1-12
  frequency: 'monthly' | 'quarterly' | 'biannual' | 'annual' | 'once';
  description: string;
  applicableTo: ('srl' | 'sas' | 'snc' | 'ditta_individuale' | 'piva' | 'all')[];
};

// Tipo importato da pianificazione.ts, ma definito qui per chiarezza
export interface FiscalDeadline {
  id: string;
  societa?: string;
  userId: string;
  name: string;
  type: 'IVA' | 'IRPEF' | 'INPS' | 'INAIL' | 'IMU' | 'F24' | 'ALTRO';
  dueDate: Date;
  estimatedAmount: number;
  isRecurring: boolean;
  frequency: 'monthly' | 'quarterly' | 'biannual' | 'annual' | 'once';
  notes?: string;
}

export const FISCAL_DEADLINES: readonly FiscalDeadlineTemplate[] = [
  // === IVA ===
  { name: "Versamento IVA Mensile", type: 'IVA', dueDay: 16, dueMonth: 0, frequency: 'monthly', description: "Versamento dell'IVA per i contribuenti mensili.", applicableTo: ['all'] },
  { name: "Versamento IVA Trimestrale - 1° Trimestre", type: 'IVA', dueDay: 16, dueMonth: 5, frequency: 'quarterly', description: "Versamento dell'IVA del primo trimestre.", applicableTo: ['all'] },
  { name: "Versamento IVA Trimestrale - 2° Trimestre", type: 'IVA', dueDay: 20, dueMonth: 8, frequency: 'quarterly', description: "Versamento dell'IVA del secondo trimestre (proroga di Ferragosto).", applicableTo: ['all'] },
  { name: "Versamento IVA Trimestrale - 3° Trimestre", type: 'IVA', dueDay: 16, dueMonth: 11, frequency: 'quarterly', description: "Versamento dell'IVA del terzo trimestre.", applicableTo: ['all'] },
  { name: "Acconto IVA", type: 'IVA', dueDay: 27, dueMonth: 12, frequency: 'annual', description: "Versamento dell'acconto IVA annuale.", applicableTo: ['all'] },
  { name: "Dichiarazione IVA Annuale", type: 'IVA', dueDay: 30, dueMonth: 4, frequency: 'annual', description: "Presentazione della dichiarazione IVA annuale.", applicableTo: ['all'] },
  
  // === IRPEF/IRES ===
  { name: "Versamento Ritenute d'Acconto", type: 'IRPEF', dueDay: 16, dueMonth: 0, frequency: 'monthly', description: "Versamento delle ritenute d'acconto su redditi da lavoro dipendente e autonomo.", applicableTo: ['all'] },
  { name: "Saldo e 1° Acconto IRPEF/IRES", type: 'IRES', dueDay: 30, dueMonth: 6, frequency: 'annual', description: "Versamento del saldo e del primo acconto delle imposte sui redditi.", applicableTo: ['all'] },
  { name: "Secondo Acconto IRPEF/IRES", type: 'IRES', dueDay: 30, dueMonth: 11, frequency: 'annual', description: "Versamento del secondo acconto delle imposte sui redditi.", applicableTo: ['all'] },

  // === INPS ===
  { name: "Contributi INPS Dipendenti", type: 'INPS', dueDay: 16, dueMonth: 0, frequency: 'monthly', description: "Versamento dei contributi previdenziali per i lavoratori dipendenti.", applicableTo: ['srl', 'sas', 'snc'] },
  { name: "Contributi Fissi INPS Artigiani/Commercianti - 1° Trimestre", type: 'INPS', dueDay: 16, dueMonth: 5, frequency: 'quarterly', description: "Prima rata dei contributi fissi per artigiani e commercianti.", applicableTo: ['ditta_individuale', 'piva'] },
  { name: "Contributi Fissi INPS Artigiani/Commercianti - 2° Trimestre", type: 'INPS', dueDay: 20, dueMonth: 8, frequency: 'quarterly', description: "Seconda rata dei contributi fissi (proroga di Ferragosto).", applicableTo: ['ditta_individuale', 'piva'] },
  { name: "Contributi Fissi INPS Artigiani/Commercianti - 3° Trimestre", type: 'INPS', dueDay: 16, dueMonth: 11, frequency: 'quarterly', description: "Terza rata dei contributi fissi.", applicableTo: ['ditta_individuale', 'piva'] },
  { name: "Contributi Fissi INPS Artigiani/Commercianti - 4° Trimestre", type: 'INPS', dueDay: 16, dueMonth: 2, frequency: 'quarterly', description: "Quarta rata dei contributi fissi.", applicableTo: ['ditta_individuale', 'piva'] },
  { name: "Saldo e 1° Acconto INPS Gestione Separata", type: 'INPS', dueDay: 30, dueMonth: 6, frequency: 'biannual', description: "Saldo e primo acconto per iscritti alla Gestione Separata.", applicableTo: ['piva'] },
  { name: "Secondo Acconto INPS Gestione Separata", type: 'INPS', dueDay: 30, dueMonth: 11, frequency: 'biannual', description: "Secondo acconto per iscritti alla Gestione Separata.", applicableTo: ['piva'] },

  // === INAIL ===
  { name: "Autoliquidazione INAIL", type: 'INAIL', dueDay: 16, dueMonth: 2, frequency: 'annual', description: "Versamento del premio di autoliquidazione annuale.", applicableTo: ['srl', 'sas', 'snc', 'ditta_individuale'] },
  { name: "Rata Premio INAIL - 1° Rata", type: 'INAIL', dueDay: 16, dueMonth: 5, frequency: 'quarterly', description: "Eventuale prima rata del premio INAIL.", applicableTo: ['srl', 'sas', 'snc', 'ditta_individuale'] },
  { name: "Rata Premio INAIL - 2° Rata", type: 'INAIL', dueDay: 20, dueMonth: 8, frequency: 'quarterly', description: "Eventuale seconda rata del premio INAIL.", applicableTo: ['srl', 'sas', 'snc', 'ditta_individuale'] },
  { name: "Rata Premio INAIL - 3° Rata", type: 'INAIL', dueDay: 16, dueMonth: 11, frequency: 'quarterly', description: "Eventuale terza rata del premio INAIL.", applicableTo: ['srl', 'sas', 'snc', 'ditta_individuale'] },

  // === IMU ===
  { name: "Acconto IMU", type: 'IMU', dueDay: 16, dueMonth: 6, frequency: 'biannual', description: "Pagamento dell'acconto dell'Imposta Municipale Unica.", applicableTo: ['all'] },
  { name: "Saldo IMU", type: 'IMU', dueDay: 16, dueMonth: 12, frequency: 'biannual', description: "Pagamento del saldo dell'Imposta Municipale Unica.", applicableTo: ['all'] },

  // === ALTRI ===
  { name: "Tassa Vidimazione Libri Sociali", type: 'ALTRO', dueDay: 16, dueMonth: 3, frequency: 'annual', description: "Tassa annuale per la vidimazione dei libri sociali per le società di capitali.", applicableTo: ['srl'] },
  { name: "Diritto Annuale Camera di Commercio", type: 'ALTRO', dueDay: 30, dueMonth: 6, frequency: 'annual', description: "Pagamento del diritto annuale alla Camera di Commercio.", applicableTo: ['all'] },
];

/**
 * Calcola la data di scadenza effettiva, posticipandola al primo giorno lavorativo successivo se cade di sabato o domenica.
 * @param year Anno della scadenza.
 * @param month Mese della scadenza (1-12).
 * @param day Giorno della scadenza.
 * @returns Un oggetto Date con la data di scadenza effettiva.
 */
function getActualDueDate(year: number, month: number, day: number): Date {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();

  if (dayOfWeek === 6) { // Sabato
    date.setUTCDate(date.getUTCDate() + 2);
  } else if (dayOfWeek === 0) { // Domenica
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date;
}

/**
 * Restituisce tutte le scadenze fiscali per un mese e anno specifici.
 * @param month Mese (1-12).
 * @param year Anno.
 * @param companyType Tipo di società per filtrare le scadenze applicabili.
 * @returns Un array di oggetti FiscalDeadline per il mese richiesto.
 */
export function getFiscalDeadlinesForMonth(
  month: number,
  year: number,
  companyType?: 'srl' | 'sas' | 'snc' | 'ditta_individuale' | 'piva'
): Omit<FiscalDeadline, 'id' | 'userId' | 'estimatedAmount' | 'societa'>[] {
  const deadlines: Omit<FiscalDeadline, 'id' | 'userId' | 'estimatedAmount' | 'societa'>[] = [];

  FISCAL_DEADLINES.forEach(template => {
    // Filtra per tipo di società, se specificato
    if (companyType && !template.applicableTo.includes(companyType) && !template.applicableTo.includes('all')) {
      return;
    }

    let isApplicable = false;
    if (template.frequency === 'monthly') {
        isApplicable = true;
    } else if (template.frequency === 'quarterly' && (month - template.dueMonth) % 3 === 0) {
        // Questa logica va affinata se i trimestri non sono standard
        if ([2,5,8,11].includes(template.dueMonth)) isApplicable = true;
    } else if (template.frequency === 'biannual' && (month - template.dueMonth) % 6 === 0) {
        isApplicable = true;
    } else if (template.dueMonth === month) {
        isApplicable = true;
    }


    if (isApplicable) {
      deadlines.push({
        name: template.name,
        type: template.type,
        dueDate: getActualDueDate(year, month, template.dueDay),
        isRecurring: template.frequency !== 'once',
        frequency: template.frequency,
        notes: template.description,
      });
    }
  });

  return deadlines;
}

/**
 * Restituisce le scadenze fiscali per i prossimi N mesi.
 * @param months Numero di mesi futuri da analizzare (default 12).
 * @param companyType Tipo di società per filtrare le scadenze.
 * @returns Un array di oggetti FiscalDeadline.
 */
export function getUpcomingFiscalDeadlines(
  months: number = 12,
  companyType?: 'srl' | 'sas' | 'snc' | 'ditta_individuale' | 'piva'
): Omit<FiscalDeadline, 'id' | 'userId' | 'estimatedAmount' | 'societa'>[] {
  const upcomingDeadlines: Omit<FiscalDeadline, 'id' | 'userId' | 'estimatedAmount' | 'societa'>[] = [];
  const today = new Date();

  for (let i = 0; i < months; i++) {
    const targetDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;

    const deadlinesForMonth = getFiscalDeadlinesForMonth(month, year, companyType);
    upcomingDeadlines.push(...deadlinesForMonth);
  }

  // Filtra solo le scadenze che non sono già passate nel mese corrente
  return upcomingDeadlines.filter(d => d.dueDate >= today);
}


/**
 * Stima l'importo di una scadenza basandosi sui pagamenti storici,
 * dando più peso a quelli più recenti.
 * @param deadlineName Il nome della scadenza (non usato in questa implementazione semplice).
 * @param historicalPayments Un array di importi storici, dal meno recente al più recente.
 * @returns L'importo medio ponderato stimato.
 */
export function estimateFiscalAmount(
  deadlineName: string,
  historicalPayments: number[]
): number {
  if (historicalPayments.length === 0) {
    return 0;
  }
  if (historicalPayments.length === 1) {
    return historicalPayments[0];
  }

  let weightedSum = 0;
  let weightSum = 0;

  historicalPayments.forEach((payment, index) => {
    const weight = index + 1; // Peso crescente: 1 per il più vecchio, N per il più recente
    weightedSum += payment * weight;
    weightSum += weight;
  });

  return weightedSum / weightSum;
}
