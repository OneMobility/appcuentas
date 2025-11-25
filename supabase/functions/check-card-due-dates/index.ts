import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { format, addDays, isBefore, isSameDay } from 'https://esm.sh/date-fns@3.6.0';
import { es } from 'https://esm.sh/date-fns@3.6.0/locale';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This is a simplified example. In a real application, you would integrate with a push notification service
// like Firebase Cloud Messaging (FCM) or OneSignal. This function would then send the notification
// to the device tokens stored in your 'user_devices' table.
async function sendPushNotification(token: string, title: string, body: string) {
  console.log(`Simulating push notification to token: ${token}`);
  console.log(`Title: ${title}, Body: ${body}`);
  // Example of how you might call an FCM endpoint (requires FCM server key and proper payload)
  /*
  const fcmEndpoint = 'https://fcm.googleapis.com/fcm/send';
  const fcmServerKey = Deno.env.get('FCM_SERVER_KEY'); // You'd set this as a Supabase secret

  if (!fcmServerKey) {
    console.error('FCM_SERVER_KEY is not set.');
    return;
  }

  await fetch(fcmEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `key=${fcmServerKey}`,
    },
    body: JSON.stringify({
      to: token,
      notification: {
        title: title,
        body: body,
      },
      data: {
        // Optional data payload
      },
    }),
  });
  */
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role key for server-side operations
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const today = new Date();
    const twoDaysFromNow = addDays(today, 2);

    // Fetch all credit cards
    const { data: cards, error: cardsError } = await supabaseClient
      .from('cards')
      .select('id, name, bank_name, type, cut_off_day, payment_due_day, user_id')
      .eq('type', 'credit');

    if (cardsError) {
      console.error('Error fetching cards:', cardsError.message);
      return new Response(JSON.stringify({ error: cardsError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    for (const card of cards || []) {
      let notificationSent = false;

      // Check Cut-off Day
      if (card.cut_off_day !== undefined && card.cut_off_day > 0) {
        let cutOffDate = new Date(today.getFullYear(), today.getMonth(), card.cut_off_day);
        if (isBefore(cutOffDate, today)) {
          cutOffDate = new Date(today.getFullYear(), today.getMonth() + 1, card.cut_off_day);
        }

        if (isBefore(cutOffDate, twoDaysFromNow) || isSameDay(cutOffDate, twoDaysFromNow)) {
          const title = `¡Fecha de corte próxima!`;
          const body = `Tu tarjeta ${card.name} (${card.bank_name}) tiene su fecha de corte el ${format(cutOffDate, "dd 'de' MMMM", { locale: es })}.`;
          
          // Fetch user's device tokens
          const { data: devices, error: devicesError } = await supabaseClient
            .from('user_devices')
            .select('push_token')
            .eq('user_id', card.user_id);

          if (devicesError) {
            console.error(`Error fetching device tokens for user ${card.user_id}:`, devicesError.message);
          } else {
            for (const device of devices || []) {
              await sendPushNotification(device.push_token, title, body);
              notificationSent = true;
            }
          }
        }
      }

      // Check Payment Due Day
      if (card.payment_due_day !== undefined && card.payment_due_day > 0) {
        let paymentDueDate = new Date(today.getFullYear(), today.getMonth(), card.payment_due_day);
        if (isBefore(paymentDueDate, today)) {
          paymentDueDate = new Date(today.getFullYear(), today.getMonth() + 1, card.payment_due_day);
        }

        if (isBefore(paymentDueDate, twoDaysFromNow) || isSameDay(paymentDueDate, twoDaysFromNow)) {
          const title = `¡Fecha límite de pago próxima!`;
          const body = `Tu tarjeta ${card.name} (${card.bank_name}) tiene su fecha límite de pago el ${format(paymentDueDate, "dd 'de' MMMM", { locale: es })}.`;
          
          // Fetch user's device tokens
          const { data: devices, error: devicesError } = await supabaseClient
            .from('user_devices')
            .select('push_token')
            .eq('user_id', card.user_id);

          if (devicesError) {
            console.error(`Error fetching device tokens for user ${card.user_id}:`, devicesError.message);
          } else {
            for (const device of devices || []) {
              await sendPushNotification(device.push_token, title, body);
              notificationSent = true;
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ message: 'Card due dates checked and notifications sent (if applicable).' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});