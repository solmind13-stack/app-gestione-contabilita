export const YEARS = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() + 5 - i); // from current year + 5 to 10 years back

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

export const IVA_PERCENTAGES = [
    { label: '22%', value: 0.22 },
    { label: '10%', value: 0.10 },
    { label: '4%', value: 0.04 },
    { label: '0%', value: 0.00 },
];

export const METODI_PAGAMENTO = ['Bonifico', 'Contanti', 'Assegno', 'Carta di Credito', 'Addebito Diretto (SDD)', 'Altro'];

export const RICORRENZE = ['Nessuna', 'Mensile', 'Trimestrale', 'Semestrale', 'Annuale'];
export const STATI_SCADENZE = ['Da pagare', 'Pagato', 'Parziale'];

// Previsioni Entrate
export const CATEGORIE_ENTRATE = {
    'Immobiliare': ['Affitti', 'Vendita Immobili'],
    'Energia': ['Quote CEF', 'Pratiche Contributo', 'Incentivi GSE', 'Vendita Energia'],
    'Finanziamenti': ['Rimborso Prestito Soci'],
    'Altro': ['Altro'],
};
export const STATI_ENTRATE = ['Da incassare', 'Incassato', 'Parziale', 'Annullato'];


// Previsioni Uscite
export const CATEGORIE_USCITE = {
    'Fornitori': ['Materiali', 'Lavori/Manutenzione', 'Impianti', 'Servizi'],
    'Gestione Immobili': ['Spese Condominiali', 'Manutenzione', 'Ristrutturazione', 'Utenze'],
    'Gestione Generale': ['Spese Bancarie', 'Commercialista', 'Telefonia', 'Altre Spese', 'Gestione'],
    'Tasse': ['IVA Trimestrale', 'IMU', 'IRES', 'IRAP', 'F24 Vari', 'Bolli', 'Cartelle Esattoriali'],
    'Finanziamenti': ['Rate Mutuo', 'Rate Prestito', 'Rimborso'],
};
export const STATI_USCITE = ['Da pagare', 'Pagato', 'Parziale', 'Annullato'];
export const RICORRENZE_USCITE = ['Nessuna', 'Mensile', 'Trimestrale', 'Semestrale', 'Annuale', 'Altro'];

// Comuni
export const CERTEZZA_LIVELLI: { [key: string]: number } = {
    'Certa': 1.0,
    'Probabile': 0.9,
    'Incerta': 0.5,
};
