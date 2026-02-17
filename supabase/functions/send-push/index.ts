import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId, title, body, data } = await req.json()

    // 1. Obtener los tokens del usuario
    const { data: tokens, error: tokenError } = await supabaseClient
      .from('fcm_tokens')
      .select('token')
      .eq('user_id', userId)

    if (tokenError || !tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No tokens found' }), { headers: corsHeaders })
    }

    // 2. Enviar a Firebase (Requiere configurar el secreto FIREBASE_SERVICE_ACCOUNT)
    // Nota: Aquí deberías usar la API v1 de Firebase. 
    // Por simplicidad, este es el esquema de lo que enviaría la función.
    
    console.log(`[send-push] Enviando notificación a ${tokens.length} dispositivos del usuario ${userId}`);

    // Aquí iría el fetch a https://fcm.googleapis.com/v1/projects/TU-PROYECTO/messages:send
    // Necesitarás generar un Access Token de Google.

    return new Response(JSON.stringify({ success: true, sentTo: tokens.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("[send-push] Error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})