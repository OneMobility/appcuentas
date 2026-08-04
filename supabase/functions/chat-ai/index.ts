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
      return new Response(JSON.stringify({ error: 'Falta la GEMINI_API_KEY en Supabase Secrets.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Enviamos 200 para que el cliente pueda leer el JSON del error
      })
    }

    const prompt = `
      Eres "Oinkash", un asistente financiero experto.
      CONTEXTO: Disponible: $${context.available}, Deudas: $${context.debts}, Cobrables: $${context.receivable}.
      Responde brevemente (máx 3 párrafos), con emojis 🐷 y en español.
      Pregunta: "${message}"
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Error de Google: ${data.error?.message || 'Error desconocido'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude generar una respuesta.";

    return new Response(JSON.stringify({ reply: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
})