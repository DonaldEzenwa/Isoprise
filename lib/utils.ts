import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function currentScholarshipYears(now = new Date()) {
  const CURRENT_YEAR = now.getFullYear();
  const NEXT_YEAR = CURRENT_YEAR + 1;
  return { CURRENT_YEAR, NEXT_YEAR };
}

export function safeText(value: unknown, max = 10000): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}
