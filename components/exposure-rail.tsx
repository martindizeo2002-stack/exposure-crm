"use client"

/* ══ RAÍL — negro mate, el único bloque oscuro del producto ══════════
   El patrón de navegación de Exposure OS aplicado a los módulos del CRM:
   grupos con etiqueta chica en mayúsculas, ítem activo con barrita dorada,
   la marca arriba y la cuenta abajo. Solo en escritorio (≥ 900px); en el
   celular sigue el header con el cajón lateral de crm-navigation. */

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut, Palette, Search, Settings2, UsersRound } from "lucide-react"
import { createSupabaseBrowser } from "@/lib/supabase-browser"
import { Mark } from "@/components/exposure/ui"
import { GROUP_ORDER, groupColors, isActive, modules, type NavItem } from "@/components/crm-navigation"

const GOLD = "#dec27c"

export function ExposureRail({ rol = "", nombre = "", email = "" }: { rol?: string; nombre?: string; email?: string }) {
  const pathname = usePathname()
  const visible = modules.filter((item) => !item.roles || item.roles.includes(rol))
  const groups = GROUP_ORDER.map((label) => ({ label, items: visible.filter((i) => i.group === label) })).filter((g) => g.items.length)
  const isManager = rol === "CEO" || rol === "Contaduria"

  async function logout() {
    await createSupabaseBrowser().auth.signOut()
    window.location.href = "/login"
  }
  const abrirBusqueda = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
  const abrirAjustes = () => window.dispatchEvent(new CustomEvent("crm:open-settings"))

  return (
    <aside
      className="exposure-rail hidden min-[900px]:flex fixed inset-y-0 left-0 z-40 w-[250px] flex-col"
      style={{
        background: "linear-gradient(180deg,#171717 0%,#131313 55%,#101010 100%)",
        boxShadow: "1px 0 0 rgba(0,0,0,0.16), 14px 0 44px rgba(20,16,8,0.10)",
        color: "#c8c4bc",
      }}
    >
      <Link href="/" className="flex items-center gap-2.5 px-5 flex-none" style={{ height: 76 }}>
        <Mark size={32} />
        <span className="min-w-0">
          <span className="block text-[15px] leading-none" style={{ fontWeight: 600, letterSpacing: "-0.02em", color: "#f7f5f0" }}>
            Exposure OS
          </span>
          <span className="block mt-[7px] text-[11px] leading-none" style={{ color: "#8b877f" }}>
            CRM · Sistema operativo
          </span>
        </span>
      </Link>

      <button
        type="button"
        onClick={abrirBusqueda}
        className="mx-3 mb-2 flex items-center gap-2 rounded-[10px] px-3 text-left transition-colors"
        style={{ height: 34, background: "rgba(255,255,255,0.045)", color: "#a19d95" }}
      >
        <Search size={14} strokeWidth={1.9} style={{ color: "#7d7972" }} />
        <span className="text-[12.5px] flex-1 truncate">Buscar cliente, agenda, pago…</span>
        <span className="mono text-[10.5px]" style={{ color: "#6f6b64" }}>⌘K</span>
      </button>

      <nav className="scroll flex-1 min-h-0 px-3 pb-3">
        {groups.map((g) => (
          <div key={g.label} className="pt-4">
            <div className="lbl px-3 pb-2" style={{ color: groupColors[g.label] ?? "#6f6b64", opacity: 0.9 }}>
              {g.label}
            </div>
            {g.items.map((item) => (
              <RailItem key={item.href} item={item} on={isActive(item, pathname)} />
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto p-3 flex-none">
        <div className="rounded-[12px] px-3.5 py-3" style={{ background: "rgba(255,255,255,0.045)" }}>
          <div className="flex items-center gap-2.5">
            <span
              className="grid place-items-center flex-none text-[12px]"
              style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(160deg,#2a2419,#141414)", color: GOLD, fontWeight: 600, boxShadow: "0 0 0 1px rgba(200,169,93,0.35)" }}
            >
              {(nombre || email || "U").charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] leading-none truncate" style={{ fontWeight: 520, color: "#f7f5f0" }}>{nombre || email}</span>
              <span className="block mt-[6px] text-[11px] leading-none truncate" style={{ color: "#8b877f" }}>{rol || "Sin rol"}</span>
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {isManager && <RailMini href="/reglas" icon={<Settings2 size={13} />} label="Reglas" />}
            {rol === "CEO" && <RailMini href="/accesos" icon={<UsersRound size={13} />} label="Accesos" />}
            <RailMini onClick={abrirAjustes} icon={<Palette size={13} />} label="Ajustes" />
            <RailMini onClick={logout} icon={<LogOut size={13} />} label="Salir" tone="warn" />
          </div>
        </div>
      </div>
    </aside>
  )
}

function RailItem({ item, on }: { item: NavItem; on: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={on ? "page" : undefined}
      className="relative flex w-full items-center gap-2.5 rounded-[10px] pl-3.5 pr-2.5 mb-[3px] transition-colors duration-150 hover:bg-white/[.03]"
      style={{ height: 36, background: on ? "rgba(255,255,255,0.055)" : undefined, color: on ? "#f7f5f0" : "#a19d95" }}
    >
      {on && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2"
          style={{ width: 2.5, height: 17, borderRadius: 99, background: GOLD, boxShadow: "0 0 12px rgba(222,194,124,0.6)" }}
        />
      )}
      <Icon size={15} strokeWidth={1.8} style={{ color: on ? GOLD : "#7d7972", flex: "none" }} />
      <span className="text-[13px] truncate" style={{ fontWeight: on ? 520 : 450 }}>{item.label}</span>
    </Link>
  )
}

function RailMini({ href, onClick, icon, label, tone }: { href?: string; onClick?: () => void; icon: React.ReactNode; label: string; tone?: "warn" }) {
  const cls = "flex items-center justify-center gap-1.5 rounded-[8px] text-[11.5px] transition-colors hover:bg-white/[.06]"
  const style = { height: 30, color: tone === "warn" ? "#e5a4a4" : "#c8c4bc", background: "rgba(255,255,255,0.035)", fontWeight: 500 }
  return href ? (
    <Link href={href} className={cls} style={style}>{icon}{label}</Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} style={style}>{icon}{label}</button>
  )
}
