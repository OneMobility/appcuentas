import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://deno.land/x/jose@v5.2.2/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Datos de tu cuenta de servicio (Extraídos del JSON que pasaste)
const FB_CONFIG = {
  project_id: "oinkash",
  client_email: "firebase-adminsdk-fbsvc@oinkash.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDpkarM6t2EpDkb\nnWYIh1w344qcWY1DP6jVsKDzy8kXRwSfLdTCx6/p0jPzfm9u8VN0tVKY1R+z1zmG\n1R1aQHi5oht4I9QyqapQMcizBbBJljMGmnOHuoFKvvzX4WWgB4z72IB2s7PbF2H/\nJoiMgI8zT66oYup3OdgNHrvK/IBrjdEv4fSCa7U8MEIwm4drKbViSngen16yV3cO\nHNd+W5Hai6VRKVu37hn48V3nvw1fW3eejNDZBCQKVwAELEBfoyHz8IXSDwQtxOUW\nCxNdflyMMFdfAgveFbEvZZuUzGRP9zWsSxgzJfyCzX4CchSsZ51U3a38Z9PH/FBb\n3/fklHw/AgMBAAECggEAA7avMobhcsRxrAC6qJQOYU0a3RWHa3RNqOggBwBMeDRG\n3IkMAvTN1TfkX5C5ENiBbS+c2pU45dEcNwqYZuDzinALY8OeEhgkfxXrjP0gKmta\n8FXwVE4g1CFpP71zsjGsiiyNDlYZG/ipNDdWoHVC0ZwIuOCpva+LwdmlPrr5B7y3\nuUNoa0I0Sl+N8V2QUnejMjvCTPYAE+g7H00dEv93FDg1Pi2GScL1uAuddBzBf2xF\nKpyv2TiowpWAIGysv8wymG14TIl/ErVDG8O1ViySonOW8Enb3EyT/L2dE16Q3QlA\nifpwaTLE15MeAPbzOmD/Cn4TAfekd/sb41XXrSXOkQKBgQD73McuQ5Aqlthmx2ok\ngcmmB8pR08MgwBJKTLJ0YoCwANdXFHgejYPQR1QsfhYl5xIPj/bX/cHYBW7NGg8V\n3suuoJs970mCB3Iywq9fGOxdtWyG1AIE9bbcoi/fBwdJFj+3UplPzYIpdM8yA99S\nl18cHO50PpIS03g8ZeCbY7eF5QKBgQDtZ/SGsiy6KopjyKN1k2WMMP3OpymfQklY\nHEJ+mQUe21qErv3G7DJmb+9fqvWnDrNlYidNZLc+8DStSEI4owEeqFKlPjcb5WF7\niDmHlS0RQlF6F9NGvvz6jcyhSY7/zpJBHn2aTEpi8IWGckzv8ZmZa760FKV+OOtL\n3fyn7hKXUwKBgQDiHiacvH+0HNWQALykpfk6HIhhynLG9mn1VsJohv7uBPNP9Mqa\n84ZB+afyggi0Yq3uVtvQsrvTi50ceqbMhcfrsbluc2RVXwYB2JPGFwQuZXFX4wMl\nHMzdbKb53r+FuHnfxkJqSSDwwzQ5vQxEhC4ZeUgECSDv0feCkhyCpZXgmQKBgFKJ\nvuEJlzVOTvjsK7BYA4kfC07KnVTqVdeVU6TyDG6y8qCIumBrhAZLSlznciqXmNVZ\nr7Jfnrn6B0ZrheJtAZmoCbu7iqtfL2okbWPvAFEszmj1WZYSFqABprA4g8f6CK0t\nLZv0hDQrzTB2ErulMrK9W/r95p+gqGWjExFLWxlTAoGAXi1pXfhO7oLTMj8faaVh\ntiB3Q7bNSmHWAwPNwD58n+ZsIrP1yjzsoFY3q7nytpb+f06veH3J0pu8/QTdoSIE\nAzaBQJlJ0reeBIirFnn6nASFXCHhLucXIdtplx85wbS5xrDVCGoimjSBB8Z1DJgO\nwD7UxttMFXLBA7OMZpB36l8=\n-----END PRIVATE KEY-----\n",
}

async function getAccessToken() {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 3600

  const jwt = await new jose.SignJWT({
    iss: FB_CONFIG.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .sign(await jose.importPKCS8(FB_CONFIG.private_key, 'RS256'))

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const data = await res.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { user_id, title, body } = await req.json()
    console.log(`[send-push-notification] Iniciando envío para usuario: ${user_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: deviceTokens } = await supabase
      .from('user_device_tokens')
      .select('token')
      .eq('user_id', user_id)

    if (!deviceTokens || deviceTokens.length === 0) {
      console.log(`[send-push-notification] No se encontraron tokens para el usuario ${user_id}`);
      return new Response(JSON.stringify({ message: 'No tokens found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const accessToken = await getAccessToken()
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${FB_CONFIG.project_id}/messages:send`

    const results = await Promise.all(deviceTokens.map(async (d) => {
      const message = {
        message: {
          token: d.token,
          notification: { title, body },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channel_id: "default"
            }
          },
          apns: {
            payload: {
              aps: { sound: "default" }
            }
          }
        }
      }

      const response = await fetch(fcmUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      })

      const resData = await response.json()
      return { token: d.token, status: response.ok ? 'success' : 'error', detail: resData }
    }))

    console.log(`[send-push-notification] Resultados:`, results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error(`[send-push-notification] Error crítico:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})