"use client";

// Guardar en memoria la última tasa para evitar llamadas repetitivas innecesarias
let cachedRate: number | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hora de caché

export const fetchUsdToMxnRate = async (): Promise<number> => {
  const now = Date.now();
  if (cachedRate && now - lastFetchTime < CACHE_DURATION) {
    return cachedRate;
  }

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!response.ok) throw new Error("Error en la respuesta de la API");
    const data = await response.json();
    const rate = data.rates?.MXN;
    if (rate && typeof rate === "number") {
      cachedRate = rate;
      lastFetchTime = now;
      return rate;
    }
    throw new Error("Tasa MXN no encontrada");
  } catch (error) {
    console.warn("No se pudo obtener la tasa de cambio en vivo, usando fallback de 20.00 MXN:", error);
    return cachedRate || 20.00; // Tasa por defecto típica si falla el internet o API
  }
};

export const convertUsdToMxn = async (usdAmount: number): Promise<number> => {
  const rate = await fetchUsdToMxnRate();
  return usdAmount * rate;
};