import type { Metadata } from "next"

// Condiciones del servicio públicas. Meta las pide en la configuración básica de la app
// "EXPOSURE Ads" (URL de Condiciones del servicio). Página estática y sin sesión: el
// middleware la deja pasar (ver su matcher).
export const metadata: Metadata = {
  title: "Términos y condiciones · EXPOSURE",
  description: "Condiciones del servicio de EXPOSURE Consulting LLC: qué incluye el programa, pagos, acceso, propiedad intelectual y contacto.",
}

const ACTUALIZADO = "14 de septiembre de 2026"
const CONTACTO = "exposureconsultingllc@gmail.com"
const SITIO = "exposure.com.ar"

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{titulo}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</div>
    </section>
  )
}

export default function TerminosPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-14">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-zinc-500">EXPOSURE Consulting LLC</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Términos y condiciones</h1>
      <p className="mt-2 text-sm text-zinc-500">Última actualización: {ACTUALIZADO}</p>

      <Seccion titulo="1. Qué es esto">
        <p>
          Estas condiciones regulan el uso del sitio <b>{SITIO}</b>, de nuestras cuentas oficiales en redes sociales y de
          los programas de formación y consultoría que comercializa EXPOSURE Consulting LLC (&quot;EXPOSURE&quot;,
          &quot;nosotros&quot;). Al contratar un programa o usar el sitio, aceptás lo que sigue.
        </p>
      </Seccion>

      <Seccion titulo="2. Qué incluye el programa">
        <p>
          EXPOSURE vende formación y acompañamiento para construir un negocio de servicios con inteligencia artificial.
          El alcance concreto de cada programa (duración, clases, sesiones de acompañamiento, materiales y canales de
          soporte) es el que se te informa por escrito antes de la compra. Ese detalle es el que manda si algo de esta
          página resultara más general.
        </p>
        <p>
          Podemos mejorar, reemplazar o reorganizar los contenidos y las herramientas del programa mientras lo cursás,
          siempre que no reduzcamos el alcance de lo que contrataste.
        </p>
      </Seccion>

      <Seccion titulo="3. Precio, pagos y acceso">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>El precio, la moneda y el plan de pagos son los informados y aceptados al momento de la compra.</li>
          <li>Si elegís un plan en cuotas, te comprometés a abonarlas en las fechas acordadas.</li>
          <li>El acceso al programa se habilita cuando se acredita el pago correspondiente.</li>
          <li>Ante cuotas impagas podemos suspender el acceso hasta regularizar la situación, avisándote antes.</li>
        </ul>
      </Seccion>

      <Seccion titulo="4. Devoluciones">
        <p>
          Las condiciones de devolución son las que se te informan y acordás por escrito al momento de la compra. Si
          tenés dudas sobre las que se aplican a tu caso, escribinos a{" "}
          <a className="font-semibold text-blue-600 underline underline-offset-2 dark:text-blue-400" href={`mailto:${CONTACTO}`}>{CONTACTO}</a>{" "}
          antes de contratar y te las enviamos por escrito.
        </p>
      </Seccion>

      <Seccion titulo="5. Sin promesa de resultados">
        <p>
          EXPOSURE enseña un método y acompaña su implementación. <b>No garantizamos ingresos ni resultados económicos
          de ningún tipo.</b> Los casos de alumnos que mostramos son resultados reales de personas concretas en su
          contexto, no un rendimiento esperable ni prometido para vos. Lo que consigas depende de tu trabajo, tu mercado,
          tu experiencia previa y factores que no controlamos.
        </p>
        <p>Nada de lo que publicamos constituye asesoramiento financiero, legal, contable ni de inversión.</p>
      </Seccion>

      <Seccion titulo="6. Propiedad intelectual">
        <p>
          Todo el material del programa (clases, grabaciones, documentos, plantillas, sistemas y comunidad) es propiedad
          de EXPOSURE y se te licencia para tu uso personal mientras dure tu acceso. No podés compartirlo, revenderlo,
          publicarlo, ni usarlo para armar un producto competidor.
        </p>
        <p>
          Compartir tus credenciales o difundir el material da lugar a la baja inmediata del acceso, sin devolución, y a
          las acciones legales que correspondan.
        </p>
      </Seccion>

      <Seccion titulo="7. Convivencia y baja del acceso">
        <p>
          Esperamos respeto en todos los canales del programa. Podemos dar de baja el acceso, sin devolución, ante
          hostigamiento, discriminación, spam a otros alumnos, suplantación de identidad o uso del programa para
          actividades ilegales.
        </p>
      </Seccion>

      <Seccion titulo="8. Grabación de las llamadas">
        <p>
          Las llamadas de asesoramiento y de acompañamiento pueden grabarse para dejar registro y mejorar el servicio.
          Te avisamos al inicio de cada llamada y podés pedir que no se grabe.
        </p>
      </Seccion>

      <Seccion titulo="9. Datos personales">
        <p>
          El tratamiento de tus datos está explicado en nuestra{" "}
          <a className="font-semibold text-blue-600 underline underline-offset-2 dark:text-blue-400" href="/privacidad">política de privacidad</a>, y podés
          pedir su eliminación siguiendo estas{" "}
          <a className="font-semibold text-blue-600 underline underline-offset-2 dark:text-blue-400" href="/eliminar-datos">instrucciones</a>.
        </p>
      </Seccion>

      <Seccion titulo="10. Herramientas internas">
        <p>
          El sistema de gestión de EXPOSURE y la aplicación <b>EXPOSURE Ads</b> son de uso interno del equipo. No están
          disponibles para terceros y solo leen información de las cuentas propias de EXPOSURE y de las conversaciones
          que las personas inician con nosotros.
        </p>
      </Seccion>

      <Seccion titulo="11. Cambios y contacto">
        <p>
          Podemos actualizar estas condiciones; la versión vigente es siempre la publicada en esta página, con su fecha.
          Los cambios no afectan el alcance de un programa ya contratado. Consultas:{" "}
          <a className="font-semibold text-blue-600 underline underline-offset-2 dark:text-blue-400" href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
        </p>
        <p>Ante cualquier diferencia, nos comprometemos a buscar primero una solución de buena fe entre las partes.</p>
      </Seccion>
    </main>
  )
}
