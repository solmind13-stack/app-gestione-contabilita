/**
 * @fileOverview Libreria statica per la gestione delle scadenze fiscali italiane ricorrenti.
 * Fornisce helper per calcolare scadenze future e stimare gli importi basandosi sullo storico.
 */

import type { FiscalDeadline } from './types/pianificazione';

type FiscalDeadlineTemplate = {
  name: string;
  type: 'IVA' | 'IRPEF' | 'INPS' | 'INAIL' | 'IMU' | 'F24' | 'ALTRO';
  dueDay: number;
  dueMonths: number[]; // 1-12
  frequency: 'monthly' | 'quarterly' | 'biannual' | 'annual';
  description: string;
  applicableTo: ('srl' | 'sas' | 'snc' | 'ditta_individuale' | 'piva' | 'all')[];
};

const FISCAL_TEMPLATES: FiscalDeadlineTemplate[] = [
  // IVA
  {
    name: 'Versamento IVA Mensile',
    type: 'IVA',
    dueDay: 16,
    dueMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    frequency: 'monthly',
    description: 'Versamento dell\'IVA per i contribuenti con liquidazione mensile.',
    applicableTo: ['all'],
  },
  {
    name: 'Versamento IVA Trimestrale',
    type: 'IVA',
    dueDay: 16,
    dueMonths: [5, 8, 11], // Maggio (Q1), Agosto (Q2), Novembre (Q3)
    frequency: 'quarterly',
    description: 'Versamento dell\'IVA per i contribuenti con liquidazione trimestrale.',
    applicableTo: ['all'],
  },
  {
    name: 'Acconto IVA Annuale',
    type: 'IVA',
    dueDay: 27,
    dueMonths: [12],
    frequency: 'annual',
    description: 'Versamento dell\'acconto IVA dovuto per l\'anno in corso.',
    applicableTo: ['all'],
  },
  {
    name: 'Dichiarazione IVA Annuale',
    type: 'IVA',
    dueDay: 30,
    dueMonths: [4],
    frequency: 'annual',
    description: 'Termine per la presentazione della dichiarazione IVA annuale.',
    applicableTo: ['all'],
  },
  // IRPEF/IRES
  {
    name: 'Versamento Ritenute d\'Acconto',
    type: 'IRPEF',
    dueDay: 16,
    dueMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    frequency: 'monthly',
    description: 'Versamento delle ritenute operate su compensi e stipendi.',
    applicableTo: ['all'],
  },
  {
    name: 'Saldo e 1° Acconto IRPEF/IRES',
    type: 'IRES',
    dueDay: 30,
    dueMonths: [6],
    frequency: 'annual',
    description: 'Versamento del saldo dell\'anno precedente e del primo acconto dell\'anno in corso.',
    applicableTo: ['all'],
  },
  {
    name: 'Secondo Acconto IRPEF/IRES',
    type: 'IRES',
    dueDay: 30,
    dueMonths: [11],
    frequency: 'annual',
    description: 'Versamento del secondo o unico acconto delle imposte sui redditi.',
    applicableTo: ['all'],
  },
  // INPS
  {
    name: 'Contributi INPS Dipendenti',
    type: 'INPS',
    dueDay: 16,
    dueMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    frequency: 'monthly',
    description: 'Versamento dei contributi previdenziali per i lavoratori dipendenti.',
    applicableTo: ['srl', 'sas', 'snc'],
  },
  {
    name: 'Contributi Fissi INPS Artigiani/Commercianti',
    type: 'INPS',
    dueDay: 16,
    dueMonths: [2, 5, 8, 11], // Feb, Mag, Ago, Nov
    frequency: 'quarterly',
    description: 'Rate trimestrali dei contributi fissi dovuti da artigiani e commercianti.',
    applicableTo: ['ditta_individuale', 'piva'],
  },
  {
    name: 'Contributi Gestione Separata',
    type: 'INPS',
    dueDay: 30,
    dueMonths: [6, 11], // Giugno (Saldo/1° Acc), Novembre (2° Acc)
    frequency: 'biannual',
    description: 'Versamento dei contributi alla Gestione Separata per collaboratori e P.IVA.',
    applicableTo: ['piva'],
  },
  // INAIL
  {
    name: 'Autoliquidazione INAIL (Premio Annuale)',
    type: 'INAIL',
    dueDay: 16,
    dueMonths: [2],
    frequency: 'annual',
    description: 'Regolazione del premio per l\'anno precedente e acconto per l\'anno in corso.',
    applicableTo: ['all'],
  },
  {
    name: 'Rate Premio INAIL',
    type: 'INAIL',
    dueDay: 16,
    dueMonths: [5, 8, 11],
    frequency: 'quarterly',
    description: 'Rateizzazione del premio INAIL (2°, 3° e 4° rata).',
    applicableTo: ['all'],
  },
  // IMU
  {
    name: 'Acconto IMU',
    type: 'IMU',
    dueDay: 16,
    dueMonths: [6],
    frequency: 'annual',
    description: 'Versamento della prima rata dell\'imposta municipale propria.',
    applicableTo: ['all'],
  },
  {
    name: 'Saldo IMU',
    type: 'IMU',
    dueDay: 16,
    dueMonths: [12],
    frequency: 'annual',
    description: 'Versamento della seconda rata (saldo) dell\'imposta municipale propria.',
    applicableTo: ['all'],
  },
  // ALTRI
  {
    name: 'Tassa Vidimazione Libri Sociali',
    type: 'ALTRO',
    dueDay: 16,
    dueMonths: [3],
    frequency: 'annual',
    description: 'Versamento della tassa forfettaria annuale per la numerazione e bollatura dei libri sociali.',
    applicableTo: ['srl'],
  },
  {
    name: 'Diritto Annuale Camera di Commercio',
    type: 'ALTRO',
    dueDay: 30,
    dueMonths: [6],
    frequency: 'annual',
    description: 'Diritto dovuto annualmente alla Camera di Commercio di riferimento.',
    applicableTo: ['all'],
  },
];

/**
 * Calcola il primo giorno lavorativo utile per una scadenza.
 * In Italia, se una scadenza cade di sabato o domenica, viene posticipata al lunedì.
 */
function getActualDueDate(year: number, month: number, day: number): string {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay(); // 0 = Domenica, 6 = Sabato

  if (dayOfWeek === 0) { // Domenica
    date.setDate(date.getDate() + 1);
  } else if (dayOfWeek === 6) { // Sabato
    date.setDate(date.getDate() + 2);
  }

  return date.toISOString().split('T')[0];
}

/**
 * Restituisce le scadenze fiscali per un mese specifico.
 */
export function getFiscalDeadlinesForMonth(
  month: number,
  year: number,
  companyType?: 'srl' | 'sas' | 'snc' | 'ditta_individuale' | 'piva'
): Omit<FiscalDeadline, 'id' | 'userId' | 'societa'>[] {
  return FISCAL_TEMPLATES.filter((t) => {
    // Filtra per mese
    const isMonthMatch = t.dueMonths.includes(month);
    if (!isMonthMatch) return false;

    // Filtra per tipo società
    if (!companyType) return true;
    return t.applicableTo.includes('all') || t.applicableTo.includes(companyType);
  }).map((t) => ({
    name: t.name,
    type: t.type as any,
    dueDate: getActualDueDate(year, month, t.dueDay),
    estimatedAmount: 0,
    isRecurring: true,
    frequency: t.frequency as any,
    notes: t.description,
  }));
}

/**
 * Restituisce le scadenze fiscali per i prossimi N mesi a partire dalla data odierna.
 */
export function getUpcomingFiscalDeadlines(
  months: number,
  companyType?: 'srl' | 'sas' | 'snc' | 'ditta_individuale' | 'piva'
): Omit<FiscalDeadline, 'id' | 'userId' | 'societa'>[] {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const results: Omit<FiscalDeadline, 'id' | 'userId' | 'societa'>[] = [];

  for (let i = 0; i < months; i++) {
    const targetMonth = ((currentMonth + i - 1) % 12) + 1;
    const targetYear = currentYear + Math.floor((currentMonth + i - 1) / 12);
    results.push(...getFiscalDeadlinesForMonth(targetMonth, targetYear, companyType));
  }

  // Filtra solo quelle che cadono da oggi in poi
  const todayStr = today.toISOString().split('T')[0];
  return results.filter(d => d.dueDate >= todayStr).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Stima l'importo di una scadenza basandosi sui pagamenti storici.
 * Applica una media ponderata dando più peso ai pagamenti più recenti.
 * 
 * @param deadlineName Il nome della scadenza (non usato nella formula ma utile per debug)
 * @param historicalPayments Array di importi [meno recente, ..., più recente]
 */
export function estimateFiscalAmount(deadlineName: string, historicalPayments: number[]): number {
  if (historicalPayments.length === 0) return 0;
  if (historicalPayments.length === 1) return historicalPayments[0];

  // Media ponderata: peso i = indice + 1
  let totalWeight = 0;
  let weightedSum = 0;

  historicalPayments.forEach((payment, index) => {
    const weight = index + 1;
    weightedSum += payment * weight;
    totalWeight += weight;
  });

  return Math.round((weightedSum / totalWeight) * 100) / 100;
}
