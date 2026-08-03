"use client";

const BUCKET_BASE_URL = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Iconos";

export const getBankLogoUrl = (bankName: string, isDarkCard: boolean): string | null => {
  if (!bankName) return null;
  const name = bankName.toLowerCase().trim();

  let baseName = "";

  if (name.includes("bbva")) {
    baseName = "BBVA";
  } else if (name.includes("nu") || name.includes("nubank")) {
    baseName = "Nu";
  } else if (name.includes("stori")) {
    baseName = "Stori";
  } else if (name.includes("mercado") || name.includes("pago")) {
    baseName = "Mercado Pago";
  } else if (name.includes("didi")) {
    baseName = "DiDi";
  } else if (name.includes("plata")) {
    baseName = "Plata";
  } else if (name.includes("santander")) {
    baseName = "Santander";
  } else if (name.includes("banorte")) {
    baseName = "Banorte";
  } else if (name.includes("citibanamex") || name.includes("banamex")) {
    baseName = "Citibanamex";
  } else if (name.includes("hsbc")) {
    baseName = "HSBC";
  } else if (name.includes("scotiabank")) {
    baseName = "Scotiabank";
  } else if (name.includes("azteca")) {
    baseName = "Banco Azteca";
  } else if (name.includes("hey")) {
    baseName = "Hey Banco";
  } else if (name.includes("rappi")) {
    baseName = "Rappi";
  } else {
    // Si no coincide con ninguno conocido, intentamos usar el nombre tal cual
    baseName = bankName.trim();
  }

  // Si la tarjeta es oscura (isDarkCard === true), usamos la versión "Blanco"
  // Si la tarjeta es clara (isDarkCard === false), usamos la versión "Negro"
  const variant = isDarkCard ? "Blanco" : "Negro";
  return `${BUCKET_BASE_URL}/${encodeURIComponent(`${baseName} ${variant}.png`)}`;
};

export const getFallbackBankLogoUrl = (bankName: string): string | null => {
  if (!bankName) return null;
  const name = bankName.toLowerCase().trim();

  let baseName = "";

  if (name.includes("bbva")) {
    baseName = "BBVA";
  } else if (name.includes("nu") || name.includes("nubank")) {
    baseName = "Nu";
  } else if (name.includes("stori")) {
    baseName = "Stori";
  } else if (name.includes("mercado") || name.includes("pago")) {
    baseName = "Mercado Pago";
  } else if (name.includes("didi")) {
    baseName = "DiDi";
  } else if (name.includes("plata")) {
    baseName = "Plata";
  } else if (name.includes("santander")) {
    baseName = "Santander";
  } else if (name.includes("banorte")) {
    baseName = "Banorte";
  } else if (name.includes("citibanamex") || name.includes("banamex")) {
    baseName = "Citibanamex";
  } else if (name.includes("hsbc")) {
    baseName = "HSBC";
  } else if (name.includes("scotiabank")) {
    baseName = "Scotiabank";
  } else if (name.includes("azteca")) {
    baseName = "Banco Azteca";
  } else if (name.includes("hey")) {
    baseName = "Hey Banco";
  } else if (name.includes("rappi")) {
    baseName = "Rappi";
  } else {
    baseName = bankName.trim();
  }

  return `${BUCKET_BASE_URL}/${encodeURIComponent(`${baseName}.png`)}`;
};