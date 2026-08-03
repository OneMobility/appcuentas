import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { message, context } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY en los secretos de Supabase' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Construimos un prompt con personalidad y datos reales
    const prompt = `
      Eres "Oinkash", un asistente financiero amigable, experto y motivador.
      
      CONTEXTO DEL USUARIO:
      - Saldo Disponible: $${context.available}
      - Deudas totales: $${context.debts}
      - Dinero que le deben: $${context.receivable}
      - Próximos pagos vencidos: ${context.pendingPayments}
      
      INSTRUCCIONES:
      - Responde de forma concisa y directa.
      - Usa emojis de vez en cuando (especialmente el de cerdito 🐷).
      - Si el usuario gasta mucho, dale un consejo de ahorro.
      - Habla siempre en español de México/Latinoamérica.
      
      PREGUNTA DEL USUARIO: "${message}"
    `

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    })

    const data = await response.json()
    const aiResponse = data.candidates[0].content.parts[0].text

    return new Response(JSON.stringify({ reply: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})