import { addDays, isBefore, isSameDay } from "date-fns";

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