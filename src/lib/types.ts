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
    societa: 'LNC' | 'STG';
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
    company?: 'LNC' | 'STG';
    creationDate?: string;
    lastLogin?: string;
    notificationPreferences?: NotificationPreferences;
};

export type Scadenza = {
  id: string;
  societa: 'LNC' | 'STG';
  anno: number;
  dataScadenza: string;
  dataPagamento?: string | null; // New field for payment date
  descrizione: string;
  categoria: string;
  sottocategoria?: string;
  importoPrevisto: number;
  importoPagato: number;
  stato: 'Pagato' | 'Da pagare' | 'Parziale' | 'Annullato';
  ricorrenza: 'Nessuna' | 'Mensile' | 'Trimestrale' | 'Semestrale' | 'Annuale';
  note?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RiepilogoScadenze = {
    totalePrevisto: number;
    totalePagato: number;
    daPagare: number;
    percentualeCompletamento: number;
};

export type PrevisioneEntrata = {
  id: string;
  societa: 'LNC' | 'STG';
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
  societa: 'LNC' | 'STG';
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

export type DeadlineSuggestion = {
    description: string;
    category: string;
    recurrence: 'Nessuna' | 'Mensile' | 'Trimestrale' | 'Semestrale' | 'Annuale';
    amount: number;
    originalMovementDescription: string;
};

export type CompanyProfile = {
  id: string;
  type: 'persona_giuridica' | 'persona_fisica';
  name: string;
  vatId?: string;
  fiscalCode?: string;
  address?: string;
  email?: string;
  pec?: string;
  phone?: string;
  sdiCode?: string;
  iban?: string;
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
    societa: 'LNC' | 'STG';
};
