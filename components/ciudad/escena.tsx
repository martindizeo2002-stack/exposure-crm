"use client"

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { Html, MapControls, OrthographicCamera, RoundedBox } from "@react-three/drei"
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import * as THREE from "three"
import { COLOR_ANGULO, COLOR_ESTADO, ZONAS, fechaCorta, nombreVisible, numero, type CiudadVista, type Seleccion, type Zona } from "./tipos"

// Exposure OS · Vista ciudad. Escena isométrica (cámara ortográfica) armada con geometría simple: cada figura es un
// registro real del CRM y cada edificio, una etapa del embudo. Los textos van como capas HTML para que se lean bien.
// Mapa (unidades de mundo): agua con las islas a la izquierda (x < -10), la cinta de ManyChat entra a Captación,
// fila de arriba Captación → Espera → Setters → plaza de Agendas, fila de abajo Closers → Seguimiento → Clientes → Formación.

type Props = { datos: CiudadVista; seleccion: Seleccion; onSeleccion: (s: Seleccion) => void; animar: boolean; nombres: boolean }

const PIEL = "#F6E4DA"
const BLANCO = "#FCFBFF"
const LAVANDA = "#E6DEFB"
const SUELO = "#F1EDFC"
const CALLE = "#DCD2F7"
const AGUA = "#B7C6FF"

const POS: Record<Exclude<Zona, "contenido" | "agendas" | "closers">, { x: number; z: number }> = {
  captacion: { x: -5, z: -9 }, espera: { x: 5.5, z: -9 }, setters: { x: 16, z: -9 },
  formacion: { x: -5, z: 9 }, clientes: { x: 5.5, z: 9 }, seguimiento: { x: 16, z: 9 },
}
const PLAZA = { x0: 23.5, z0: -14, ancho: 12 }
const OFICINAS = { x0: 23.5, z: 9, paso: 4.6 }
const CINTA_Z = -9
// dirección de la cámara (desde el centro): mayormente de frente (+z) y un poco de costado (+x), así el flujo
// islas → captación → agendas se lee de izquierda a derecha y se ven el frente y un lateral de cada edificio
const CAM: [number, number, number] = [28, 56, 62]
const GIRO_HOLO = Math.atan2(CAM[0], CAM[2])

type Tip = { p: [number, number, number]; texto: string } | null
const tipStore = (() => {
  let actual: Tip = null
  const subs = new Set<() => void>()
  return {
    get: () => actual,
    set: (t: Tip) => { actual = t; subs.forEach((f) => f()) },
    sub: (f: () => void) => { subs.add(f); return () => { subs.delete(f) } },
  }
})()

function Tooltip() {
  const tip = useSyncExternalStore(tipStore.sub, tipStore.get, () => null)
  return (
    <Html position={tip?.p || [0, -50, 0]} center zIndexRange={[50, 0]} style={{ pointerEvents: "none" }}>
      <div className={`whitespace-nowrap rounded-lg bg-[#2A2140] px-2 py-1 text-[11px] text-white shadow-lg ${tip ? "" : "hidden"}`}>{tip?.texto}</div>
    </Html>
  )
}

function cursor(v: boolean) { if (typeof document !== "undefined") document.body.style.cursor = v ? "pointer" : "" }
const parar = (e: ThreeEvent<MouseEvent>) => e.stopPropagation()

function usePlaca(lineas: string[], color: string) {
  return useMemo(() => {
    if (typeof document === "undefined") return null
    const c = document.createElement("canvas")
    c.width = 300; c.height = 420
    const g = c.getContext("2d")
    if (!g) return null
    g.fillStyle = "#F6F2FF"; g.fillRect(0, 0, 300, 420)
    g.fillStyle = color; g.fillRect(0, 0, 300, 14)
    g.fillStyle = "#2A2140"; g.textAlign = "center"
    g.font = "600 34px system-ui, sans-serif"; g.fillText(lineas[0] || "", 150, 170)
    g.font = "28px system-ui, sans-serif"; g.fillStyle = "#6E6590"; g.fillText(lineas[1] || "", 150, 215)
    g.font = "italic 24px system-ui, sans-serif"; g.fillStyle = "#9A90C2"; g.fillText("sin vista previa", 150, 300)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [lineas, color])
}

function useTextura(url: string | null | undefined) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!url) return
    let vivo = true
    const l = new THREE.TextureLoader()
    l.setCrossOrigin("anonymous")
    l.load(url, (t) => { if (!vivo) return; t.colorSpace = THREE.SRGBColorSpace; setTex(t) }, undefined, () => { if (vivo) setTex(null) })
    return () => { vivo = false }
  }, [url])
  return url ? tex : null
}

// ── piezas básicas ─────────────────────────────────────────────────────────────────────────────────────────

function Caja({ p, s, color, sombra = true, opacity }: { p: [number, number, number]; s: [number, number, number]; color: string; sombra?: boolean; opacity?: number }) {
  return (
    <mesh position={p} castShadow={sombra} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} roughness={0.85} transparent={opacity !== undefined} opacity={opacity ?? 1} />
    </mesh>
  )
}

function Etiqueta({ p, children, onClick, chica }: { p: [number, number, number]; children: ReactNode; onClick?: () => void; chica?: boolean }) {
  return (
    <Html position={p} center zIndexRange={[40, 0]} style={{ pointerEvents: onClick ? "auto" : "none" }}>
      <div
        // el lienzo escucha los clics del contenedor: sin esto, el clic en el cartel también "erra" la escena y deselecciona
        onClick={onClick ? (e) => { e.stopPropagation(); onClick() } : undefined}
        // en el celular solo quedan los carteles de los edificios (más chicos); el resto está en el panel
        className={`select-none whitespace-nowrap rounded-xl border border-violet-200/80 bg-white/95 text-[#2A2140] shadow-[0_6px_18px_-8px_rgba(91,81,216,0.45)] ${chica ? "px-2 py-0.5 text-[10px] max-sm:hidden" : "px-3 py-1.5 text-xs max-sm:px-1.5 max-sm:py-0.5 max-sm:text-[10px]"} ${onClick ? "cursor-pointer hover:border-violet-400" : ""}`}
      >
        {children}
      </div>
    </Html>
  )
}

function Figura({ p, color, etiqueta, onClick, escala = 1, atenuada, rot = 0 }: { p: [number, number, number]; color: string; etiqueta?: string; onClick?: () => void; escala?: number; atenuada?: boolean; rot?: number }) {
  const ref = useRef<THREE.Group>(null)
  return (
    <group
      ref={ref} position={p} scale={escala} rotation={[0, rot, 0]}
      onClick={(e) => { parar(e); onClick?.() }}
      onPointerOver={(e) => {
        e.stopPropagation(); cursor(true)
        if (etiqueta && ref.current) { const w = new THREE.Vector3(); ref.current.getWorldPosition(w); tipStore.set({ p: [w.x, w.y + 1.5 * escala, w.z], texto: etiqueta }) }
      }}
      onPointerOut={() => { cursor(false); tipStore.set(null) }}
    >
      <mesh position={[0, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.34, 4, 10]} />
        <meshStandardMaterial color={color} roughness={0.6} transparent={atenuada} opacity={atenuada ? 0.5 : 1} />
      </mesh>
      <mesh position={[0, 0.93, 0]} castShadow>
        <sphereGeometry args={[0.19, 16, 12]} />
        <meshStandardMaterial color={PIEL} roughness={0.7} transparent={atenuada} opacity={atenuada ? 0.5 : 1} />
      </mesh>
    </group>
  )
}

// figuras de un grupo, en grilla; si hay más registros que lugares se dibujan los más recientes y el resto queda en el contador
function Gente<T extends { id: string; nombre: string }>({ lista, total, x, z, cols = 6, max = 18, color, colorDe, zona, onSeleccion, nombres, paso = 0.72 }: {
  lista: T[]; total: number; x: number; z: number; cols?: number; max?: number; color: string; colorDe?: (r: T) => string; zona: Zona; onSeleccion: Props["onSeleccion"]; nombres: boolean; paso?: number
}) {
  const visibles = lista.slice(0, Math.min(max, total))
  return (
    <group>
      {visibles.map((r, i) => (
        <Figura key={r.id} p={[x + (i % cols) * paso, 0.2, z + Math.floor(i / cols) * paso]} color={colorDe ? colorDe(r) : color} etiqueta={nombreVisible(r.nombre, nombres)} onClick={() => onSeleccion({ zona, id: r.id })} escala={0.85} />
      ))}
    </group>
  )
}

function Edificio({ x, z, w = 7, d = 5, h = 3, techo, zona, titulo, valor, detalle, seleccion, onSeleccion, ventanas = true, children }: {
  x: number; z: number; w?: number; d?: number; h?: number; techo: string; zona: Zona; titulo: string; valor: string; detalle?: string
  seleccion: Seleccion; onSeleccion: Props["onSeleccion"]; ventanas?: boolean; children?: ReactNode
}) {
  const sel = seleccion?.zona === zona
  const abrir = () => onSeleccion({ zona })
  const nV = Math.max(2, Math.floor(w / 1.6))
  return (
    <group>
      <group position={[x, 0, z]} onClick={(e) => { parar(e); abrir() }} onPointerOver={(e) => { e.stopPropagation(); cursor(true) }} onPointerOut={() => cursor(false)}>
        <Caja p={[0, 0.1, 0]} s={[w + 0.9, 0.2, d + 0.9]} color={sel ? techo : LAVANDA} sombra={false} />
        <RoundedBox args={[w, h, d]} radius={0.3} smoothness={3} position={[0, h / 2 + 0.2, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={BLANCO} roughness={0.9} />
        </RoundedBox>
        <RoundedBox args={[w + 0.25, 0.4, d + 0.25]} radius={0.15} smoothness={2} position={[0, h + 0.38, 0]} castShadow>
          <meshStandardMaterial color={techo} roughness={0.55} />
        </RoundedBox>
        {ventanas ? Array.from({ length: nV }, (_, i) => (
          <group key={i}>
            <Caja p={[-w / 2 + (i + 0.5) * (w / nV), h * 0.62, d / 2 + 0.02]} s={[0.8, 0.7, 0.05]} color="#CFC3F6" sombra={false} />
            <Caja p={[w / 2 + 0.02, h * 0.62, -d / 2 + (i + 0.5) * (d / nV)]} s={[0.05, 0.7, Math.min(0.8, d / nV - 0.3)]} color="#D9CFF8" sombra={false} />
          </group>
        )) : null}
        <Caja p={[0, 0.78, d / 2 + 0.03]} s={[1.1, 1.15, 0.06]} color={techo} sombra={false} />
      </group>
      <Etiqueta p={[x, h + 1.5, z]} onClick={abrir}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: techo }} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5B4E86] max-sm:text-[8px] max-sm:tracking-normal">{titulo}</span>
          <span className="text-sm font-bold tabular-nums">{valor}</span>
        </div>
        {detalle && sel ? <div className="mt-0.5 text-[10px] text-[#6E6590]">{detalle}</div> : null}
      </Etiqueta>
      {children}
    </group>
  )
}

// ── cintas: tramos planos con paquetes que avanzan (un paquete no es una persona: marca el caudal) ─────────────

function Cinta({ puntos, paquetes, color, colorPaquete, ancho = 0.5, animar, velocidad = 1.4, onClick }: {
  puntos: Array<[number, number]>; paquetes: number; color: string; colorPaquete: string; ancho?: number; animar: boolean; velocidad?: number; onClick?: () => void
}) {
  const tramos = useMemo(() => {
    const out: Array<{ a: [number, number]; b: [number, number]; len: number; ang: number; desde: number }> = []
    let acc = 0
    for (let i = 0; i < puntos.length - 1; i++) {
      const a = puntos[i], b = puntos[i + 1]
      const dx = b[0] - a[0], dz = b[1] - a[1]
      const len = Math.hypot(dx, dz)
      out.push({ a, b, len, ang: Math.atan2(-dz, dx), desde: acc })
      acc += len
    }
    return { out, total: acc }
  }, [puntos])
  const posEn = (d: number): [number, number] => {
    const t = tramos.out.find((s) => d >= s.desde && d <= s.desde + s.len) || tramos.out[tramos.out.length - 1]
    const f = t.len ? (d - t.desde) / t.len : 0
    return [t.a[0] + (t.b[0] - t.a[0]) * f, t.a[1] + (t.b[1] - t.a[1]) * f]
  }
  const refs = useRef<Array<THREE.Mesh | null>>([])
  useFrame(({ clock }) => {
    if (!animar || !tramos.total) return
    const t = clock.getElapsedTime() * velocidad
    refs.current.forEach((m, i) => {
      if (!m) return
      const [x, z] = posEn((t + (i / paquetes) * tramos.total) % tramos.total)
      m.position.set(x, 0.32, z)
    })
  })
  return (
    <group onClick={onClick ? (e) => { parar(e); onClick() } : undefined}>
      {tramos.out.map((s, i) => (
        <mesh key={i} position={[(s.a[0] + s.b[0]) / 2, 0.08, (s.a[1] + s.b[1]) / 2]} rotation={[0, s.ang, 0]} receiveShadow>
          <boxGeometry args={[s.len + ancho, 0.14, ancho]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      ))}
      {Array.from({ length: paquetes }, (_, i) => {
        const [x, z] = posEn(((i + 0.5) / paquetes) * tramos.total)
        return (
          <mesh key={i} ref={(m) => { refs.current[i] = m }} position={[x, 0.32, z]} castShadow>
            <boxGeometry args={[0.26, 0.2, 0.26]} />
            <meshStandardMaterial color={colorPaquete} emissive={colorPaquete} emissiveIntensity={0.25} />
          </mesh>
        )
      })}
    </group>
  )
}

// ── islas ──────────────────────────────────────────────────────────────────────────────────────────────────

type IslaDato = CiudadVista["islas"][number]
const LUGARES_ISLA = (() => {
  // dos filas pegadas a la cinta (norte y sur) y dos más afuera, corridas medio paso para que sus cintas pasen entre islas
  const out: Array<{ x: number; z: number }> = []
  const filas = [{ z: CINTA_Z - 3.6, off: 0 }, { z: CINTA_Z + 3.6, off: 0 }, { z: CINTA_Z - 7.8, off: 1.9 }, { z: CINTA_Z + 7.8, off: 1.9 }]
  for (const f of filas) for (let k = 0; k < 6; k++) out.push({ x: -13 - k * 3.8 - f.off, z: f.z })
  return out
})()

function Isla({ isla, x, z, sel, conEtiqueta, onSeleccion, animar }: { isla: IslaDato; x: number; z: number; sel: boolean; conEtiqueta: boolean; onSeleccion: Props["onSeleccion"]; animar: boolean }) {
  const tex = useTextura(isla.preview?.imagen)
  const color = COLOR_ANGULO[isla.angulo || ""] || "#B8B0D8"
  const lineas = useMemo(() => [String(isla.formato || isla.categoria || "Pieza").slice(0, 16), fechaCorta(isla.fecha)], [isla.formato, isla.categoria, isla.fecha])
  const placa = usePlaca(lineas, color)

  const holo = useRef<THREE.Group>(null)
  const alto = isla.categoria === "Carrusel" ? 1.9 : 2.4
  useFrame(({ clock }) => { if (animar && holo.current) holo.current.position.y = 3.2 + Math.sin(clock.getElapsedTime() * 1.1 + x) * 0.12 })
  const abrir = () => onSeleccion({ zona: "contenido", id: isla.id })
  return (
    <group position={[x, 0, z]} onClick={(e) => { parar(e); abrir() }} onPointerOver={(e) => { e.stopPropagation(); cursor(true); tipStore.set({ p: [x, 1.4, z + 1.6], texto: `${isla.nombre} · ${isla.leads === null ? "leads N/D" : `${numero(isla.leads)} leads`}${isla.semana ? ` · ${numero(isla.semana)} en 7 días` : ""}` }) }} onPointerOut={() => { cursor(false); tipStore.set(null) }}>
      <mesh position={[0, -0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.55, 1.05, 0.95, 24]} />
        <meshStandardMaterial color="#EEDDC4" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.33, 0]} receiveShadow>
        <cylinderGeometry args={[1.45, 1.55, 0.14, 24]} />
        <meshStandardMaterial color={sel ? "#FFFFFF" : color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.3, 1.5, 12]} />
        <meshStandardMaterial color="#F4F0FF" />
      </mesh>
      <group ref={holo} position={[0, 3.2, 0]} rotation={[0, GIRO_HOLO, 0]}>
        <mesh position={[0, 0, -0.03]}>
          <planeGeometry args={[1.62, alto + 0.12]} />
          <meshBasicMaterial color={color} transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
        <mesh key={tex ? "con" : "sin"}>
          <planeGeometry args={[1.5, alto]} />
          <meshBasicMaterial map={tex || placa} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>
      {conEtiqueta || sel ? (
        <Etiqueta p={[0, 0.2, 2.0]} chica onClick={abrir}>
          <span className="font-semibold">{isla.formato || isla.categoria || "Pieza"}</span> · {fechaCorta(isla.fecha)} · <span className="tabular-nums">{isla.leads === null ? "leads N/D" : `${numero(isla.leads)} leads`}</span>{isla.semana ? <span className="text-[#C13584]"> · {numero(isla.semana)} en 7 días</span> : null}
        </Etiqueta>
      ) : null}
    </group>
  )
}

// ── agendas: una fila de sillas por closer ──────────────────────────────────────────────────────────────────

function useCartel(texto: string, fondo: string) {
  return useMemo(() => {
    if (typeof document === "undefined") return null
    const c = document.createElement("canvas")
    c.width = 160; c.height = 72
    const g = c.getContext("2d")
    if (!g) return null
    g.fillStyle = fondo; g.fillRect(0, 0, 160, 72)
    g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.textBaseline = "middle"
    g.font = "700 46px system-ui, sans-serif"; g.fillText(texto, 80, 38)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [texto, fondo])
}

function Silla({ x, z, estado, nombre, hora, onClick, nombres }: { x: number; z: number; estado: keyof typeof COLOR_ESTADO; nombre: string; hora: string; onClick: () => void; nombres: boolean }) {
  const c = COLOR_ESTADO[estado]
  const vacia = estado === "no_show" || estado === "cancelada"
  const cartel = useCartel(hora, c)
  return (
    <group position={[x, 0, z]} onClick={(e) => { parar(e); onClick() }} onPointerOver={(e) => { e.stopPropagation(); cursor(true) }} onPointerOut={() => cursor(false)}>
      <Caja p={[0, 0.25, 0]} s={[0.14, 0.5, 0.14]} color="#CFC6EE" />
      <Caja p={[0, 0.55, 0]} s={[0.78, 0.12, 0.72]} color={c} />
      <Caja p={[0, 1.15, -0.33]} s={[0.86, 1.15, 0.1]} color={c} />
      <mesh position={[0, 1.5, -0.27]}>
        <planeGeometry args={[0.84, 0.4]} />
        <meshBasicMaterial map={cartel} toneMapped={false} />
      </mesh>
      {vacia ? null : <Figura p={[0, 0.32, 0.12]} color="#3F3566" atenuada={estado === "sin_resultado" || estado === "reprogramada"} etiqueta={`${hora} · ${nombreVisible(nombre, nombres)}`} onClick={onClick} escala={0.82} />}
    </group>
  )
}

function Plaza({ datos, seleccion, onSeleccion, nombres }: Pick<Props, "datos" | "seleccion" | "onSeleccion" | "nombres">) {
  const { x0, z0, ancho } = PLAZA
  const carriles = datos.agendas.carriles
  const fondoCarril = 3.4
  const largo = Math.max(9, 2.6 + carriles.length * fondoCarril)
  const porFila = 7
  const sel = seleccion?.zona === "agendas"
  const dia = new Date(`${datos.dia}T12:00:00Z`).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" })
  return (
    <group>
      <group onClick={(e) => { parar(e); onSeleccion({ zona: "agendas" }) }}>
        <Caja p={[x0 + ancho / 2, 0.1, z0 + largo / 2]} s={[ancho, 0.2, largo]} color={sel ? "#E9E4FF" : "#F7F5FF"} sombra={false} />
        <Caja p={[x0 + ancho / 2, 0.3, z0]} s={[ancho, 0.4, 0.25]} color="#5B51D8" />
        <Caja p={[x0, 0.3, z0 + largo / 2]} s={[0.25, 0.4, largo]} color="#5B51D8" />
      </group>
      <Etiqueta p={[x0 + ancho / 2, 2.4, z0 - 0.6]} onClick={() => onSeleccion({ zona: "agendas" })}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#5B51D8]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5B4E86] max-sm:text-[8px] max-sm:tracking-normal">Agendas · {dia}</span>
          <span className="text-sm font-bold tabular-nums">{datos.agendas.total}</span>
        </div>
      </Etiqueta>
      {carriles.map((c, i) => {
        const cz = z0 + 2 + i * fondoCarril + fondoCarril / 2
        const filas = Math.max(1, Math.ceil(c.sillas.length / porFila))
        return (
          <group key={c.closer}>
            <Caja p={[x0 + ancho / 2 + 0.6, 0.22, cz]} s={[ancho - 1.6, 0.05, fondoCarril - 0.5]} color="#ECE6FF" sombra={false} />
            <Etiqueta p={[x0 + 1.3, 0.7, cz + 0.4]} chica onClick={() => onSeleccion({ zona: "closers", id: c.closer })}>
              <span className={c.en_equipo ? "font-semibold" : "italic text-[#8A80AE]"}>{c.closer.split(" ")[0]}</span> · <span className="tabular-nums">{c.sillas.length}</span>
            </Etiqueta>
            {c.sillas.map((s, j) => (
              <Silla key={s.id} x={x0 + 3.6 + (j % porFila) * 1.25} z={cz + (filas > 1 ? (Math.floor(j / porFila) - (filas - 1) / 2) * 1.3 : 0)} estado={s.estado} nombre={s.nombre} hora={s.hora} nombres={nombres} onClick={() => onSeleccion({ zona: "agendas", id: s.id })} />
            ))}
          </group>
        )
      })}
    </group>
  )
}

// ── closers: una oficina amueblada por closer ───────────────────────────────────────────────────────────────

function Oficina({ c, x, z, onSeleccion, animar, nombres }: { c: CiudadVista["closers"][number]; x: number; z: number; onSeleccion: Props["onSeleccion"]; animar: boolean; nombres: boolean }) {
  const pantalla = useRef<THREE.MeshStandardMaterial>(null)
  const enLlamada = Boolean(c.en_horario)
  useFrame(({ clock }) => { if (pantalla.current && enLlamada && animar) pantalla.current.emissiveIntensity = 0.6 + Math.sin(clock.getElapsedTime() * 3) * 0.3 })
  const abrir = () => onSeleccion({ zona: "closers", id: c.nombre })
  return (
    <group>
      <group position={[x, 0, z]} onClick={(e) => { parar(e); abrir() }} onPointerOver={(e) => { e.stopPropagation(); cursor(true) }} onPointerOut={() => cursor(false)}>
        <Caja p={[0, 0.1, 0]} s={[3.4, 0.2, 3.4]} color="#F7F4FF" sombra={false} />
        <Caja p={[0, 1.25, -1.65]} s={[3.4, 2.1, 0.12]} color={BLANCO} />
        <Caja p={[-1.65, 1.25, 0]} s={[0.12, 2.1, 3.4]} color="#F0EBFF" />
        <Caja p={[0, 1.95, -1.58]} s={[3.4, 0.18, 0.04]} color="#405DE6" sombra={false} />
        {/* escritorio, monitor y sillas */}
        <Caja p={[0, 0.78, -0.55]} s={[1.7, 0.1, 0.8]} color="#D8CCF7" />
        <Caja p={[-0.75, 0.45, -0.55]} s={[0.08, 0.6, 0.7]} color="#C9BCF0" />
        <Caja p={[0.75, 0.45, -0.55]} s={[0.08, 0.6, 0.7]} color="#C9BCF0" />
        <mesh position={[0, 1.2, -0.25]} rotation={[0, Math.PI, 0]} castShadow>
          <boxGeometry args={[0.9, 0.55, 0.05]} />
          <meshStandardMaterial ref={pantalla} color="#2B2440" emissive={enLlamada ? "#E1306C" : "#5B51D8"} emissiveIntensity={enLlamada ? 0.7 : 0.15} />
        </mesh>
        <Caja p={[0, 0.45, -1.15]} s={[0.6, 0.1, 0.55]} color="#B9AEE6" />
        <Figura p={[0, 0.2, -1.1]} color="#405DE6" etiqueta={`${c.nombre}${c.en_equipo ? "" : " (no figura en el equipo)"}`} onClick={abrir} />
        {c.en_horario ? <Figura p={[0, 0.2, 0.45]} rot={Math.PI} color={COLOR_ESTADO.en_horario} etiqueta={`${c.en_horario.hora} · ${nombreVisible(c.en_horario.nombre, nombres)} (en horario)`} onClick={() => onSeleccion({ zona: "agendas", id: c.en_horario?.id })} /> : null}
        {/* planta */}
        <mesh position={[1.25, 0.4, -1.2]} castShadow><cylinderGeometry args={[0.22, 0.17, 0.4, 12]} /><meshStandardMaterial color="#E9D9C0" /></mesh>
        <mesh position={[1.25, 0.85, -1.2]} castShadow><sphereGeometry args={[0.34, 12, 10]} /><meshStandardMaterial color="#7FC8A9" /></mesh>
      </group>
      <Etiqueta p={[x, 2.9, z - 1.2]} chica onClick={abrir}>
        <span className={c.en_equipo ? "font-semibold" : "italic text-[#8A80AE]"}>{c.nombre.split(" ")[0]}</span> · <span className="tabular-nums">{c.llamadas}</span>
      </Etiqueta>
    </group>
  )
}

// ── suelo, agua y calles ────────────────────────────────────────────────────────────────────────────────────

function Suelo() {
  return (
    <group>
      <mesh position={[-23.5, -0.45, CINTA_Z]} receiveShadow>
        <boxGeometry args={[28, 0.5, 23]} />
        <meshStandardMaterial color={AGUA} roughness={0.25} metalness={0.05} transparent opacity={0.92} />
      </mesh>
      <Caja p={[13.5, -0.2, 0.5]} s={[47, 0.4, 39]} color={SUELO} sombra={false} />
      <Caja p={[6.5, 0.02, -4.4]} s={[31, 0.05, 1.3]} color={CALLE} sombra={false} />
      <Caja p={[13.5, 0.02, 15.2]} s={[45, 0.05, 1.3]} color={CALLE} sombra={false} />
      <Caja p={[21.6, 0.02, 5.4]} s={[1.3, 0.05, 20.4]} color={CALLE} sombra={false} />
      <Caja p={[28.5, 0.02, 3.6]} s={[13, 0.05, 1.3]} color={CALLE} sombra={false} />
    </group>
  )
}

// encuadre inicial: el zoom se ajusta una vez al tamaño del lienzo (después manda el usuario)
function Camara() {
  const size = useThree((s) => s.size)
  const hayControles = useThree((s) => Boolean(s.controls))
  const get = useThree((s) => s.get)
  const ajustada = useRef(false)
  useEffect(() => {
    const { camera, controls } = get()
    const cam = camera as THREE.OrthographicCamera
    const ctl = controls as unknown as { target: THREE.Vector3; update: () => void } | null
    if (ajustada.current || !size.width || !cam.isOrthographicCamera || !ctl) return
    ajustada.current = true
    if (size.width < 640) {
      // celular: arranca cerca, sobre el embudo (captación → agendas); las islas quedan a un arrastre
      const t = new THREE.Vector3(6, 0, 0)
      cam.position.set(t.x + CAM[0], CAM[1], t.z + CAM[2])
      ctl.target.copy(t)
      ctl.update()
      cam.zoom = size.width / 34
    } else {
      cam.zoom = Math.max(3, Math.min(size.width / 80, size.height / 46))
    }
    cam.updateProjectionMatrix()
  }, [size, hayControles, get])
  return null
}

// ── escena completa ─────────────────────────────────────────────────────────────────────────────────────────

function Ciudad({ datos, seleccion, onSeleccion, animar, nombres }: Props) {
  const islas = datos.islas.slice(0, LUGARES_ISLA.length)
  const destacadas = new Set([...islas].filter((i) => (i.semana || 0) > 0).sort((a, b) => (b.semana || 0) - (a.semana || 0)).slice(0, 4).map((i) => i.id))
  const segC = datos.seguimiento.lista.map((s) => ({ ...s, id: String(s.id) }))
  const nuevos = datos.clientes.lista.filter((c) => c.nuevo).map((c) => ({ ...c, id: String(c.id) }))
  const alumnos = datos.clientes.lista.map((c) => ({ ...c, id: String(c.id) }))
  const setters = datos.setters.equipo.map((s) => ({ ...s, id: s.nombre }))
  const caudal = (n: number | null) => (n ? Math.min(6, Math.max(1, Math.ceil(Math.log2(n + 1)))) : 0)

  return (
    <group>
      <Suelo />

      {/* cinta principal de ManyChat → Captación */}
      <Cinta puntos={[[-37, CINTA_Z], [-8.6, CINTA_Z]]} paquetes={Math.min(26, Math.max(3, Math.ceil(datos.captacion.semana / 50)))} color="#F3C3DA" colorPaquete="#E1306C" ancho={1.1} animar={animar} velocidad={2.2} onClick={() => onSeleccion({ zona: "captacion" })} />
      <Etiqueta p={[-34, 0.9, CINTA_Z]} chica onClick={() => onSeleccion({ zona: "captacion" })}>
        <span className="font-semibold text-[#C13584]">ManyChat</span> · {numero(datos.captacion.semana)} contactos en 7 días
      </Etiqueta>

      {/* islas de contenido y sus cintas */}
      {islas.map((isla, i) => {
        const l = LUGARES_ISLA[i]
        const haciaCinta = l.z < CINTA_Z ? CINTA_Z - 0.55 : CINTA_Z + 0.55
        const borde = l.z < CINTA_Z ? l.z + 1.4 : l.z - 1.4
        const activa = (isla.semana || 0) > 0
        return (
          <group key={isla.id}>
            <Cinta puntos={[[l.x, borde], [l.x, haciaCinta]]} paquetes={caudal(isla.semana)} color={activa ? "#E7D5F6" : "#E4E0EF"} colorPaquete={COLOR_ANGULO[isla.angulo || ""] || "#B8B0D8"} ancho={0.42} animar={animar && activa} velocidad={0.9} />
            <Isla isla={isla} x={l.x} z={l.z} sel={seleccion?.zona === "contenido" && seleccion.id === isla.id} conEtiqueta={destacadas.has(isla.id)} onSeleccion={onSeleccion} animar={animar} />
          </group>
        )
      })}
      {datos.islas.length > islas.length ? <Etiqueta p={[-36, 1.2, CINTA_Z + 11]} chica onClick={() => onSeleccion({ zona: "contenido" })}>+{datos.islas.length - islas.length} piezas en la lista</Etiqueta> : null}

      {/* fila de arriba */}
      <Edificio {...POS.captacion} h={3.4} techo={ZONAS.captacion.color} zona="captacion" titulo="Captación" valor={numero(datos.captacion.hoy)} detalle={`hoy · ayer ${numero(datos.captacion.ayer)} · 7 días ${numero(datos.captacion.semana)}`} seleccion={seleccion} onSeleccion={onSeleccion}>
        <Gente lista={datos.captacion.lista} total={datos.captacion.hoy} x={POS.captacion.x - 2.6} z={POS.captacion.z + 3.4} color="#E1306C" zona="captacion" onSeleccion={onSeleccion} nombres={nombres} max={14} cols={7} />
      </Edificio>
      <Edificio {...POS.espera} h={2.6} techo={ZONAS.espera.color} zona="espera" titulo="Sala de espera" valor={numero(datos.espera.total)} detalle="sin asignar ni agendar · 7 días" seleccion={seleccion} onSeleccion={onSeleccion}>
        <Caja p={[POS.espera.x, 0.35, POS.espera.z + 3.1]} s={[5.6, 0.12, 0.5]} color="#E8DDFB" />
        <Gente lista={datos.espera.lista} total={datos.espera.total} x={POS.espera.x - 2.6} z={POS.espera.z + 3.4} color="#F77737" zona="espera" onSeleccion={onSeleccion} nombres={nombres} max={14} cols={7} />
      </Edificio>
      <Edificio {...POS.setters} h={3.1} techo={ZONAS.setters.color} zona="setters" titulo="Setters" valor={numero(datos.setters.conversando.total)} detalle={`en conversación · ${datos.setters.equipo.filter((s) => s.en_equipo).length} setter(s) en el equipo`} seleccion={seleccion} onSeleccion={onSeleccion}>
        {setters.map((s, i) => (
          <group key={s.id}>
            <Caja p={[POS.setters.x - 2.4 + i * 1.6, 0.75, POS.setters.z + 3.0]} s={[1.2, 0.1, 0.6]} color="#D8CCF7" />
            <Figura p={[POS.setters.x - 2.4 + i * 1.6, 0.2, POS.setters.z + 2.5]} color={s.en_equipo ? "#C13584" : "#B8B0D8"} etiqueta={`${s.nombre} · ${s.agendas_7d} agendas en 7 días`} onClick={() => onSeleccion({ zona: "setters", id: s.id })} />
          </group>
        ))}
        <Gente lista={datos.setters.conversando.lista} total={datos.setters.conversando.total} x={POS.setters.x - 2.6} z={POS.setters.z + 4.2} color="#C13584" zona="setters" onSeleccion={onSeleccion} nombres={nombres} max={14} cols={7} />
      </Edificio>

      <Plaza datos={datos} seleccion={seleccion} onSeleccion={onSeleccion} nombres={nombres} />

      {/* fila de abajo */}
      {datos.closers.map((c, i) => (
        <Oficina key={c.nombre} c={c} x={OFICINAS.x0 + 2 + (i % 3) * OFICINAS.paso} z={OFICINAS.z + Math.floor(i / 3) * 5} onSeleccion={onSeleccion} animar={animar} nombres={nombres} />
      ))}
      <Etiqueta p={[OFICINAS.x0 + 7, 0.6, OFICINAS.z + 3.4]} chica onClick={() => onSeleccion({ zona: "closers" })}>
        <span className="font-semibold text-[#405DE6]">Closers</span> · {datos.closers.reduce((t, c) => t + c.llamadas, 0)} calls del día
      </Etiqueta>
      <Edificio {...POS.seguimiento} h={2.8} techo={ZONAS.seguimiento.color} zona="seguimiento" titulo="Seguimiento" valor={numero(datos.seguimiento.total)} detalle={`${datos.seguimiento.vencidos} con FUP vencido · ${datos.seguimiento.sin_fecha} sin fecha`} seleccion={seleccion} onSeleccion={onSeleccion}>
        <Gente lista={segC} total={datos.seguimiento.total} x={POS.seguimiento.x - 2.6} z={POS.seguimiento.z + 3.4} color="#B23A9E" colorDe={(s) => (s.vencido ? "#F77737" : s.proximo_fup ? "#405DE6" : "#B8B0D8")} zona="seguimiento" onSeleccion={onSeleccion} nombres={nombres} max={14} cols={7} />
      </Edificio>
      <Edificio {...POS.clientes} h={3.2} techo={ZONAS.clientes.color} zona="clientes" titulo="Clientes" valor={numero(datos.clientes.nuevos_30d)} detalle={`entraron en 30 días · ${datos.clientes.cuotas_vencidas.total} cuotas vencidas`} seleccion={seleccion} onSeleccion={onSeleccion}>
        <Gente lista={nuevos} total={datos.clientes.nuevos_30d} x={POS.clientes.x - 2.6} z={POS.clientes.z + 3.4} color="#22A37A" zona="clientes" onSeleccion={onSeleccion} nombres={nombres} max={14} cols={7} />
      </Edificio>
      <Edificio {...POS.formacion} h={3.6} w={7.5} techo={ZONAS.formacion.color} zona="formacion" titulo="Formación" valor={numero(datos.formacion.alumnos)} detalle={datos.formacion.disponible ? `${datos.formacion.con_actividad} con actividad` : "alumnos · actividad no disponible"} seleccion={seleccion} onSeleccion={onSeleccion}>
        <Gente lista={alumnos} total={datos.formacion.alumnos} x={POS.formacion.x - 2.6} z={POS.formacion.z + 3.4} color="#6D5DD3" zona="formacion" onSeleccion={onSeleccion} nombres={nombres} max={14} cols={7} />
      </Edificio>
    </group>
  )
}

export default function Escena(props: Props) {
  return (
    <Canvas shadows="percentage" dpr={[1, 2]} frameloop={props.animar ? "always" : "demand"} gl={{ antialias: true, alpha: true }} onPointerMissed={() => props.onSeleccion(null)}>
      <OrthographicCamera makeDefault position={[CAM[0] - 0.5, CAM[1], CAM[2]]} zoom={12} near={-500} far={1000} />
      <Camara />
      <MapControls makeDefault target={[-0.5, 0, 0]} enableRotate={false} zoomToCursor enableDamping dampingFactor={0.12} minZoom={4} maxZoom={70} screenSpacePanning />
      <ambientLight intensity={1.7} color="#F6F2FF" />
      <hemisphereLight args={["#FFFFFF", "#D9CCFF", 0.8]} />
      <directionalLight
        position={[30, 50, 22]} intensity={1.25} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-camera-near={1} shadow-camera-far={160} shadow-bias={-0.0005}
      />
      <Ciudad {...props} />
      <Tooltip />
    </Canvas>
  )
}
