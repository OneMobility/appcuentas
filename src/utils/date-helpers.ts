import { addDays, isBefore, isSameDay, startOfMonth, endOfMonth, getDate, setDate, addMonths, isAfter } from "date-fns";

export const getUpcomingPaymentDueDate = (cutOffDay: number, daysToPayAfterCutOff: number, referenceDate: Date = new Date()): Date => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0); // Normalizar today al inicio del día

  // Empezar con la fecha de corte para el mes actual
  let relevantCutOffDate = setDate(new Date(today.getFullYear(), today.getMonth()), cutOffDay);
  relevantCutOffDate.setHours(0, 0, 0, 0); // Normalizar

  // Calcular la fecha límite de pago potencial basada en la fecha de corte de este mes
  let potentialPaymentDueDate = addDays(relevantCutOffDate, daysToPayAfterCutOff);
  potentialPaymentDueDate.setHours(0, 0, 0, 0); // Normalizar

  // Si la fecha límite de pago potencial es anterior a hoy (y no es el mismo día),
  // significa que el pago para el ciclo actual ya venció/pasó.
  // En este caso, debemos mostrar la fecha límite de pago para el *siguiente* ciclo.
  if (isBefore(potentialPaymentDueDate, today) && !isSameDay(potentialPaymentDueDate, today)) {
    // Avanzar la fecha de corte al próximo mes
    relevantCutOffDate = addMonths(relevantCutOffDate, 1);
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
 * Calcula las fechas de inicio y fin del ciclo de facturación *cuya deuda está actualmente pendiente de pago*.
 *
 * @param cutOffDay El día del mes en que la tarjeta tiene su fecha de corte (ej. 15, 30).
 * @param daysToPayAfterCutOff El número de días después de la fecha de corte para la fecha límite de pago.
 * @param referenceDate La fecha de referencia para determinar el ciclo relevante (por defecto, hoy).
 * @returns Un objeto con cycleStartDate, cycleEndDate y paymentDueDate para el ciclo cuyo pago está pendiente.
 */
export const getBillingCycleDates = (cutOffDay: number, daysToPayAfterCutOff: number, referenceDate: Date = new Date()) => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  let cycleEndDate: Date;
  let cycleStartDate: Date;

  // Determinar la fecha de corte del mes actual (basado en referenceDate)
  let currentMonthCutOff = setDate(new Date(today.getFullYear(), today.getMonth()), cutOffDay);
  currentMonthCutOff.setHours(0, 0, 0, 0);

  // Si hoy es anterior o igual al día de corte de este mes,
  // el ciclo cuyo pago está pendiente es el que terminó el mes pasado.
  if (isBefore(today, currentMonthCutOff) || isSameDay(today, currentMonthCutOff)) {
    cycleEndDate = addMonths(currentMonthCutOff, -1); // Fin del ciclo es el corte del mes anterior
  } else {
    // Si hoy es posterior al día de corte de este mes,
    // el ciclo cuyo pago está pendiente es el que terminó este mes.
    cycleEndDate = currentMonthCutOff; // Fin del ciclo es el corte de este mes
  }

  cycleStartDate = addDays(addMonths(cycleEndDate, -1), 1); // Inicia el día después del corte del mes anterior al ciclo
  cycleStartDate.setHours(0, 0, 0, 0); // Normalizar

  const paymentDueDate = addDays(cycleEndDate, daysToPayAfterCutOff);
  paymentDueDate.setHours(0, 0, 0, 0);

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

/**
 * Calcula la fecha de la primera cuota para una transacción a meses,
 * basándose en la lógica de que si la compra es antes o en la fecha de corte,
 * la primera cuota se difiere al siguiente ciclo de pago.
 *
 * @param transactionDate La fecha en que se realizó la transacción.
 * @param cutOffDay El día del mes en que la tarjeta tiene su fecha de corte.
 * @param daysToPayAfterCutOff El número de días después de la fecha de corte para la fecha límite de pago.
 * @returns La fecha de la primera cuota.
 */
export const getInstallmentFirstPaymentDueDate = (transactionDate: Date, cutOffDay: number, daysToPayAfterCutOff: number): Date => {
  const txDate = new Date(transactionDate);
  txDate.setHours(0, 0, 0, 0);

  // Determinar la fecha de corte del mes de la transacción
  let transactionMonthCutOff = setDate(new Date(txDate.getFullYear(), txDate.getMonth()), cutOffDay);
  transactionMonthCutOff.setHours(0, 0, 0, 0);

  let cycleEndDateForTransaction: Date;

  // Si la transacción se hizo en o antes del día de corte, el ciclo cierra ese mes.
  // Si se hizo después del día de corte, el ciclo cierra el mes siguiente.
  if (isBefore(txDate, transactionMonthCutOff) || isSameDay(txDate, transactionMonthCutOff)) {
    cycleEndDateForTransaction = transactionMonthCutOff;
  } else {
    cycleEndDateForTransaction = addMonths(transactionMonthCutOff, 1);
  }

  const firstPaymentDueDate = addDays(cycleEndDateForTransaction, daysToPayAfterCutOff);
  firstPaymentDueDate.setHours(0, 0, 0, 0);

  return firstPaymentDueDate;
};