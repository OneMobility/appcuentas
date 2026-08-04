import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { user_id, title, body } = await req.json()
    
    // 1. Inicializar cliente Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Obtener los tokens del dispositivo del usuario
    const { data: deviceTokens } = await supabase
      .from('user_device_tokens')
      .select('token')
      .eq('user_id', user_id)

    if (!deviceTokens || deviceTokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No tokens found for user' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Obtener el token de acceso de Google (Requiere configuración de Service Account)
    // Nota: Para simplificar, aquí usarías una librería como 'googleapis' o el flujo JWT
    // Por ahora, simulamos el envío. En un entorno real, aquí se hace el FETCH a:
    // https://fcm.googleapis.com/v1/projects/TU-PROYECTO-ID/messages:send

    console.log(`[Push Service] Enviando a ${deviceTokens.length} dispositivos del usuario ${user_id}`);
    console.log(`[Push Service] Contenido: ${title} - ${body}`);

    // Iterar y enviar a cada token registrado
    const results = await Promise.all(deviceTokens.map(async (d) => {
      // Aquí iría el fetch real a FCM
      return { token: d.token, status: 'simulated_success' }
    }))

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})