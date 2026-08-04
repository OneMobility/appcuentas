import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de pre-vuelo CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { message, context } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) {
      console.error("[chat-ai] ERROR: No se encontró GEMINI_API_KEY en los secretos.");
      return new Response(JSON.stringify({ error: 'Configuración incompleta en el servidor.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const prompt = `
      Eres "Oinkash", un asistente financiero amigable, experto y motivador.
      
      CONTEXTO DEL USUARIO:
      - Saldo Disponible: $${context.available || 0}
      - Deudas totales: $${context.debts || 0}
      - Dinero que le deben: $${context.receivable || 0}
      - Próximos pagos vencidos: ${context.pendingPayments || "Ninguno"}
      
      INSTRUCCIONES:
      - Responde de forma concisa y directa (máximo 3 párrafos).
      - Usa emojis de cerdito 🐷 y billetes 💵.
      - Si el usuario tiene deudas altas, anímalo a pagar primero las de mayor interés.
      - Habla siempre en español de México/Latinoamérica.
      
      PREGUNTA DEL USUARIO: "${message}"
    `;

    console.log("[chat-ai] Consultando a Google Gemini...");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[chat-ai] Error de la API de Google:", data);
      throw new Error(data.error?.message || "Error al consultar Gemini");
    }

    if (!data.candidates || data.candidates.length === 0) {
      console.error("[chat-ai] Gemini no devolvió candidatos:", data);
      throw new Error("No se pudo generar una respuesta.");
    }

    const aiResponse = data.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ reply: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("[chat-ai] Error crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})