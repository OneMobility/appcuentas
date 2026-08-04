import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { message, context } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) {
      console.error("[chat-ai] GEMINI_API_KEY no encontrada.");
      return new Response(JSON.stringify({ error: 'Configuración de IA incompleta.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Intentamos con v1beta y el nombre base del modelo
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    console.log("[chat-ai] Invocando Gemini 1.5 Flash...");

    const prompt = `
      Eres "Oinkash", un asistente financiero experto, divertido y muy motivador.
      
      CONTEXTO DEL USUARIO:
      - Disponible (Efectivo + Débito): $${context.available || 0}
      - Deudas (Crédito + Acreedores): $${context.debts || 0}
      - Por cobrar (Deudores): $${context.receivable || 0}
      
      INSTRUCCIONES:
      - Responde en español de México/Latinoamérica.
      - Sé muy breve y directo.
      - Usa emojis de cerdito 🐷 y dinero 💵.
      - Si el usuario tiene mucha deuda, dale un consejo de ahorro.
      - Si tiene mucho por cobrar, anímalo a usar la función de WhatsApp de Oinkash.
      
      PREGUNTA DEL USUARIO: "${message}"
    `;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 400,
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[chat-ai] Error de Google:", data);
      return new Response(JSON.stringify({ 
        error: `Error de API (${response.status}): ${data.error?.message || 'Falla en el modelo'}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "¡Oink! Me distraje con una bellota. ¿Puedes repetir eso? 🐷";

    return new Response(JSON.stringify({ reply: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("[chat-ai] Error crítico:", error);
    return new Response(JSON.stringify({ error: "Oinkash se tropezó: " + error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
})