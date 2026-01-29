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
 * Parses a 'YYYY-MM-DD' string into a Date object, avoiding timezone issues.
 * new Date('YYYY-MM-DD') can result in the previous day depending on the timezone.
 * This function ensures the date is parsed as local time.
 */
export function parseDate(dateString: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    // throw new Error(`Invalid date format: "${dateString}". Expected "YYYY-MM-DD".`);
    // Return a default invalid date that can be checked with isNaN(date.getTime())
    return new Date('invalid');
  }
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
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
