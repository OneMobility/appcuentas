export const evaluateExpression = (expression: string): number | null => {
  // Eliminar cualquier carácter que no sea número, operador (+-*/), o punto decimal
  const sanitizedExpression = expression.replace(/[^0-9+\-*/.]/g, '');

  if (!sanitizedExpression) {
    return null;
  }

  try {
    // Usar new Function() es generalmente más seguro que eval() directo para la entrada del usuario,
    // ya que se ejecuta en un ámbito separado y no tiene acceso directo al ámbito global.
    // Sin embargo, sigue siendo potente, por lo que solo se permite aritmética básica.
    const result = new Function('return ' + sanitizedExpression)();
    if (typeof result === 'number' && isFinite(result)) {
      return result;
    }
    return null;
  } catch (e) {
    console.error("Error al evaluar la expresión:", e);
    return null;
  }
};