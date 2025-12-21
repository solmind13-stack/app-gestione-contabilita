export const YEARS = ['Tutti', 2025, 2024, 2023];
export const COMPANIES = [
  { value: 'Tutte', label: 'Tutte' },
  { value: 'LNC', label: 'LNC' },
  { value: 'STG', label: 'STG' },
];

export const NAV_ITEMS = [
  { href: '/dashboard', icon: 'LayoutGrid', label: 'Dashboard' },
  { href: '/movimenti', icon: 'ArrowRightLeft', label: 'Movimenti' },
  { href: '/scadenze', icon: 'CalendarDays', label: 'Scadenze' },
  { 
    href: '/previsioni', 
    icon: 'TrendingUp', 
    label: 'Previsioni',
  },
  { href: '/report', icon: 'FilePieChart', label: 'Report' },
  { href: '/assistente-ai', icon: 'Sparkles', label: 'Assistente AI' },
];

export const ADMIN_NAV_ITEMS = [
  { href: '/impostazioni', icon: 'Settings', label: 'Impostazioni' },
];

export const CATEGORIE = {
  'Immobiliare': ['Affitti', 'Depositi Cauzionali', 'Recupero Spese', 'Immobili'],
  'Energia': ['Quote CEF', 'Pratiche Contributo', 'Incentivi GSE', 'Vendita Energia'],
  'Fornitori': ['Materiali', 'Lavori/Manutenzione', 'Impianti', 'Servizi'],
  'Gestione Immobili': ['Spese Condominiali', 'Manutenzione', 'Ristrutturazione', 'Utenze'],
  'Gestione Generale': ['Spese Bancarie', 'Commercialista', 'Telefonia', 'Altre Spese', 'Gestione'],
  'Tasse': ['IVA Trimestrale', 'IMU', 'IRES', 'IRAP', 'F24 Vari', 'Bolli', 'Cartelle Esattoriali'],
  'Finanziamenti': ['Rate Mutuo', 'Rate Prestito', 'Rimborso'],
  'Movimenti Interni': ['Giroconto', 'Trasferimento'],
  'Da categorizzare': ['Da categorizzare']
};

export const IVA_PERCENTAGES = [0.22, 0.10, 0.04, 0.00];

export const METODI_PAGAMENTO = ['Bonifico', 'Contanti', 'Assegno', 'Carta di Credito', 'Addebito Diretto (SDD)', 'Altro'];

export const CATEGORIE_SCADENZE = ['IVA Trimestrale', 'IMU', 'IRES', 'IRAP', 'F24 Vari', 'Bolli', 'Cartelle Esattoriali', 'Rate Mutuo', 'Rate Prestito', 'Affitti Passivi', 'Utenze', 'Stipendi', 'Fornitori'];
export const RICORRENZE = ['Nessuna', 'Mensile', 'Trimestrale', 'Semestrale', 'Annuale'];
export const STATI_SCADENZE = ['Da pagare', 'Pagato', 'Parziale'];

export const CATEGORIE_USCITE = {
    'Fornitori': ['Materiali', 'Lavori/Manutenzione', 'Impianti', 'Servizi'],
    'Gestione Immobili': ['Spese Condominiali', 'Manutenzione', 'Ristrutturazione', 'Utenze'],
    'Gestione Generale': ['Spese Bancarie', 'Commercialista', 'Telefonia', 'Altre Spese', 'Gestione'],
    'Tasse': ['IVA Trimestrale', 'IMU', 'IRES', 'IRAP', 'F24 Vari', 'Bolli', 'Cartelle Esattoriali'],
    'Finanziamenti': ['Rate Mutuo', 'Rate Prestito', 'Rimborso'],
};
export const CERTEZZA_USCITE = ['Certa', 'Probabile', 'Incerta'];
export const STATI_USCITE = ['Da pagare', 'Pagato', 'Parziale', 'Annullato'];
export const RICORRENZE_USCITE = ['Nessuna', 'Mensile', 'Trimestrale', 'Semestrale', 'Annuale', 'Altro'];
