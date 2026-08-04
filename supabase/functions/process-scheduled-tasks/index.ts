import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { format, addDays, isBefore, isSameDay, parseISO } from "https://esm.sh/date-fns@3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIPS = [
  "Ahorra primero, gasta después. ¡Es el secreto de la abundancia! 🐷",
  "¿Ya revisaste tus suscripciones? Cancela lo que no uses. ✂️",
  "Aplica la regla de las 48 horas: espera dos días antes de una compra grande.",
  "Prepara café en casa; ese gasto hormiga suma miles al año. ☕",
  "El mejor momento para ahorrar fue ayer, el segundo mejor es hoy.",
  "Revisa tu saldo en efectivo antes de salir de casa. 👛",
  "Compara precios antes de comprar, ¡tu bolsillo lo agradecerá!",
  "Establece una meta de ahorro mensual y cúmplela paso a paso. 🚀",
  "Evita las compras por impulso cuando tengas hambre o estés cansado.",
  "Registra cada peso que gastas, el control es poder financiero. 📊"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Obtener hora actual en CDMX (UTC-6)
    const now = new Date();
    const cdmxTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
    const hour = cdmxTime.getHours();

    console.log(`[scheduled-tasks] Ejecutando a las ${hour}:00 CDMX`);

    // 1. LÓGICA DE TIPS (10 AM, 5 PM, 8 PM)
    if ([10, 17, 20].includes(hour)) {
      const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
      const { data: users } = await supabase.from('profiles').select('id');
      
      if (users) {
        for (const u of users) {
          await supabase.from('notifications').insert({
            user_id: u.id,
            title: "💡 Tip Oinkash del momento",
            body: tip,
            type: 'success'
          });
        }
      }
    }

    // 2. LÓGICA DE TARJETAS (Cortes y Pagos)
    // - 7 días previo: Una vez al día (12 PM)
    // - Día exacto: 3 veces al día (9 AM, 3 PM, 9 PM)
    const isReminderHour = hour === 12;
    const isExactDayHour = [9, 15, 21].includes(hour);

    if (isReminderHour || isExactDayHour) {
      const { data: cards } = await supabase.from('cards').select('*, profiles(id)');
      
      for (const card of cards || []) {
        if (card.type !== 'credit' || !card.cut_off_day) continue;

        const today = new Date(cdmxTime.setHours(0,0,0,0));
        let cutOff = new Date(today.getFullYear(), today.getMonth(), card.cut_off_day);
        if (isBefore(cutOff, today)) cutOff = addDays(cutOff, 30); // Ajuste básico para próximo mes

        const diff = Math.ceil((cutOff.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Notificación de Corte
        if (diff > 0 && diff <= 7 && isReminderHour) {
          await supabase.from('notifications').insert({
            user_id: card.user_id,
            title: `📅 Corte en ${diff} días`,
            body: `Tu tarjeta ${card.name} corta pronto. Saldo actual: $${card.current_balance}`,
            type: 'warning'
          });
        } else if (diff === 0 && isExactDayHour) {
          await supabase.from('notifications').insert({
            user_id: card.user_id,
            title: `⚠️ ¡HOY ES EL CORTE!`,
            body: `Día de corte para ${card.name}. Revisa tus movimientos finales.`,
            type: 'error'
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})