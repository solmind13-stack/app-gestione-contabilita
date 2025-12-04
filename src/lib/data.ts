import type { Kpi, Transaction, Insight } from './types';

export const kpiData: Kpi[] = [
  {
    title: 'Liquidità',
    value: '€25,430.00',
    icon: 'Wallet',
    trend: '+12.5%',
    trendDirection: 'up',
    color: 'bg-green-100 dark:bg-green-900',
    textColor: 'text-green-800 dark:text-green-200'
  },
  {
    title: 'Scadenze (30gg)',
    value: '€2,100.00',
    icon: 'AlertTriangle',
    subText: '3 scadenze entro 7 giorni',
    color: 'bg-orange-100 dark:bg-orange-900',
    textColor: 'text-orange-800 dark:text-orange-200'
  },
  {
    title: 'Entrate Previste (Mese)',
    value: '€15,800.00',
    icon: 'ArrowUp',
    subText: '75% di realizzazione',
    color: 'bg-blue-100 dark:bg-blue-900',
    textColor: 'text-blue-800 dark:text-blue-200'
  },
  {
    title: 'Cash Flow Previsto',
    value: '€39,130.00',
    icon: 'TrendingUp',
    trend: '+5.2%',
    trendDirection: 'up',
    color: 'bg-indigo-100 dark:bg-indigo-900',
    textColor: 'text-indigo-800 dark:text-indigo-200'
  }
];

export const overviewChartData = [
  { month: 'Gen', entrate: 18000, uscite: 12000 },
  { month: 'Feb', entrate: 22000, uscite: 15000 },
  { month: 'Mar', entrate: 25000, uscite: 18000 },
  { month: 'Apr', entrate: 21000, uscite: 16000 },
  { month: 'Mag', entrate: 28000, uscite: 20000 },
  { month: 'Giu', entrate: 32000, uscite: 24000 },
  { month: 'Lug', entrate: 29000, uscite: 21000 },
  { month: 'Ago', entrate: 24000, uscite: 19000 },
  { month: 'Set', entrate: 31000, uscite: 23000 },
  { month: 'Ott', entrate: 35000, uscite: 26000 },
  { month: 'Nov', entrate: 33000, uscite: 25000 },
  { month: 'Dic', entrate: 40000, uscite: 30000 },
];

export const mockAiInsights = {
  summary: 'La liquidità è buona con €25.430 disponibili. Hai 3 scadenze importanti nei prossimi 7 giorni per un totale di €2.100. Le entrate previste coprono ampiamente le uscite con un margine del 15%.',
  attentionItems: [
    'Scadenza pagamento IMU tra 5 giorni per €1.200 non ancora pianificata.',
    'Fattura cliente "Rossi & Co" in ritardo di oltre 20 giorni.',
    'Costo consulenze in aumento del 25% rispetto al mese precedente.',
  ],
  suggestionItems: [
    'Sollecitare incasso fattura cliente "Rossi & Co".',
    'Considerare di anticipare il pagamento del fornitore "Beta SRL" per usufruire di uno sconto del 2%.',
    'Valutare rinegoziazione contratto di manutenzione, costo superiore alla media.',
  ],
};

export const recentTransactions: Transaction[] = [
    {
        id: '1',
        type: 'Entrata',
        description: 'Affitto immobile Via Roma, 10',
        amount: '€1,200.00',
        timestamp: '2 ore fa',
        icon: 'ArrowDown'
    },
    {
        id: '2',
        type: 'Uscita',
        description: 'Pagamento fornitore "Materiali Edili S.p.A."',
        amount: '€-3,500.00',
        timestamp: '8 ore fa',
        icon: 'ArrowUp'
    },
    {
        id: '3',
        type: 'Scadenza Pagata',
        description: 'Pagata rata mutuo BAPR',
        amount: '€-850.00',
        timestamp: 'ieri',
        icon: 'CheckCircle'
    },
    {
        id: '4',
        type: 'Previsione Aggiornata',
        description: 'Nuova entrata prevista "Incentivi GSE"',
        amount: '€5,000.00',
        timestamp: '2 giorni fa',
        icon: 'TrendingUp'
    },
    {
        id: '5',
        type: 'Entrata',
        description: 'Vendita energia - Giugno 2024',
        amount: '€2,345.10',
        timestamp: '2 giorni fa',
        icon: 'ArrowDown'
    }
];

export const user = {
    name: 'Mario Rossi',
    email: 'm.rossi@example.com',
    role: 'admin',
    avatar: 'https://picsum.photos/seed/user-avatar/100/100'
};
