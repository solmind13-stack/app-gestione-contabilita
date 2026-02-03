import type { LucideIcon } from "lucide-react";

export type Kpi = {
    title: string;
    value: string;
    icon: any; // Ideally should be a specific icon type
    trend?: string;
    trendDirection?: 'up' | 'down';
    subText?: string;
    color: string;
    textColor: string;
};

export type Transaction = {
    id: string;
    type: 'Entrata' | 'Uscita' | 'Scadenza Pagata' | 'Previsione Aggiornata';
    description: string;
    amount: string;
    timestamp: string;
    icon: any;
};

export type Insight = {
    summary: string;
    attentionItems: string[];
    suggestionItems: string[];
};

export type NavItem = {
    href: string;
    icon: any;
    label: string;
};

export type Movimento = {
    id: string;
    societa: string;
    anno: number;
    data: string; // Storing date as string in 'YYYY-MM-DD' format for consistency
    descrizione: string;
    categoria: string;
    sottocategoria: string;
    entrata: number;
    uscita: number;
    iva: number;
    conto?: string;
    operatore?: string;
    metodoPag?: string;
    note?: string;
    createdBy?: string; // UID of user who created it
    inseritoDa?: string; // Display name of user who created/edited it
    createdAt?: string;
    updatedAt?: string;
    linkedTo?: string; // Format: 'collectionName/documentId' e.g., 'deadlines/xyz123'
    status?: 'ok' | 'manual_review';
};

export type Riepilogo = {
    totaleEntrate: number;
    totaleUscite: number;
    saldo: number;
    ivaEntrate: number;
    ivaUscite: number;
    ivaNetta: number;
}

export type UserRole = 'admin' | 'editor' | 'company' | 'company-editor';

export type NotificationPreferences = {
    notifyOnNewMovement?: boolean;
    notifyOnDeadline?: boolean;
}

export type AppUser = {
    uid: string;
    firstName?: string;
    lastName?: string;
    displayName: string;
    email: string;
    photoURL?: string | null;
    role: UserRole;
    company?: string;
    creationDate?: string;
    lastLogin?: string;
    notificationPreferences?: NotificationPreferences;
};

export type Scadenza = {
  id: string;
  societa: string;
  anno: number;
  dataScadenza: string;
  dataPagamento?: string | null;
  descrizione: string;
  categoria: string;
  sottocategoria?: string;
  importoPrevisto: number;
  importoPagato: number;
  stato: 'Pagato' | 'Da pagare' | 'Parziale' | 'Annullato';
  ricorrenza: 'Nessuna' | 'Mensile' | 'Bimestrale' | 'Trimestrale' | 'Quadrimestrale' | 'Semestrale' | 'Annuale' | 'Altro';
  note?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  tipoTassa?: string;
  periodoRiferimento?: string;
  source?: 'manual' | 'ai-suggested';
};


export type RiepilogoScadenze = {
    totalePrevisto: number;
    totalePagato: number;
    daPagare: number;
    percentualeCompletamento: number;
};

export type PrevisioneEntrata = {
  id: string;
  societa: string;
  anno: number;
  mese: string;
  dataPrevista: string;
  dataIncasso?: string | null;
  descrizione: string;
  categoria: string;
  sottocategoria: string;
  importoLordo: number;
  iva: number;
  certezza: 'Certa' | 'Probabile' | 'Incerta';
  probabilita: number; // 0 to 1
  stato: 'Da incassare' | 'Incassato' | 'Parziale' | 'Annullato';
  note?: string;
  importoEffettivo?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RiepilogoPrevisioniEntrate = {
  totaleLordo: number;
  totalePonderato: number;
  totaleIncassato: number;
};

export type PrevisioneUscita = {
  id: string;
  societa: string;
  anno: number;
  mese: string;
  dataScadenza: string;
  dataPagamento?: string | null;
  descrizione: string;
  categoria: string;
  sottocategoria: string;
  importoLordo: number;
  iva: number;
  certezza: 'Certa' | 'Probabile' | 'Incerta';
  probabilita: number; // 0 to 1
  stato: 'Da pagare' | 'Pagato' | 'Parziale' | 'Annullato';
  fonteContratto?: string;
  ricorrenza: 'Nessuna' | 'Mensile' | 'Trimestrale' | 'Semestrale' | 'Annuale' | 'Altro';
  note?: string;
  importoEffettivo?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RiepilogoPrevisioniUscite = {
  totalePrevisto: number;
  totalePonderato: number;
  totaleEffettivo: number;
  daPagare: number;
  percentualePagato: number;
};

export type RecurringExpensePattern = {
    societa: string;
    descrizionePulita: string;
    importoPrevisto: number;
    amountType: 'fixed' | 'variable';
    ricorrenza: 'Mensile' | 'Bimestrale' | 'Trimestrale' | 'Quadrimestrale' | 'Semestrale' | 'Annuale' | 'Altro';
    giornoStimato: number;
    primoMese?: number;
    categoria: string;
    sottocategoria?: string;
    metodoPagamentoTipico?: string;
    tipoTassa?: string;
    ragione: string;
    sourceCandidateId: number;
};

export type DeadlineSuggestion = {
  id: string;
  societa: string;
  descrizionePulita: string;
  importoPrevisto: number;
  amountType: 'fixed' | 'variable';
  ricorrenza: 'Mensile' | 'Bimestrale' | 'Trimestrale' | 'Quadrimestrale' | 'Semestrale' | 'Annuale' | 'Altro';
  giornoStimato: number;
  primoMese?: number;
  categoria: string;
  sottocategoria?: string;
  metodoPagamentoTipico?: string;
  tipoTassa?: string;
  ragione: string;
  sourceMovementIds: string[];
  status: 'pending' | 'accepted' | 'rejected';
  userId: string;
  createdAt: string;
};

export type CompanyProfile = {
  id: string;
  type: 'persona_giuridica' | 'persona_fisica';
  name: string;
  sigla: string;
  vatId?: string;
  fiscalCode?: string;
  street?: string;
  streetNumber?: string;
  city?: string;
  province?: string;
  zip?: string;
  email?: string;
  pec?: string;
  phone?: string;
  sdiCode?: string;
  conti?: string[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CategoryData = {
  [key: string]: string[];
};

export type AppSettings = {
  id: string;
  paymentMethods: string[];
  operators: string[];
  categories: CategoryData;
  createdAt?: string;
  updatedAt?: string;
}

// Used in the AddMovementDialog to populate the dropdown for linking movements
export type LinkableItem = {
    id: string;
    type: 'deadlines' | 'expenseForecasts' | 'incomeForecasts';
    description: string;
    date: string;
    amount: number;
    societa: string;
    category: string;
    subcategory: string;
};

export type TrainingFeedback = {
    id?: string;
    descriptionPattern: string;
    category: string;
    subcategory: string;
    userId: string;
    createdAt: string;
}
