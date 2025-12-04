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
    subItems?: { href: string; label: string }[];
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
};

export type Riepilogo = {
    totaleEntrate: number;
    totaleUscite: number;
    saldo: number;
    ivaEntrate: number;
    ivaUscite: number;
    ivaNetta: number;
}

export type UserRole = 'admin' | 'editor' | 'viewer';

export type User = {
    name: string;
    email: string;
    role: UserRole;
    avatar?: string;
};

export type Scadenza = {
  id: string;
  societa: 'LNC' | 'STG';
  anno: number;
  dataScadenza: string;
  descrizione: string;
  categoria: string;
  importoPrevisto: number;
  importoPagato: number;
  stato: 'Pagato' | 'Da pagare' | 'Parziale';
  ricorrenza: 'Nessuna' | 'Mensile' | 'Trimestrale' | 'Semestrale' | 'Annuale';
  note?: string;
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
  descrizione: string;
  categoria: string;
  sottocategoria: string;
  importoLordo: number;
  iva: number;
  certezza: 'Certa' | 'Probabile' | 'Incerta';
  probabilita: number; // 0 to 1
  stato: 'Da incassare' | 'Incassato' | 'Parziale' | 'Annullato';
  note?: string;
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
  descrizione: string;
  categoria: string;
  sottocategoria: string;
  importoPrevisto: number;
  certezza: 'Certa' | 'Probabile' | 'Incerta';
  probabilita: number; // 0 to 1
  stato: 'Da pagare' | 'Pagato' | 'Parziale' | 'Annullato';
  fonteContratto?: string;
  ricorrenza?: 'Nessuna' | 'Mensile' | 'Annuale' | 'Trimestrale';
  note?: string;
  importoEffettivo?: number;
};

export type RiepilogoPrevisioniUscite = {
  totalePrevisto: number;
  totalePonderato: number;
  totaleEffettivo: number;
  daPagare: number;
  percentualePagato: number;
};
