import type { Metadata } from "next"

// Política de privacidad pública. Meta la exige para publicar la app "EXPOSURE Ads"
// (Configuración básica → URL de la política de privacidad). Es una página estática,
// sin sesión: el middleware la deja pasar (ver su matcher).
export const metadata: Metadata = {
  title: "Política de privacidad · EXPOSURE",
  description: "Qué datos trata EXPOSURE Consulting LLC, para qué, con quién se comparten y cómo pedir su eliminación.",
}

const ACTUALIZADO = "14 de septiembre de 2026"
const CONTACTO = "exposureconsultingllc@gmail.com"

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{titulo}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</div>
    </section>
  )
}

export default function PrivacidadPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-14">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-zinc-500">EXPOSURE Consulting LLC</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Política de privacidad</h1>
      <p className="mt-2 text-sm text-zinc-500">Última actualización: {ACTUALIZADO}</p>

      <Seccion titulo="Quiénes somos">
        <p>
          EXPOSURE Consulting LLC (&quot;EXPOSURE&quot;, &quot;nosotros&quot;) es una empresa de formación que vende un programa de
          consultoría. Esta política explica cómo tratamos los datos personales en nuestro sistema interno de gestión
          comercial (el CRM) y en la aplicación <b>EXPOSURE Ads</b>, que usamos para leer las métricas de nuestras propias
          cuentas de Instagram, Facebook y publicidad en Meta.
        </p>
        <p>
          La aplicación EXPOSURE Ads es de <b>uso interno</b>. No la ofrecemos a terceros y no publica contenido en nombre de
          otras personas: solo lee información de las cuentas que son de EXPOSURE y de las personas que se contactan con
          nosotros por esas cuentas.
        </p>
      </Seccion>

      <Seccion titulo="Qué datos tratamos">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><b>Datos de contacto de personas interesadas:</b> nombre, usuario de Instagram, teléfono y correo, cuando nos escriben por mensaje directo, completan un formulario o agendan una llamada con nosotros.</li>
          <li><b>Interacciones comerciales:</b> mensajes intercambiados con nuestro equipo, etiquetas del embudo, llamadas agendadas, resultado de esas llamadas y pagos realizados.</li>
          <li><b>Métricas agregadas de nuestras cuentas:</b> visualizaciones, alcance, comentarios y rendimiento de las publicaciones y anuncios de las cuentas de EXPOSURE. Son estadísticas de nuestro propio contenido, no perfiles de terceros.</li>
        </ul>
        <p>No tratamos categorías especiales de datos (salud, ideología, biometría) ni datos de personas menores de 18 años de forma intencional.</p>
      </Seccion>

      <Seccion titulo="Para qué los usamos">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Responder consultas, coordinar y realizar las llamadas de asesoramiento solicitadas.</li>
          <li>Administrar la relación con nuestros clientes: inscripción, pagos, cuotas y acceso al programa.</li>
          <li>Medir el rendimiento de nuestro propio contenido y de nuestra publicidad para decidir qué producir.</li>
          <li>Cumplir obligaciones contables y legales.</li>
        </ul>
        <p>No vendemos datos personales ni los usamos para publicidad de terceros.</p>
      </Seccion>

      <Seccion titulo="Con quién se comparten">
        <p>Solo con los proveedores que hacen funcionar nuestra operación, y únicamente para eso:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><b>Meta Platforms</b> (Instagram, Facebook): mensajería y métricas de nuestras cuentas.</li>
          <li><b>ManyChat</b>: gestión de conversaciones en mensajes directos.</li>
          <li><b>Supabase</b> y <b>Vercel</b>: base de datos y alojamiento del CRM.</li>
          <li><b>Google</b> (Workspace y Sheets): planillas internas de administración.</li>
          <li><b>iClosed</b> y <b>Fathom</b>: agenda y grabación de las llamadas que el participante acepta grabar.</li>
          <li><b>Anthropic</b>: procesamiento de texto con inteligencia artificial para resumir conversaciones internas.</li>
        </ul>
        <p>También podemos compartirlos con autoridades cuando una norma nos obligue.</p>
      </Seccion>

      <Seccion titulo="Cuánto tiempo los guardamos">
        <p>
          Mientras dure la relación comercial y, después, el plazo que exijan las obligaciones contables y legales
          aplicables. Si alguien nunca llega a ser cliente, conservamos sus datos de contacto hasta que pida su
          eliminación o hasta 24 meses sin interacción, lo que ocurra primero.
        </p>
      </Seccion>

      <Seccion titulo="Tus derechos">
        <p>
          Podés pedirnos acceder a tus datos, corregirlos, limitarlos, oponerte a su uso o eliminarlos. Escribinos a{" "}
          <a className="font-semibold text-blue-600 underline underline-offset-2 dark:text-blue-400" href={`mailto:${CONTACTO}`}>{CONTACTO}</a>{" "}
          y respondemos dentro de los 30 días.
        </p>
        <p>
          Para borrar tus datos hay instrucciones paso a paso en{" "}
          <a className="font-semibold text-blue-600 underline underline-offset-2 dark:text-blue-400" href="/eliminar-datos">Eliminación de datos</a>.
        </p>
      </Seccion>

      <Seccion titulo="Seguridad">
        <p>
          El acceso al CRM está restringido a personas del equipo con usuario nominal y aprobación previa. Las claves de
          las integraciones se guardan cifradas en el servidor y nunca en el navegador de los usuarios.
        </p>
      </Seccion>

      <Seccion titulo="Cambios y contacto">
        <p>
          Si cambiamos esta política, actualizamos la fecha del encabezado. Por cualquier consulta sobre privacidad:{" "}
          <a className="font-semibold text-blue-600 underline underline-offset-2 dark:text-blue-400" href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
        </p>
      </Seccion>
    </main>
  )
}
