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
      console.error("[chat-ai] GEMINI_API_KEY not found in environment.");
      return new Response(JSON.stringify({ error: 'Configuración de servidor incompleta (API Key).' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // Cambiamos a v1beta para asegurar compatibilidad con gemini-1.5-flash
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `
      Eres "Oinkash", un asistente financiero experto, divertido y muy motivador.
      
      DATOS DEL USUARIO:
      - Disponible: $${context.available || 0}
      - Deudas: $${context.debts || 0}
      - Por cobrar: $${context.receivable || 0}
      
      TU MISIÓN:
      - Responde en español (México/Latinoamérica).
      - Sé muy breve (máximo 3 párrafos).
      - Usa emojis de cerdito 🐷 y dinero 💵.
      - Da consejos prácticos basados en los datos financieros del usuario.
      
      PREGUNTA: "${message}"
    `;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[chat-ai] Google API Error:", data);
      return new Response(JSON.stringify({ error: `Google dice: ${data.error?.message || 'Error desconocido'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "¡Oink! Me quedé sin palabras. Inténtalo de nuevo.";

    return new Response(JSON.stringify({ reply: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("[chat-ai] Exception:", error);
    return new Response(JSON.stringify({ error: "El cerdito se tropezó: " + error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
})