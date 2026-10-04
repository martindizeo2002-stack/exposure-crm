"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import * as THREE from "three"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"
import { PALETA, cartel, diapositiva, flechas, holograma, marcoDegrade, tablero } from "./texturas"

// Modelos de la ciudad, todos procedurales y a la misma escala (una persona parada mide 1,7; un asiento está a 0,45;
// un escritorio a 0,75; una pared mide 3). Geometrías y materiales se comparten para no multiplicar memoria.

type V3 = [number, number, number]
export const PISO = 0.34          // altura del piso de las salas
export const ISLA_ALTO = 0.6      // altura de la superficie de las islas y las cintas

// ── cachés ────────────────────────────────────────────────────────────────────────────────────────────────
const geos = new Map<string, THREE.BufferGeometry>()
function geo<T extends THREE.BufferGeometry>(k: string, crear: () => T): T {
  let g = geos.get(k) as T | undefined
  if (!g) { g = crear(); geos.set(k, g) }
  return g
}
const rbox = (w: number, h: number, d: number, r = 0.08) => geo(`rb${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)))
const cyl = (rt: number, rb: number, h: number, s = 24) => geo(`cy${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s))
const cap = (r: number, l: number) => geo(`ca${r}|${l}`, () => new THREE.CapsuleGeometry(r, l, 5, 12))
const sph = (r: number) => geo(`sp${r}`, () => new THREE.SphereGeometry(r, 20, 16))
const hemi = (r: number) => geo(`he${r}`, () => new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.55))
const plano = (w: number, h: number) => geo(`pl${w}|${h}`, () => new THREE.PlaneGeometry(w, h))
const disco = (r: number) => geo(`di${r}`, () => new THREE.CircleGeometry(r, 32))
const anillo = (a: number, b: number) => geo(`an${a}|${b}`, () => new THREE.RingGeometry(a, b, 40))

const mats = new Map<string, THREE.Material>()
export function mat(color: string, rough = 0.8, o: { emissive?: string; ei?: number; opacity?: number; basica?: boolean } = {}) {
  const k = `${color}|${rough}|${o.emissive || ""}|${o.ei || 0}|${o.opacity ?? 1}|${o.basica ? 1 : 0}`
  let m = mats.get(k)
  if (!m) {
    const transp = o.opacity !== undefined && o.opacity < 1
    m = o.basica
      ? new THREE.MeshBasicMaterial({ color, transparent: transp, opacity: o.opacity ?? 1, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02, emissive: o.emissive || "#000000", emissiveIntensity: o.ei || 0, transparent: transp, opacity: o.opacity ?? 1, depthWrite: !transp })
    mats.set(k, m)
  }
  return m
}

function M({ g, m, p, r, s, sombra = true }: { g: THREE.BufferGeometry; m: THREE.Material; p?: V3; r?: V3; s?: V3 | number; sombra?: boolean }) {
  return <mesh geometry={g} material={m} position={p} rotation={r} scale={s} castShadow={sombra} receiveShadow />
}

// ── sombra de contacto ───────────────────────────────────────────────────────────────────────────────────
let texSombra: THREE.CanvasTexture | null = null
function sombraTex() {
  if (texSombra) return texSombra
  const c = document.createElement("canvas"); c.width = c.height = 128
  const g = c.getContext("2d") as CanvasRenderingContext2D
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 62)
  r.addColorStop(0, "rgba(40,30,90,0.55)"); r.addColorStop(0.55, "rgba(40,30,90,0.22)"); r.addColorStop(1, "rgba(40,30,90,0)")
  g.fillStyle = r; g.fillRect(0, 0, 128, 128)
  texSombra = new THREE.CanvasTexture(c)
  return texSombra
}
export function Sombra({ r = 0.5, sx = 1, sz = 1, y = 0.012, fuerza = 1 }: { r?: number; sx?: number; sz?: number; y?: number; fuerza?: number }) {
  const m = useMemo(() => new THREE.MeshBasicMaterial({ map: sombraTex(), transparent: true, depthWrite: false, opacity: fuerza, toneMapped: false }), [fuerza])
  return <mesh geometry={plano(2 * r, 2 * r)} material={m} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} scale={[sx, sz, 1]} renderOrder={1} />
}

// ── tooltip compartido ────────────────────────────────────────────────────────────────────────────────────
export type Tip = { p: V3; texto: string } | null
export const tipStore = (() => {
  let actual: Tip = null
  const subs = new Set<() => void>()
  return {
    get: () => actual,
    set: (t: Tip) => { actual = t; subs.forEach((f) => f()) },
    sub: (f: () => void) => { subs.add(f); return () => { subs.delete(f) } },
  }
})()
export function cursor(v: boolean) { if (typeof document !== "undefined") document.body.style.cursor = v ? "pointer" : "" }

export function interactivo(onClick?: () => void, tip?: string, alto = 2) {
  return {
    onClick: onClick ? (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick() } : undefined,
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation(); cursor(Boolean(onClick))
      if (tip) { const w = new THREE.Vector3(); e.eventObject.getWorldPosition(w); tipStore.set({ p: [w.x, w.y + alto, w.z], texto: tip }) }
    },
    onPointerOut: () => { cursor(false); tipStore.set(null) },
  }
}

// ── personas ──────────────────────────────────────────────────────────────────────────────────────────────
export type Pose = "parado" | "caminando" | "presentando" | "sentado" | "trabajando" | "conversando" | "dormido"
const PIEL = "#F0CDB9"
const ROPAS = ["#7550EF", "#E94ACB", "#527BEA", "#FFFFFF", "#FF8A70", "#9B87F5", "#4FB3C9"]
const PELOS = ["#2B2133", "#4A3426", "#7A5A3A", "#1E1E2A", "#5B3B5E"]
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }
export const ropaDe = (id: string) => ROPAS[hash(id) % ROPAS.length]
export const peloDe = (id: string) => PELOS[hash(id + "p") % PELOS.length]

export function Persona({ p, rot = 0, pose = "parado", ropa, pantalon = "#2B2F6B", pelo = "#2B2133", asiento = 0.45, onClick, tip, seleccionada, atenuada, zz }: {
  p: V3; rot?: number; pose?: Pose; ropa: string; pantalon?: string; pelo?: string; asiento?: number
  onClick?: () => void; tip?: string; seleccionada?: boolean; atenuada?: boolean; zz?: boolean
}) {
  const sentado = pose !== "parado" && pose !== "caminando" && pose !== "presentando"
  const hipY = sentado ? asiento + 0.07 : 0.84
  const op = atenuada ? { opacity: 0.45 } : {}
  const mRopa = mat(ropa, 0.85, op), mPant = mat(pantalon, 0.85, op), mPiel = mat(PIEL, 0.7, op), mPelo = mat(pelo, 0.9, op), mZap = mat("#20265F", 0.6, op)
  const piernas = (lado: number) => {
    let muslo = 0, rodilla = 0
    if (sentado) { muslo = -Math.PI / 2; rodilla = Math.PI / 2 }
    else if (pose === "caminando") { muslo = lado * 0.42; rodilla = lado > 0 ? 0.35 : 0.05 }
    return { muslo, rodilla }
  }
  const brazo = (lado: number): [number, number] => {
    switch (pose) {
      case "caminando": return [lado * -0.38, 0.06]
      case "sentado": return [-0.45, 0.1]
      case "trabajando": return [-1.15, 0.04]
      case "conversando": return lado > 0 ? [-0.95, 0.28] : [-0.4, 0.1]
      case "dormido": return [-0.35, 0.05]
      case "presentando": return lado > 0 ? [-1.25, 0.55] : [0, 0.1]
      default: return [0, 0.1]
    }
  }
  const torso = pose === "trabajando" ? 0.1 : pose === "dormido" ? 0.38 : sentado ? -0.06 : 0
  const cabeza = pose === "dormido" ? 0.5 : 0
  return (
    <group position={p} rotation={[0, rot, 0]} {...interactivo(onClick, tip, sentado ? 1.6 : 2)}>
      {sentado ? null : <Sombra r={0.42} fuerza={0.9} />}
      <group position={[0, hipY, sentado ? -0.12 : 0]}>
        {[-1, 1].map((lado) => {
          const { muslo, rodilla } = piernas(lado)
          return (
            <group key={lado} position={[lado * 0.1, 0, 0]} rotation={[muslo, 0, 0]}>
              <M g={cap(0.085, 0.26)} m={mPant} p={[0, -0.21, 0]} />
              <group position={[0, -0.42, 0]} rotation={[rodilla, 0, 0]}>
                <M g={cap(0.072, 0.28)} m={mPant} p={[0, -0.21, 0]} />
                <M g={rbox(0.15, 0.09, 0.26, 0.04)} m={mZap} p={[0, -0.4, 0.05]} />
              </group>
            </group>
          )
        })}
        <group rotation={[torso, 0, 0]}>
          <M g={cap(0.2, 0.2)} m={mRopa} p={[0, 0.29, 0]} s={[1.08, 1, 0.78]} />
          {[-1, 1].map((lado) => {
            const [bx, bz] = brazo(lado)
            return (
              <group key={lado} position={[lado * 0.26, 0.5, 0]} rotation={[bx, 0, lado * bz]}>
                <M g={cap(0.062, 0.36)} m={mRopa} p={[0, -0.22, 0]} />
                <M g={sph(0.062)} m={mPiel} p={[0, -0.45, 0]} />
              </group>
            )
          })}
          <group position={[0, 0.66, 0]} rotation={[cabeza, 0, 0]}>
            <M g={cap(0.06, 0.06)} m={mPiel} p={[0, 0.0, 0]} />
            <M g={sph(0.165)} m={mPiel} p={[0, 0.17, 0]} />
            <M g={hemi(0.172)} m={mPelo} p={[0, 0.2, -0.012]} />
          </group>
        </group>
      </group>
      {seleccionada ? <mesh geometry={anillo(0.42, 0.56)} material={mat(PALETA.violeta, 0.5, { basica: true, opacity: 0.85 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} /> : null}
      {zz ? <Zz /> : null}
    </group>
  )
}

function Zz() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = 1.75 + Math.sin(clock.getElapsedTime() * 1.5) * 0.06 })
  const t = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 128; c.height = 128
    const g = c.getContext("2d") as CanvasRenderingContext2D
    g.fillStyle = PALETA.violeta; g.font = "800 64px system-ui"; g.fillText("z", 20, 100); g.font = "800 44px system-ui"; g.fillText("z", 66, 60)
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx
  }, [])
  return (
    <group ref={ref} position={[0.35, 1.75, 0]} rotation={[0, Math.PI / 4, 0]}>
      <mesh geometry={plano(0.5, 0.5)}><meshBasicMaterial map={t} transparent toneMapped={false} /></mesh>
    </group>
  )
}

// ── muebles ───────────────────────────────────────────────────────────────────────────────────────────────
export function Sillon({ p, rot = 0, color = "#F6F3FF", acento, onClick, tip }: { p: V3; rot?: number; color?: string; acento?: string; onClick?: () => void; tip?: string }) {
  const m = mat(color, 0.9), a = mat(acento || color, 0.9)
  return (
    <group position={p} rotation={[0, rot, 0]} {...interactivo(onClick, tip, 1.4)}>
      <Sombra r={0.72} sx={1.05} sz={0.95} />
      <M g={rbox(0.96, 0.3, 0.86, 0.1)} m={m} p={[0, 0.17, 0]} />
      <M g={rbox(0.66, 0.15, 0.7, 0.07)} m={a} p={[0, 0.38, 0.05]} />
      <M g={rbox(0.96, 0.56, 0.22, 0.1)} m={m} p={[0, 0.6, -0.32]} />
      <M g={rbox(0.17, 0.38, 0.86, 0.08)} m={m} p={[-0.395, 0.46, 0]} />
      <M g={rbox(0.17, 0.38, 0.86, 0.08)} m={m} p={[0.395, 0.46, 0]} />
    </group>
  )
}

export function Sofa({ p, rot = 0, plazas = 3, color = "#F6F3FF", acento }: { p: V3; rot?: number; plazas?: number; color?: string; acento?: string }) {
  const w = 0.72 * plazas + 0.34
  const m = mat(color, 0.9), a = mat(acento || color, 0.9)
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Sombra r={w / 2 + 0.25} sz={0.55} />
      <M g={rbox(w, 0.3, 0.9, 0.1)} m={m} p={[0, 0.17, 0]} />
      {Array.from({ length: plazas }, (_, i) => <M key={i} g={rbox(0.68, 0.15, 0.72, 0.07)} m={a} p={[-w / 2 + 0.17 + 0.36 + i * 0.72, 0.38, 0.06]} />)}
      <M g={rbox(w, 0.58, 0.24, 0.1)} m={m} p={[0, 0.6, -0.33]} />
      <M g={rbox(0.17, 0.4, 0.9, 0.08)} m={m} p={[-w / 2 + 0.085, 0.47, 0]} />
      <M g={rbox(0.17, 0.4, 0.9, 0.08)} m={m} p={[w / 2 - 0.085, 0.47, 0]} />
    </group>
  )
}

export function MesaRedonda({ p, r = 0.48 }: { p: V3; r?: number }) {
  return (
    <group position={p}>
      <Sombra r={r + 0.15} />
      <M g={cyl(r, r, 0.05, 32)} m={mat("#FFFFFF", 0.5)} p={[0, 0.73, 0]} />
      <M g={cyl(0.05, 0.05, 0.68, 12)} m={mat("#D9D2F2", 0.6)} p={[0, 0.37, 0]} />
      <M g={cyl(0.26, 0.28, 0.04, 24)} m={mat("#D9D2F2", 0.6)} p={[0, 0.02, 0]} />
    </group>
  )
}

export function MesaBaja({ p, r = 0.4, flor }: { p: V3; r?: number; flor?: boolean }) {
  return (
    <group position={p}>
      <M g={cyl(r, r, 0.07, 32)} m={mat("#FFFFFF", 0.5)} p={[0, 0.4, 0]} />
      <M g={cyl(0.06, 0.08, 0.36, 12)} m={mat("#D9D2F2", 0.6)} p={[0, 0.2, 0]} />
      {flor ? <><M g={cyl(0.06, 0.05, 0.14, 12)} m={mat("#FFFFFF", 0.6)} p={[0, 0.5, 0]} /><M g={sph(0.1)} m={mat("#F49AD8", 0.8)} p={[0, 0.62, 0]} /></> : null}
    </group>
  )
}

export function Escritorio({ p, rot = 0, encendido = false }: { p: V3; rot?: number; encendido?: boolean }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Sombra r={0.85} sz={0.6} />
      <M g={rbox(1.3, 0.06, 0.66, 0.03)} m={mat("#FFFFFF", 0.55)} p={[0, 0.75, 0]} />
      <M g={rbox(0.06, 0.72, 0.6, 0.03)} m={mat("#E2DCF6", 0.7)} p={[-0.6, 0.37, 0]} />
      <M g={rbox(0.06, 0.72, 0.6, 0.03)} m={mat("#E2DCF6", 0.7)} p={[0.6, 0.37, 0]} />
      <M g={rbox(0.05, 0.22, 0.05, 0.02)} m={mat("#C9C0EC", 0.6)} p={[0, 0.89, -0.2]} />
      <M g={rbox(0.66, 0.42, 0.05, 0.03)} m={mat("#2A2650", 0.5)} p={[0, 1.12, -0.22]} />
      <mesh geometry={plano(0.6, 0.36)} material={mat(encendido ? "#8FA6FF" : "#3A3570", 0.5, { emissive: encendido ? "#6C82FF" : "#000000", ei: encendido ? 0.6 : 0 })} position={[0, 1.12, -0.193]} />
      <M g={rbox(0.42, 0.02, 0.14, 0.01)} m={mat("#E9E4FA", 0.6)} p={[0, 0.79, 0.08]} />
    </group>
  )
}

export function SillaOficina({ p, rot = 0, color = "#7550EF" }: { p: V3; rot?: number; color?: string }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <M g={rbox(0.5, 0.09, 0.48, 0.04)} m={mat(color, 0.85)} p={[0, 0.46, 0]} />
      <M g={rbox(0.48, 0.5, 0.08, 0.04)} m={mat(color, 0.85)} p={[0, 0.78, -0.22]} />
      <M g={cyl(0.035, 0.035, 0.36, 10)} m={mat("#B8AEDF", 0.5)} p={[0, 0.25, 0]} />
      <M g={cyl(0.24, 0.26, 0.05, 20)} m={mat("#B8AEDF", 0.5)} p={[0, 0.04, 0]} />
    </group>
  )
}

export function SillaAula({ p, rot = 0, color = "#9B87F5" }: { p: V3; rot?: number; color?: string }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <M g={rbox(0.5, 0.08, 0.46, 0.04)} m={mat("#FFFFFF", 0.7)} p={[0, 0.45, 0]} />
      <M g={rbox(0.5, 0.42, 0.07, 0.04)} m={mat(color, 0.85)} p={[0, 0.72, -0.21]} />
      {[-0.2, 0.2].map((x) => <M key={x} g={rbox(0.05, 0.43, 0.42, 0.02)} m={mat("#D9D2F2", 0.6)} p={[x, 0.21, 0]} />)}
    </group>
  )
}

export function Planta({ p, escala = 1 }: { p: V3; escala?: number }) {
  return (
    <group position={p} scale={escala}>
      <Sombra r={0.42} />
      <M g={cyl(0.24, 0.19, 0.42, 20)} m={mat("#FFFFFF", 0.6)} p={[0, 0.21, 0]} />
      <M g={sph(0.3)} m={mat("#6FBF8E", 0.9)} p={[0, 0.62, 0]} />
      <M g={sph(0.22)} m={mat("#5AAE7E", 0.9)} p={[0.16, 0.78, 0.05]} />
      <M g={sph(0.2)} m={mat("#7DCC9B", 0.9)} p={[-0.14, 0.82, -0.04]} />
    </group>
  )
}

export function Arbol({ p, escala = 1 }: { p: V3; escala?: number }) {
  return (
    <group position={p} scale={escala}>
      <Sombra r={0.85} />
      <M g={rbox(0.9, 0.46, 0.9, 0.1)} m={mat("#FFFFFF", 0.6)} p={[0, 0.23, 0]} />
      <M g={cyl(0.07, 0.09, 1.1, 10)} m={mat("#9C7A63", 0.9)} p={[0, 0.95, 0]} />
      <M g={sph(0.55)} m={mat("#6FBF8E", 0.9)} p={[0, 1.75, 0]} />
      <M g={sph(0.42)} m={mat("#5AAE7E", 0.9)} p={[0.32, 1.55, 0.12]} />
      <M g={sph(0.4)} m={mat("#7DCC9B", 0.9)} p={[-0.3, 1.6, -0.1]} />
      <M g={sph(0.36)} m={mat("#64B786", 0.9)} p={[0.05, 2.2, 0.05]} />
    </group>
  )
}

// ── arquitectura ──────────────────────────────────────────────────────────────────────────────────────────
// Sala abierta: base, piso, pared de fondo (-z) y pared izquierda (-x); el frente (+z) y el lado derecho (+x) quedan
// abiertos hacia la cámara. Los hijos se ubican sobre el piso (y = 0 es el piso).
export function Sala({ p, w, d, alto = 3, paredDer = 0, colorPared = "#F7F4FF", sel, onClick, children }: {
  p: V3; w: number; d: number; alto?: number; paredDer?: number; colorPared?: string; sel?: boolean; onClick?: () => void; children?: ReactNode
}) {
  const borde = sel ? mat(PALETA.violeta, 0.5, { emissive: PALETA.violeta, ei: 0.35 }) : mat("#E4DEF7", 0.85)
  return (
    <group position={p}>
      <group {...interactivo(onClick)}>
        <M g={rbox(w + 0.5, 0.2, d + 0.5, 0.1)} m={borde} p={[0, 0.1, 0]} />
        <M g={rbox(w, 0.16, d, 0.07)} m={mat("#FFFBF8", 0.8)} p={[0, PISO - 0.08, 0]} />
        <M g={rbox(w, alto, 0.26, 0.11)} m={mat(colorPared, 0.75)} p={[0, PISO + alto / 2, -d / 2 + 0.13]} />
        <M g={rbox(0.26, alto, d, 0.11)} m={mat("#EFEAFD", 0.75)} p={[-w / 2 + 0.13, PISO + alto / 2, 0]} />
        {paredDer > 0 ? <M g={rbox(0.26, alto, paredDer, 0.11)} m={mat("#EFEAFD", 0.75)} p={[w / 2 - 0.13, PISO + alto / 2, -d / 2 + paredDer / 2]} /> : null}
        {/* zócalo y ventanas en la pared izquierda */}
        <M g={rbox(w - 0.3, 0.12, 0.05, 0.03)} m={mat("#E3DCFA", 0.7)} p={[0, PISO + alto - 0.35, -d / 2 + 0.28]} sombra={false} />
        {alto > 2.2 ? Array.from({ length: Math.max(1, Math.floor(d / 2)) }, (_, i) => {
          const n = Math.max(1, Math.floor(d / 2))
          return <M key={i} g={rbox(0.05, alto * 0.42, (d - 0.8) / n - 0.35, 0.03)} m={mat("#DCEBFF", 0.3)} p={[-w / 2 + 0.28, PISO + alto * 0.55, -d / 2 + 0.4 + ((d - 0.8) / n) * (i + 0.5)]} sombra={false} />
        }) : null}
      </group>
      <group position={[0, PISO, 0]}>{children}</group>
    </group>
  )
}

// Cartel de área: mira a la cámara para que se lea; se monta arriba de la pared de fondo.
export function Cartel({ p, titulo, contador, alto = 1.8, onClick, giro = Math.PI / 4 }: { p: V3; titulo: string; contador?: string | null; alto?: number; onClick?: () => void; giro?: number }) {
  const { tex, aspecto } = useMemo(() => cartel(titulo, contador), [titulo, contador])
  const w = alto * aspecto
  return (
    <group position={p} rotation={[0, giro, 0]} {...interactivo(onClick)}>
      <M g={rbox(w + 0.12, alto + 0.12, 0.14, Math.min(0.3, alto / 2.4))} m={mat("#4B32C8", 0.6)} p={[0, 0, -0.08]} />
      <mesh geometry={plano(w, alto)} position={[0, 0, 0.005]}>
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </group>
  )
}

// Portal de captación: arco curvo con borde de luz; la cinta entra por el medio (eje z).
export function Portal({ p, sel, onClick, children }: { p: V3; sel?: boolean; onClick?: () => void; children?: ReactNode }) {
  const R = 2.3
  return (
    <group position={p}>
      <group {...interactivo(onClick)}>
        <M g={rbox(7.4, 0.2, 6.2, 0.1)} m={sel ? mat(PALETA.violeta, 0.5, { emissive: PALETA.violeta, ei: 0.35 }) : mat("#E4DEF7", 0.85)} p={[0, 0.1, -0.6]} />
        <M g={rbox(6.9, 0.16, 5.7, 0.07)} m={mat("#FFFBF8", 0.8)} p={[0, PISO - 0.08, -0.6]} />
        {[-1, 1].map((l) => <M key={l} g={rbox(0.95, 2.9, 1.5, 0.3)} m={mat("#FFFFFF", 0.7)} p={[l * R, PISO + 1.45, 0.4]} />)}
        <mesh geometry={geo("arco", () => new THREE.TorusGeometry(R, 0.48, 18, 48, Math.PI))} material={mat("#FFFFFF", 0.7)} position={[0, PISO + 2.9, 0.4]} scale={[1, 1, 1.55]} castShadow />
        <mesh geometry={geo("arcoLuz", () => new THREE.TorusGeometry(R - 0.42, 0.07, 10, 48, Math.PI))} material={mat("#F2B8FF", 0.4, { emissive: "#D86BFF", ei: 1.1 })} position={[0, PISO + 2.9, 1.15]} />
        {[-1, 1].map((l) => <M key={l} g={rbox(0.12, 2.9, 0.12, 0.05)} m={mat("#F2B8FF", 0.4, { emissive: "#B46BFF", ei: 1.1 })} p={[l * (R - 0.42), PISO + 1.45, 1.15]} sombra={false} />)}
      </group>
      <group position={[0, PISO, 0]}>{children}</group>
    </group>
  )
}

// Pabellón de clientes: volumen blanco con frente de vidrio y entrada marcada.
export function Pabellon({ p, w = 6.6, d = 6, alto = 3.8, sel, onClick, children }: { p: V3; w?: number; d?: number; alto?: number; sel?: boolean; onClick?: () => void; children?: ReactNode }) {
  const vidrio = mat("#D9D0FF", 0.15, { opacity: 0.32 })
  const marco = mat("#FFFFFF", 0.6)
  return (
    <group position={p}>
      <group {...interactivo(onClick)}>
        <M g={rbox(w + 1.4, 0.2, d + 1.6, 0.1)} m={sel ? mat(PALETA.violeta, 0.5, { emissive: PALETA.violeta, ei: 0.35 }) : mat("#E4DEF7", 0.85)} p={[0, 0.1, 0.3]} />
        <M g={rbox(w, 0.16, d, 0.07)} m={mat("#FFFBF8", 0.8)} p={[0, PISO - 0.08, 0]} />
        <M g={rbox(w, alto, 0.3, 0.12)} m={mat("#F7F4FF", 0.75)} p={[0, PISO + alto / 2, -d / 2 + 0.15]} />
        <M g={rbox(0.3, alto, d, 0.12)} m={mat("#EFEAFD", 0.75)} p={[-w / 2 + 0.15, PISO + alto / 2, 0]} />
        <M g={rbox(w + 0.6, 0.42, d + 0.6, 0.16)} m={mat("#FFFFFF", 0.7)} p={[0, PISO + alto + 0.21, 0.1]} />
        <M g={rbox(w + 0.64, 0.12, d + 0.64, 0.05)} m={mat(PALETA.violeta, 0.5)} p={[0, PISO + alto + 0.02, 0.1]} sombra={false} />
        {/* frente (+z) y lateral (+x) de vidrio con parantes */}
        <mesh geometry={plano(w - 0.3, alto)} material={vidrio} position={[0, PISO + alto / 2, d / 2]} />
        <mesh geometry={plano(d - 0.3, alto)} material={vidrio} position={[w / 2, PISO + alto / 2, 0]} rotation={[0, Math.PI / 2, 0]} />
        {[-0.5, -0.17, 0.17, 0.5].map((f) => <M key={f} g={rbox(0.14, alto, 0.14, 0.05)} m={marco} p={[f * (w - 0.3), PISO + alto / 2, d / 2]} />)}
        {[-0.5, 0, 0.5].map((f) => <M key={f} g={rbox(0.14, alto, 0.14, 0.05)} m={marco} p={[w / 2, PISO + alto / 2, f * (d - 0.3)]} />)}
        {/* entrada */}
        <M g={rbox(1.9, 2.5, 0.22, 0.08)} m={mat(PALETA.rosa, 0.5, { emissive: PALETA.rosa, ei: 0.15 })} p={[0, PISO + 1.25, d / 2 + 0.05]} />
        <M g={rbox(1.5, 2.3, 0.24, 0.06)} m={mat("#EDE6FF", 0.3)} p={[0, PISO + 1.15, d / 2 + 0.06]} />
        <M g={rbox(2.6, 0.18, 1.2, 0.06)} m={mat("#FFFFFF", 0.7)} p={[0, 0.1, d / 2 + 0.75]} />
      </group>
      <group position={[0, PISO, 0]}>{children}</group>
    </group>
  )
}

// Pantalla del aula y tablero de la oficina, colgados de la pared de fondo.
export function PantallaAula({ p, w = 3 }: { p: V3; w?: number }) {
  const t = useMemo(() => diapositiva(), [])
  const h = w / (512 / 300)
  return (
    <group position={p}>
      <M g={rbox(w + 0.16, h + 0.16, 0.08, 0.05)} m={mat("#2A2650", 0.5)} />
      <mesh geometry={plano(w, h)} position={[0, 0, 0.05]}><meshBasicMaterial map={t} toneMapped={false} /></mesh>
    </group>
  )
}
export function Tablero({ p, w = 2.2 }: { p: V3; w?: number }) {
  const t = useMemo(() => tablero(), [])
  const h = w / (400 / 240)
  return (
    <group position={p}>
      <M g={rbox(w + 0.12, h + 0.12, 0.06, 0.04)} m={mat("#E3DCFA", 0.6)} />
      <mesh geometry={plano(w, h)} position={[0, 0, 0.035]}><meshBasicMaterial map={t} toneMapped={false} /></mesh>
    </group>
  )
}

// ── islas, hologramas y cintas ────────────────────────────────────────────────────────────────────────────
export function Holograma({ titulo, formato, fecha, color, imagen, p, onClick, tip }: {
  titulo: string; formato: string; fecha: string; color: string; imagen?: string | null; p: V3; onClick?: () => void; tip?: string
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!imagen) return
    let vivo = true
    const i = new Image()
    i.crossOrigin = "anonymous"
    i.onload = () => { if (vivo) setImg(i) }
    i.src = imagen
    return () => { vivo = false }
  }, [imagen])
  const tex = useMemo(() => holograma({ titulo, formato, fecha, color, imagen: imagen ? img : null }), [titulo, formato, fecha, color, imagen, img])
  const marco = useMemo(() => marcoDegrade(), [])
  const W = 2.6, H = 3.05
  return (
    <group position={p} rotation={[0, Math.PI / 4, 0]} {...interactivo(onClick, tip, 3.6)}>
      <mesh geometry={plano(W + 0.7, H + 0.7)} position={[0, 0, -0.12]}>
        <meshBasicMaterial color="#C9A8FF" transparent opacity={0.22} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh geometry={rbox(W + 0.22, H + 0.22, 0.1, 0.12)} position={[0, 0, -0.05]} castShadow>
        <meshBasicMaterial map={marco} toneMapped={false} />
      </mesh>
      <mesh geometry={plano(W, H)} position={[0, 0, 0.006]}>
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Isla({ p, w = 4.8, d = 4.2, sel, onClick, children }: { p: V3; w?: number; d?: number; sel?: boolean; onClick?: () => void; children?: ReactNode }) {
  return (
    <group position={p}>
      <group {...interactivo(onClick)}>
        <M g={rbox(w + 0.3, 0.5, d + 0.3, 0.22)} m={mat("#E2DBF7", 0.85)} p={[0, -0.05, 0]} />
        <M g={rbox(w, 0.5, d, 0.22)} m={sel ? mat("#F3EEFF", 0.6, { emissive: PALETA.violeta, ei: 0.12 }) : mat("#FCFBFF", 0.75)} p={[0, ISLA_ALTO - 0.25, 0]} />
      </group>
      <group position={[0, ISLA_ALTO, 0]}>{children}</group>
    </group>
  )
}

// Cinta: tramo recto con superficie, dos bordes, flechas y pilares sobre el agua.
export function Cinta({ desde, hasta, ancho = 1.2, y = ISLA_ALTO, pilares = true, onClick }: { desde: [number, number]; hasta: [number, number]; ancho?: number; y?: number; pilares?: boolean; onClick?: () => void }) {
  const dx = hasta[0] - desde[0], dz = hasta[1] - desde[1]
  const largo = Math.hypot(dx, dz)
  const ang = Math.atan2(-dz, dx)
  const tex = useMemo(() => {
    const t = flechas().clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(Math.max(1, Math.round(largo / (ancho * 0.9))), 1)
    t.needsUpdate = true
    return t
  }, [largo, ancho])
  const cx = (desde[0] + hasta[0]) / 2, cz = (desde[1] + hasta[1]) / 2
  return (
    <group position={[cx, 0, cz]} rotation={[0, ang, 0]} {...interactivo(onClick)}>
      <M g={rbox(largo, 0.24, ancho, 0.08)} m={mat("#6A50E0", 0.6)} p={[0, y - 0.14, 0]} />
      <mesh geometry={plano(largo, ancho * 0.72)} rotation={[-Math.PI / 2, 0, 0]} position={[0, y - 0.015, 0]} receiveShadow>
        <meshStandardMaterial map={tex} roughness={0.6} />
      </mesh>
      {[-1, 1].map((l) => <M key={l} g={rbox(largo, 0.14, 0.13, 0.05)} m={mat("#B9A8FF", 0.6)} p={[0, y + 0.03, l * (ancho / 2 - 0.065)]} />)}
      {pilares ? Array.from({ length: Math.max(1, Math.floor(largo / 3.2)) }, (_, i) => {
        const n = Math.max(1, Math.floor(largo / 3.2))
        return <M key={i} g={cyl(0.13, 0.13, 1.1, 12)} m={mat("#DCD4F6", 0.7)} p={[-largo / 2 + (largo / (n + 1)) * (i + 1), y - 0.75, 0]} />
      }) : null}
    </group>
  )
}

export { disco }
