import { addDays, isBefore, isSameDay, setDate, addMonths, isAfter } from "date-fns";

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
 * Calculates the dates for the billing cycle whose *statement is currently due for payment*.
 * This is the cycle for which a statement has been generated, and its payment is either due soon, due today, or recently became overdue.
 *
 * @param cutOffDay The day of the month the card's billing cycle cuts off (e.g., 15).
 * @param daysToPayAfterCutOff The number of days after the cut-off date for the payment due date (e.g., 20).
 * @param referenceDate The date to determine the relevant statement (defaults to today).
 * @returns An object containing:
 *   - `statementStartDate`: The start date of the billing cycle for the statement.
 *   - `statementEndDate`: The end date (cut-off date) of the billing cycle for the statement.
 *   - `statementPaymentDueDate`: The payment due date for this statement.
 */
export const getRelevantStatementForPayment = (cutOffDay: number, daysToPayAfterCutOff: number, referenceDate: Date = new Date()) => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  // 1. Determine the cut-off date for the *previous month* relative to today.
  // This is the cut-off that would have generated the statement whose payment is currently due or was just due.
  let previousCutOff = setDate(new Date(today.getFullYear(), today.getMonth()), cutOffDay);
  previousCutOff.setHours(0, 0, 0, 0);
  if (isAfter(previousCutOff, today) || isSameDay(previousCutOff, today)) {
    // If current month's cut-off is today or in the future, the *previous* cut-off is the one that generated the statement.
    previousCutOff = addMonths(previousCutOff, -1);
    previousCutOff.setHours(0, 0, 0, 0);
  }

  // The payment due date for the cycle that ended at `previousCutOff`
  const paymentDueDateForPreviousCycle = addDays(previousCutOff, daysToPayAfterCutOff);
  paymentDueDateForPreviousCycle.setHours(0, 0, 0, 0);

  // If today is before or on the payment due date for the *previous* cycle,
  // then the relevant statement for payment is the one that closed at `previousCutOff`.
  if (isBefore(today, paymentDueDateForPreviousCycle) || isSameDay(today, paymentDueDateForPreviousCycle)) {
    const statementStartDate = addDays(addMonths(previousCutOff, -1), 1);
    statementStartDate.setHours(0, 0, 0, 0);
    return {
      statementStartDate: statementStartDate,
      statementEndDate: previousCutOff,
      statementPaymentDueDate: paymentDueDateForPreviousCycle,
    };
  } else {
    // The payment due date for the previous cycle has passed.
    // The relevant statement for payment is now the one that will close at the *current month's* cut-off.
    // This means we are in the period where the *next* statement is being generated.
    let currentCutOff = setDate(new Date(today.getFullYear(), today.getMonth()), cutOffDay);
    currentCutOff.setHours(0, 0, 0, 0);
    // If today is after current month's cut-off, the statement will close next month.
    if (isAfter(today, currentCutOff)) {
      currentCutOff = addMonths(currentCutOff, 1);
      currentCutOff.setHours(0, 0, 0, 0);
    }
    const statementStartDate = addDays(addMonths(currentCutOff, -1), 1);
    statementStartDate.setHours(0, 0, 0, 0);
    const statementPaymentDueDate = addDays(currentCutOff, daysToPayAfterCutOff);
    statementPaymentDueDate.setHours(0, 0, 0, 0);
    return {
      statementStartDate: statementStartDate,
      statementEndDate: currentCutOff,
      statementPaymentDueDate: statementPaymentDueDate,
    };
  }
};

/**
 * Calculates the dates for the *currently active* billing cycle (where new charges are accumulating).
 *
 * @param cutOffDay The day of the month the card's billing cycle cuts off.
 * @param referenceDate The date to determine the current cycle (defaults to today).
 * @returns An object containing:
 *   - `currentCycleStartDate`: The start date of the current billing cycle.
 *   - `currentCycleEndDate`: The end date (cut-off date) of the current billing cycle.
 */
export const getCurrentActiveBillingCycle = (cutOffDay: number, referenceDate: Date = new Date()) => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  let currentCycleEndDate = setDate(new Date(today.getFullYear(), today.getMonth()), cutOffDay);
  currentCycleEndDate.setHours(0, 0, 0, 0);

  // If today is after the current month's cut-off, the active cycle ends next month.
  if (isAfter(today, currentCycleEndDate)) {
    currentCycleEndDate = addMonths(currentCycleEndDate, 1);
    currentCycleEndDate.setHours(0, 0, 0, 0);
  }

  const currentCycleStartDate = addDays(addMonths(currentCycleEndDate, -1), 1);
  currentCycleStartDate.setHours(0, 0, 0, 0);

  return {
    currentCycleStartDate: currentCycleStartDate,
    currentCycleEndDate: currentCycleEndDate,
  };
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