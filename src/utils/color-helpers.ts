export const getContrastColor = (hexColor: string): string => {
  if (!hexColor || hexColor.length < 6) return "#FFFFFF";
  
  // Eliminar el '#' si está presente
  const hex = hexColor.replace("#", "");
  
  // Parsear los componentes RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "#FFFFFF";
  
  // Calcular la luminosidad usando la fórmula YIQ
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Si la luminosidad es alta (color claro), usar texto oscuro. De lo contrario, usar texto blanco.
  return yiq >= 160 ? "#0F172A" : "#FFFFFF";
};