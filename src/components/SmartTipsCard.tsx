"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sparkles, RefreshCw, Lightbulb, Brain, Target, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { name: 'Hábito', icon: Brain, color: 'text-purple-600 bg-purple-50' },
  { name: 'Ahorro', icon: Target, color: 'text-blue-600 bg-blue-50' },
  { name: 'Psicología', icon: Lightbulb, color: 'text-yellow-600 bg-yellow-50' },
  { name: 'Seguridad', icon: ShieldCheck, color: 'text-green-600 bg-green-50' },
];

const TIPS = [
  // AHORRO (20)
  { cat: 'Ahorro', text: 'Aplica la regla de las 48 horas: si quieres algo, espera 2 días antes de comprar.' },
  { cat: 'Ahorro', text: 'Preparar café en casa te ahorra hasta $1,200 al mes en promedio.' },
  { cat: 'Ahorro', text: 'Compra marcas genéricas en productos de limpieza; la fórmula suele ser idéntica.' },
  { cat: 'Ahorro', text: 'Cancela esa suscripción que no has usado en los últimos 30 días.' },
  { cat: 'Ahorro', text: 'Revisa la presión de tus llantas; una presión baja gasta más gasolina.' },
  { cat: 'Ahorro', text: 'Compra frutas y verduras de temporada; son más baratas y frescas.' },
  { cat: 'Ahorro', text: 'Desconecta aparatos que no uses; el "consumo vampiro" suma a tu recibo de luz.' },
  { cat: 'Ahorro', text: 'Usa cupones de descuento solo para cosas que ya tenías planeado comprar.' },
  { cat: 'Ahorro', text: 'Compara precios por unidad (litro/kilo) no solo el precio final del empaque.' },
  { cat: 'Ahorro', text: 'Lleva tu propia bolsa al súper; muchos lugares cobran por ellas ahora.' },
  { cat: 'Ahorro', text: 'Automatiza una transferencia de ahorro el mismo día que recibes tu sueldo.' },
  { cat: 'Ahorro', text: 'Antes de tirar algo, mira si se puede reparar. El remiendo ahorra el reemplazo.' },
  { cat: 'Ahorro', text: 'Usa focos LED; consumen hasta un 80% menos energía que los tradicionales.' },
  { cat: 'Ahorro', text: 'Planifica tus comidas de la semana para evitar comprar comida rápida por falta de tiempo.' },
  { cat: 'Ahorro', text: 'Busca programas de lealtad en los lugares que frecuentas de verdad.' },
  { cat: 'Ahorro', text: 'Si sales a comer, comparte el postre; ahorras dinero y calorías.' },
  { cat: 'Ahorro', text: 'Usa el transporte público o camina para trayectos menores a 2 kilómetros.' },
  { cat: 'Ahorro', text: 'Vende lo que no usas en apps de segunda mano; es dinero "atrapado".' },
  { cat: 'Ahorro', text: 'Limpia los filtros de tu aire acondicionado; sucio gasta mucha más energía.' },
  { cat: 'Ahorro', text: 'Llena siempre la lavadora; gastarás menos agua y detergente por carga.' },

  // PSICOLOGÍA (20)
  { cat: 'Psicología', text: 'No ahorres lo que queda después de gastar, gasta lo que queda después de ahorrar.' },
  { cat: 'Psicología', text: 'El marketing está diseñado para que sientas que te falta algo. Respira antes de comprar.' },
  { cat: 'Psicología', text: 'Tu valor como persona no depende de tu saldo bancario ni de lo que posees.' },
  { cat: 'Psicología', text: 'Evita comprar cuando estés triste o muy feliz; las emociones nublan el juicio financiero.' },
  { cat: 'Psicología', text: 'La envidia financiera es cara. No intentes mantener el ritmo de vida de otros.' },
  { cat: 'Psicología', text: 'Visualiza tu meta de ahorro cada vez que sientas el impulso de un gasto hormiga.' },
  { cat: 'Psicología', text: 'El dinero es una herramienta, no el fin último. Úsalo para comprar libertad, no estatus.' },
  { cat: 'Psicología', text: 'Aprende a decir "no está en mi presupuesto por ahora" sin sentir vergüenza.' },
  { cat: 'Psicología', text: 'Date un gusto pequeño planeado; la privación total lleva a atracones de gastos.' },
  { cat: 'Psicología', text: 'Entiende la diferencia entre "necesidad" y "deseo" antes de pasar la tarjeta.' },
  { cat: 'Psicología', text: 'Gastar dinero para impresionar a gente que no te agrada es una trampa sin fin.' },
  { cat: 'Psicología', text: 'La gratificación instantánea es el enemigo número uno de tu riqueza futura.' },
  { cat: 'Psicología', text: 'Escribe tus metas financieras. Lo que no se mide y no se anota, no existe.' },
  { cat: 'Psicología', text: 'Piensa en el precio de algo como "horas de vida trabajadas", no solo en pesos.' },
  { cat: 'Psicología', text: 'El miedo a perderse de algo (FOMO) vacía carteras. Elige tus prioridades.' },
  { cat: 'Psicología', text: 'Perdónate por los errores financieros pasados, pero aprende la lección hoy.' },
  { cat: 'Psicología', text: 'La paz mental de tener un fondo de emergencia no tiene precio de etiqueta.' },
  { cat: 'Psicología', text: 'No uses el "me lo merezco" como excusa para sabotear tu futuro.' },
  { cat: 'Psicología', text: 'El cerebro siente el mismo placer al comprar que al ahorrar si tienes una meta clara.' },
  { cat: 'Psicología', text: 'Simplifica tu vida; menos posesiones significan menos gastos de mantenimiento.' },

  // SEGURIDAD (20)
  { cat: 'Seguridad', text: 'Usa tarjetas digitales con CVV dinámico para todas tus compras en línea.' },
  { cat: 'Seguridad', text: 'Nunca compartas tu NIP o contraseñas por teléfono, ni aunque digan ser del banco.' },
  { cat: 'Seguridad', text: 'Activa la autenticación de dos pasos (2FA) en todas tus apps financieras.' },
  { cat: 'Seguridad', text: 'Revisa tus estados de cuenta cada semana para detectar cargos no reconocidos rápido.' },
  { cat: 'Seguridad', text: 'Evita usar redes WiFi públicas para entrar a tu banca móvil o a Oinkash.' },
  { cat: 'Seguridad', text: 'Si un cajero automático parece manipulado o tiene piezas flojas, no lo uses.' },
  { cat: 'Seguridad', text: 'Cambia tus contraseñas importantes al menos cada 6 meses.' },
  { cat: 'Seguridad', text: 'No guardes fotos de tus tarjetas en la galería de tu celular.' },
  { cat: 'Seguridad', text: 'Desconfía de ofertas que parecen demasiado buenas para ser verdad; suelen ser estafas.' },
  { cat: 'Seguridad', text: 'Bloquea tus tarjetas desde la app cuando no las estés usando.' },
  { cat: 'Seguridad', text: 'Mantén el sistema operativo de tu celular siempre actualizado.' },
  { cat: 'Seguridad', text: 'No hagas clic en enlaces que te lleguen por SMS diciendo que tu cuenta está bloqueada.' },
  { cat: 'Seguridad', text: 'Usa una contraseña diferente para cada cuenta; un gestor de contraseñas ayuda.' },
  { cat: 'Seguridad', text: 'Tritura o destruye documentos que tengan tu nombre y números de cuenta antes de tirarlos.' },
  { cat: 'Seguridad', text: 'Activa las notificaciones de gastos en tiempo real en las apps de tus bancos.' },
  { cat: 'Seguridad', text: 'Si pierdes tu celular, llama de inmediato a tu banco para desvincular el dispositivo.' },
  { cat: 'Seguridad', text: 'Verifica que la URL empiece con "https://" antes de meter tus datos de tarjeta.' },
  { cat: 'Seguridad', text: 'No des permiso de acceso a tus contactos a apps de préstamos dudosos.' },
  { cat: 'Seguridad', text: 'Revisa tu historial crediticio (Buró) una vez al año para detectar robo de identidad.' },
  { cat: 'Seguridad', text: 'Limpia el caché de tu navegador después de hacer trámites bancarios en una PC ajena.' },

  // HÁBITO (20)
  { cat: 'Hábito', text: 'Registra tus gastos en el momento que ocurren. La memoria es traicionera, Oinkash no.' },
  { cat: 'Hábito', text: 'Dedica 10 minutos cada domingo a revisar tus finanzas de la semana.' },
  { cat: 'Hábito', text: 'Carga siempre una botella de agua; evitarás comprar una por impulso en la calle.' },
  { cat: 'Hábito', text: 'Antes de dormir, revisa si tienes pagos pendientes para el día siguiente.' },
  { cat: 'Hábito', text: 'Lleva una lista de súper y apégate a ella estrictamente.' },
  { cat: 'Hábito', text: 'Establece un día a la semana como "Día de Cero Gastos".' },
  { cat: 'Hábito', text: 'Limpia tu correo de newsletters de tiendas que solo te incitan a comprar.' },
  { cat: 'Hábito', text: 'Lee al menos un artículo o escucha un podcast de finanzas a la semana.' },
  { cat: 'Hábito', text: 'Revisa tu score de salud financiera en Oinkash todos los días.' },
  { cat: 'Hábito', text: 'Ahorra primero, gasta después. Es el hábito de la gente próspera.' },
  { cat: 'Hábito', text: 'Lleva tus propios snacks al cine o al trabajo.' },
  { cat: 'Hábito', text: 'Si vas a comprar algo caro, búscalo primero en 3 lugares diferentes.' },
  { cat: 'Hábito', text: 'Categoriza tus gastos correctamente para saber a dónde se va realmente tu dinero.' },
  { cat: 'Hábito', text: 'Habla de dinero con tu pareja o familia de forma abierta y tranquila.' },
  { cat: 'Hábito', text: 'Evita ir al súper con hambre; terminarás comprando de más.' },
  { cat: 'Hábito', text: 'Aprende a cocinar un plato nuevo cada mes; te hará menos dependiente de los restaurantes.' },
  { cat: 'Hábito', text: 'Usa efectivo para tus "gastos de diversión"; cuando se acaba el papel, se acabó la fiesta.' },
  { cat: 'Hábito', text: 'Ponle nombre a tus ahorros (ej: "Viaje a Japón"); motiva más que solo un número.' },
  { cat: 'Hábito', text: 'Revisa tus suscripciones activas al inicio de cada mes.' },
  { cat: 'Hábito', text: 'Sé agradecido con lo que ya tienes; la gratitud reduce el deseo de comprar más.' },
];

const SmartTipsCard = () => {
  const [tip, setTip] = useState(TIPS[0]);
  const [index, setIndex] = useState(0);

  const rotateTip = () => {
    const next = (index + 1) % TIPS.length;
    setIndex(next);
    setTip(TIPS[next]);
  };

  useEffect(() => {
    const interval = setInterval(rotateTip, 20000);
    return () => clearInterval(interval);
  }, [index]);

  const CatIcon = CATEGORIES.find(c => c.name === tip.cat)?.icon || Lightbulb;
  const catColor = CATEGORIES.find(c => c.name === tip.cat)?.color || '';

  return (
    <Card className="border-none shadow-soft bg-white overflow-hidden relative group h-full">
      <CardHeader className="p-5 pb-0 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Consejo Oinkash</CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={rotateTip}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-5 pt-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={tip.text}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", catColor)}>
              <CatIcon className="h-3.5 w-3.5" />
              {tip.cat}
            </div>
            <p className="text-base font-semibold text-slate-700 leading-snug italic">
              "{tip.text}"
            </p>
          </motion.div>
        </AnimatePresence>
      </CardContent>
      <div className="absolute bottom-0 left-0 h-1 bg-indigo-500/10 w-full">
        <motion.div 
          key={tip.text}
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 20, ease: 'linear' }}
          className="h-full bg-indigo-500"
        />
      </div>
    </Card>
  );
};

export default SmartTipsCard;