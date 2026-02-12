import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format as formatFns } from 'date-fns';
import { it } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
  try {
    const dateObj = typeof date === 'string' ? parseDate(date) : date;
    return formatFns(dateObj, formatStr, { locale: it });
  } catch (e) {
    console.warn(`Invalid date provided to formatDate: ${date}`);
    return "Data non valida";
  }
}

/**
 * Parses a 'YYYY-MM-DD' string or a Date object into a local Date object.
 * It's robust against timezone issues that `new Date('YYYY-MM-DD')` can cause.
 */
export function parseDate(date: string | Date): Date {
  if (date instanceof Date) {
    return date;
  }
  if (typeof date === 'string') {
    // Attempt to handle ISO 8601 with or without time
     if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(date)) {
        const [datePart] = date.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        return new Date(year, month - 1, day);
     }
     // Handle DD/MM/YYYY
     if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
        const [day, month, year] = date.split('/').map(Number);
        return new Date(year, month - 1, day);
     }
  }
  // If format is not recognized or input is not a string/date, return an invalid date
  // which can be checked with isNaN(date.getTime())
  return new Date('invalid');
}


export function maskAccountNumber(accountNumber?: string): string {
  if (!accountNumber) {
    return '';
  }
  if (accountNumber.length <= 3) {
    return '***';
  }
  const lastThree = accountNumber.slice(-3);
  return `${'*'.repeat(accountNumber.length - 3)}${lastThree}`;
}
