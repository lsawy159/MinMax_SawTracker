import { clsx, ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { differenceInDays } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * @deprecated use @/utils/statusHelpers.calculateDaysRemaining instead
 */
export const calculateDaysRemaining = (date: string): number => {
  return differenceInDays(new Date(date), new Date())
}

/**
 * @deprecated use @/utils/statusHelpers.getStatusColor instead
 */
export const getStatusColor = (days: number) => {
  if (days < 0) return 'text-red-600 bg-red-50 border-red-200'
  if (days <= 30) return 'text-orange-600 bg-orange-50 border-orange-200'
  return 'text-green-600 bg-green-50 border-green-200'
}
