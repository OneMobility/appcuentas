import { addDays, isBefore, isSameDay, startOfMonth, endOfMonth, getDate, setDate, addMonths } from "date-fns";

export const getUpcomingPaymentDueDate = (cutOffDay: number, daysToPayAfterCutOff: number, referenceDate: Date = new Date()): Date => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0); // Normalizar today al inicio del día

  // Empezar con la fecha de corte para el mes actual
  let relevantCutOffDate = new Date(today.getFullYear(), today.getMonth(), cutOffDay);
  relevantCutOffDate.setHours(0, 0, 0, 0); // Normalizar

  // Calcular la fecha límite de pago potencial basada en la fecha de corte de este mes
  let potentialPaymentDueDate = addDays(relevantCutOffDate, daysToPayAfterCutOff);
  potentialPaymentDueDate.setHours(0, 0, 0, 0); // Normalizar

  // Si la fecha límite de pago potencial es anterior a hoy (y no es el mismo día),
  // significa que el pago para el ciclo actual ya venció/pasó.
  // En este caso, debemos mostrar la fecha límite de pago para el *siguiente* ciclo.
  if (isBefore(potentialPaymentDueDate, today) && !isSameDay(potentialPaymentDueDate, today)) {
    // Avanzar la fecha de corte al próximo mes
    relevantCutOffDate = new Date(today.getFullYear(), today.getMonth() + 1, cutOffDay);
    relevantCutOffDate.setHours(0, 0, 0, 0); // Normalizar
    potentialPaymentDueDate = addDays(relevantCutOffDate, daysToPayAfterCutOff);
    potentialPaymentDueDate.setHours(0, 0, 0, 0); // Normalizar
  }

  return potentialPaymentDueDate;
};

export const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calcula las fechas de inicio y fin del ciclo de facturación actual y la fecha límite de pago.
 * Un ciclo de facturación va desde el día después de la fecha de corte del mes anterior
 * hasta la fecha de corte del mes actual (inclusive).
 *
 * @param cutOffDay El día del mes en que la tarjeta tiene su fecha de corte (ej. 15, 30).
 * @param daysToPayAfterCutOff El número de días después de la fecha de corte para la fecha límite de pago.
 * @param referenceDate La fecha de referencia para determinar el ciclo actual (por defecto, hoy).
 * @returns Un objeto con cycleStartDate, cycleEndDate y paymentDueDate.
 */
export const getBillingCycleDates = (cutOffDay: number, daysToPayAfterCutOff: number, referenceDate: Date = new Date()) => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  let currentCutOffDate = setDate(new Date(today.getFullYear(), today.getMonth()), cutOffDay);
  currentCutOffDate.setHours(0, 0, 0, 0);

  let previousCutOffDate: Date;

  // Si hoy es el día de corte o después del día de corte, el ciclo actual termina en currentCutOffDate.
  // El ciclo empezó el día después del corte del mes anterior.
  if (getDate(today) >= cutOffDay) {
    previousCutOffDate = addMonths(currentCutOffDate, -1);
  } else {
    // Si hoy es antes del día de corte, el ciclo actual terminó el mes pasado.
    // El ciclo actual es el que termina en currentCutOffDate del mes pasado.
    currentCutOffDate = addMonths(currentCutOffDate, -1);
    previousCutOffDate = addMonths(currentCutOffDate, -1);
  }

  const cycleStartDate = addDays(previousCutOffDate, 1);
  const cycleEndDate = currentCutOffDate;
  const paymentDueDate = addDays(cycleEndDate, daysToPayAfterCutOff);

  return { cycleStartDate, cycleEndDate, paymentDueDate };
};

/**
 * Calcula la fecha de corte más próxima a partir de una fecha de referencia.
 * Si la fecha de referencia es anterior o igual al día de corte, devuelve la fecha de corte de ese mes.
 * Si la fecha de referencia es posterior al día de corte, devuelve la fecha de corte del siguiente mes.
 * @param cutOffDay El día del mes en que la tarjeta tiene su fecha de corte.
 * @param referenceDate La fecha de referencia (por defecto, hoy).
 * @returns La fecha de corte más próxima.
 */
export const getUpcomingCutOffDate = (cutOffDay: number, referenceDate: Date = new Date()): Date => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  let upcomingCutOff = setDate(new Date(today.getFullYear(), today.getMonth()), cutOffDay);
  upcomingCutOff.setHours(0, 0, 0, 0);

  if (isBefore(upcomingCutOff, today) && !isSameDay(upcomingCutOff, today)) {
    upcomingCutOff = addMonths(upcomingCutOff, 1);
  }
  return upcomingCutOff;
};