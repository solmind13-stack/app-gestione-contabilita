// src/lib/movimenti-data.ts
import type { Movimento, Riepilogo } from './types';

export const movimentiData: Movimento[] = [
  {
    id: '1',
    anno: 2025,
    data: '05/07/2025',
    descrizione: 'Affitto Eris',
    categoria: 'Immobiliare',
    sottocategoria: 'Affitti',
    entrata: 2008.80,
    uscita: 0,
    iva: 0.22,
    note: 'Fattura 7/25'
  },
  {
    id: '1b',
    anno: 2025,
    data: '05/07/2025', // Duplicated from image for demo
    descrizione: 'Affitto Eris',
    categoria: 'Immobiliare',
    sottocategoria: 'Affitti',
    entrata: 2008.80,
    uscita: 0,
    iva: 0.22,
    note: 'Fattura 8/25'
  },
  {
    id: '2',
    anno: 2025,
    data: '07/01/2025',
    descrizione: 'IMU 2024',
    categoria: 'Tasse',
    sottocategoria: 'IMU',
    entrata: 0,
    uscita: 86.00,
    iva: 0,
    note: 'Pagamento effettuato da Nuccio junior'
  },
  {
    id: '3',
    anno: 2025,
    data: '07/01/2025',
    descrizione: 'imu 2024',
    categoria: 'Tasse',
    sottocategoria: 'IMU',
    entrata: 0,
    uscita: 121.00,
    iva: 0,
    note: 'Pagamento effettuato da Nuccio Senior da'
  },
    {
    id: '4',
    anno: 2025,
    data: '07/01/2025',
    descrizione: 'IMU 2024 case mare',
    categoria: 'Tasse',
    sottocategoria: 'IMU',
    entrata: 0,
    uscita: 807.00,
    iva: 0,
    note: 'Pagamento effettuato da Nuccio junior'
  },
  {
    id: '5',
    anno: 2025,
    data: '07/01/2025',
    descrizione: 'IMU botteghe',
    categoria: 'Tasse',
    sottocategoria: 'IMU',
    entrata: 0,
    uscita: 461.00,
    iva: 0,
    note: 'Pagamento effettuato da Nuccio junior su'
  },
  {
    id: '5b',
    anno: 2025,
    data: '29/07/2025',
    descrizione: 'IMU terreno b.zacco',
    categoria: 'Tasse',
    sottocategoria: 'IMU',
    entrata: 0,
    uscita: 2.00,
    iva: 0,
    note: 'Pagam effettuato da Nuccio senior su bon'
  },
  {
    id: '6',
    anno: 2025,
    data: '16/07/2025',
    descrizione: 'Taglio erba B.zacco',
    categoria: 'Gestione Immobili',
    sottocategoria: 'Manutenzione',
    entrata: 0,
    uscita: 400.00,
    iva: 0,
    note: 'Prelievo a sportello'
  },
    {
    id: '7',
    anno: 2025,
    data: '16/07/2025',
    descrizione: 'Rimanenza contante',
    categoria: 'Movimenti Interni',
    sottocategoria: 'Giroconto',
    entrata: 150.00,
    uscita: 0,
    iva: 0,
    note: 'versamento a sportello'
  },
  {
    id: '8',
    anno: 2025,
    data: '11/09/2025',
    descrizione: 'Affitto Eris',
    categoria: 'Immobiliare',
    sottocategoria: 'Affitti',
    entrata: 2008.80,
    uscita: 0,
    iva: 0.22,
    note: 'Fattura 9/25'
  },
  {
    id: '9',
    anno: 2025,
    data: '04/11/2025',
    descrizione: 'Affitto ERIS',
    categoria: 'Immobiliare',
    sottocategoria: 'Affitti',
    entrata: 2008.80,
    uscita: 0,
    iva: 0.22,
    note: 'Fattura 10/25'
  },
   {
    id: '10',
    anno: 2025,
    data: '04/11/2025',
    descrizione: 'Affitto ERIS',
    categoria: 'Immobiliare',
    sottocategoria: 'Affitti',
    entrata: 2008.80,
    uscita: 0,
    iva: 0.22,
    note: 'Fattura 11/25'
  },
];

export const riepilogoMovimenti: Riepilogo = {
    totaleEntrate: 10194.00,
    totaleUscite: 1877.00,
    saldo: 8317.00,
    ivaEntrate: 1811.21,
    ivaUscite: 0.00,
    ivaNetta: 1811.21
};
