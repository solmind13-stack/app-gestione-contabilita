export const YEARS = ['Tutti', 2025, 2024, 2023];
export const COMPANIES = [
  { value: 'all', label: 'Tutte' },
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
    subItems: [
      { href: '/previsioni/entrate', label: 'Entrate' },
      { href: '/previsioni/uscite', label: 'Uscite' },
    ]
  },
  { href: '/report', icon: 'FilePieChart', label: 'Report' },
  { href: '/assistente-ai', icon: 'Sparkles', label: 'Assistente AI' },
];

export const ADMIN_NAV_ITEMS = [
  { href: '/impostazioni', icon: 'Settings', label: 'Impostazioni' },
];
