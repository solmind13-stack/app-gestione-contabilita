// src/lib/types/pianificazione.ts

import type { Timestamp } from 'firebase/firestore';

/**
 * Rappresenta una proiezione dettagliata del flusso di cassa.
 */
export interface CashFlowProjection {
  id: string;
  societa: string;
  userId: string;
  weeklyProjections: {
    weekStart: Date;
    weekEnd: Date;
    inflows: number;
    outflows: number;
    netFlow: number;
    cumulativeBalance: number;
  }[];
  monthlyProjections: {
    month: number;
    year: number;
    inflows: number;
    outflows: number;
    netFlow: number;
    cumulativeBalance: number;
  }[];
  scenarioType: 'optimistic' | 'realistic' | 'pessimistic';
  confidenceScore: number; // 0-100
  generatedAt: Timestamp;
  baseBalance: number;
}

/**
 * Rappresenta uno scenario di pianificazione salvato da un utente.
 */
export interface PlanningScenario {
  id: string;
  societa: string;
  userId: string;
  name: string;
  description: string;
  scenarioType: 'optimistic' | 'realistic' | 'pessimistic';
  probability: number; // 0-100
  projections: CashFlowProjection;
  assumptions: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Contiene lo score di affidabilità per un cliente o fornitore.
 */
export interface EntityScore {
  id: string;
  societa: string;
  userId: string;
  entityName: string;
  entityType: 'client' | 'supplier';
  reliabilityScore: number; // 0-100
  averagePaymentDelay: number; // in giorni
  totalTransactions: number;
  onTimePercentage: number;
  lastUpdated: Timestamp;
  history: {
    date: Date;
    score: number;
    reason: string;
  }[];
}

/**
 * Rappresenta un alert di liquidità, simile a un semaforo.
 */
export interface LiquidityAlert {
  id: string;
  societa: string;
  userId: string;
  status: 'green' | 'yellow' | 'red';
  message: string;
  projectedDate: Date;
  projectedBalance: number;
  triggeredAt: Timestamp;
  acknowledged: boolean;
}

/**
 * Definisce un budget per una specifica categoria o sottocategoria di spesa.
 */
export interface CategoryBudget {
  id: string;
  societa: string;
  userId: string;
  category: string;
  subcategory?: string;
  monthlyAverage: number;
  currentMonthSpent: number;
  suggestedBudget: number;
  deviation: number; // percentuale
  trend: 'increasing' | 'stable' | 'decreasing';
  updatedAt: Timestamp;
}

/**
 * Rappresenta una scadenza fiscale tipica del sistema italiano.
 */
export interface FiscalDeadline {
  id: string;
  societa?: string;
  userId: string;
  name: string;
  type: 'IVA' | 'IRPEF' | 'INPS' | 'INAIL' | 'IMU' | 'F24' | 'ALTRO';
  dueDate: Date;
  estimatedAmount: number;
  isRecurring: boolean;
  frequency: 'monthly' | 'quarterly' | 'biannual' | 'annual';
  notes?: string;
}

/**
 * Confronta i dati previsti con quelli reali per un determinato mese,
 * fornendo un punteggio di accuratezza.
 */
export interface MonthlyReplay {
  id: string;
  societa: string;
  userId: string;
  month: number;
  year: number;
  predictedInflows: number;
  actualInflows: number;
  predictedOutflows: number;
  actualOutflows: number;
  accuracyScore: number;
  narrative: string;
  corrections: string[];
  generatedAt: Timestamp;
}

/**
 * Segnala un movimento anomalo che non rientra in un range di spesa previsto.
 */
export interface AnomalyAlert {
  id: string;
  societa: string;
  userId: string;
  category: string;
  amount: number;
  expectedRange: {
    min: number;
    max: number;
  };
  movementId?: string;
  description: string;
  status: 'pending' | 'confirmed' | 'dismissed';
  createdAt: Timestamp;
}
