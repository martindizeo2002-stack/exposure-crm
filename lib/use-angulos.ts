"use client"

import useSWR from "swr"
import { ANGULOS_SEED, DOLORES_SEED, type AnguloBanco } from "@/lib/angulos-exposure"

// Banco de ángulos para las pantallas. Sale de /api/angulos (tabla crm_angulos, editable desde
// Contenido → Banco de ángulos). Mientras carga, o si la API fallara, devuelve los 25 originales:
// los desplegables nunca quedan vacíos.

const RESPALDO: AnguloBanco[] = ANGULOS_SEED.map((a) => ({
  id: String(a.numero), numero: a.numero, titulo: a.titulo, dolor: a.dolor,
  activo: true, notas: null, etiqueta: `${a.numero} · ${a.titulo}`, usos: 0,
}))

const fetcher = (url: string) => fetch(url).then(async (r) => {
  const b = await r.json()
  if (!r.ok) throw new Error(b.error || "No se pudo cargar el banco de ángulos")
  return b as { angulos: AnguloBanco[]; dolores: string[] }
})

export function useAngulos() {
  const { data, error, isLoading, mutate } = useSWR("/api/angulos", fetcher, { revalidateOnFocus: false })
  const angulos = data?.angulos?.length ? data.angulos : RESPALDO
  return {
    angulos,
    activos: angulos.filter((a) => a.activo),
    // Lo que va en los desplegables donde se elige el ángulo de una pieza.
    etiquetas: angulos.filter((a) => a.activo).map((a) => a.etiqueta),
    dolores: data?.dolores?.length ? data.dolores : [...DOLORES_SEED],
    cargando: isLoading,
    error,
    recargar: mutate,
  }
}
