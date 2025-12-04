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
