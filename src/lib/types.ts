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

export type User = {
    name: string;
    email: string;
    role: 'admin' | 'user';
    avatar?: string;
};
