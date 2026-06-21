import { addDays, isBefore, isSameDay, setDate, addMonths, isAfter, parseISO } from "date-fns";

export const getUpcomingPaymentDueDate = (cutOffDay: number, daysToPayAfterCutOff: number, referenceDate: Date = new Date()): Date => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  let relevantCutOffDate = setDate(new Date(today.getFullYear(), today.getMonth()), cutOffDay);
  relevantCutOffDate.setHours(0, 0, 0, 0);

  let potentialPaymentDueDate = addDays(relevantCutOffDate, daysToPayAfterCutOff);
  potentialPaymentDueDate.setHours(0, 0, 0, 0);

  if (isBefore(potentialPaymentDueDate, today) && !isSameDay(potentialPaymentDueDate, today)) {
    relevantCutOffDate = addMonths(relevantCutOffDate, 1);
    relevantCutOffDate.setHours(0, 0, 0, 0);
    potentialPaymentDueDate = addDays(relevantCutOffDate, daysToPayAfterCutOff);
    potentialPaymentDueDate.setHours(0, 0, 0, 0);
  }

  return potentialPaymentDueDate;
};

export const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getRelevantStatementForPayment = (cutOffDay: number, daysToPayAfterCutOff: number, referenceDate: Date = new Date()) => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  let previousCutOff = setDate(new Date(today.getFullYear(), today.getMonth()), cutOffDay);
  previousCutOff.setHours(0, 0, 0, 0);
  
  if (isAfter(previousCutOff, today) || isSameDay(previousCutOff, today)) {
    previousCutOff = addMonths(previousCutOff, -1);
    previousCutOff.setHours(0, 0, 0, 0);
  }

  const paymentDueDateForPreviousCycle = addDays(previousCutOff, daysToPayAfterCutOff);
  paymentDueDateForPreviousCycle.setHours(0, 0, 0, 0);

  if (isBefore(today, paymentDueDateForPreviousCycle) || isSameDay(today, paymentDueDateForPreviousCycle)) {
    return {
      statementEndDate: previousCutOff,
      statementPaymentDueDate: paymentDueDateForPreviousCycle,
    };
  } else {
    let currentCutOff = setDate(new Date(today.getFullYear(), today.getMonth()), cutOffDay);
    currentCutOff.setHours(0, 0, 0, 0);
    if (isAfter(today, currentCutOff)) {
      currentCutOff = addMonths(currentCutOff, 1);
      currentCutOff.setHours(0, 0, 0, 0);
    }
    const statementPaymentDueDate = addDays(currentCutOff, daysToPayAfterCutOff);
    return {
      statementEndDate: currentCutOff,
      statementPaymentDueDate: statementPaymentDueDate,
    };
  }
};

/**
 * Verifica si un pago realizado en 'lastPaymentDate' cubre el estado de cuenta actual.
 * Un pago es válido si se hizo después de la fecha de corte del ciclo que se está cobrando.
 */
export const isPaymentDoneForCurrentStatement = (lastPaymentDate: string | null | undefined, cutOffDay: number, daysToPayAfterCutOff: number): boolean => {
  if (!lastPaymentDate) return false;
  
  const paymentDate = parseISO(lastPaymentDate);
  const statement = getRelevantStatementForPayment(cutOffDay, daysToPayAfterCutOff);
  
  // Si el pago se hizo después de que cerró el estado de cuenta (fecha de corte), se considera pagado.
  return isAfter(paymentDate, statement.statementEndDate) || isSameDay(paymentDate, statement.statementEndDate);
};

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
 * Calcula el periodo de facturación (ciclo de estado de cuenta) para una tarjeta de crédito
 * basado en su día de corte y una fecha de referencia.
 */
export const getStatementPeriod = (cutOffDay: number, referenceDate: Date = new Date()) => {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  
  let year = ref.getFullYear();
  let month = ref.getMonth(); // 0-11
  
  // Si el día de hoy es mayor que el día de corte, el ciclo actual termina en el corte del próximo mes
  let cycleEndMonth = month;
  let cycleEndYear = year;
  if (ref.getDate() > cutOffDay) {
    cycleEndMonth = month + 1;
    if (cycleEndMonth > 11) {
      cycleEndMonth = 0;
      cycleEndYear += 1;
    }
  }
  
  // Fecha de fin: día de corte del mes/año del fin del ciclo
  const end = new Date(cycleEndYear, cycleEndMonth, cutOffDay, 23, 59, 59, 999);
  
  // Fecha de inicio: el día después del corte del mes anterior
  let cycleStartMonth = cycleEndMonth - 1;
  let cycleStartYear = cycleEndYear;
  if (cycleStartMonth < 0) {
    cycleStartMonth = 11;
    cycleStartYear -= 1;
  }
  
  const start = new Date(cycleStartYear, cycleStartMonth, cutOffDay + 1, 0, 0, 0, 0);
  
  return { start, end };
};