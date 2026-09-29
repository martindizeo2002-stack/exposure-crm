# -*- coding: utf-8 -*-
"""
radar-capturas.py — captura de pantalla de cada historia de las cuentas que sigue el Radar.

Abre Chrome con un perfil propio (logueado una vez en Instagram), recorre las historias activas de cada
cuenta con "historias" prendido en Radar → Semillas y saca una captura de cada una. Las nuevas se suben
al Radar (bucket "radar", tabla radar_historias) y quedan en la pestaña Historias; Claude las lee en la
pasada siguiente (texto en pantalla, tipo de historia, CTA y keyword). Una copia queda además en
Central Negocio/datos/radar-capturas/AAAA-MM-DD/<cuenta>/.

Corre dos veces por día con la tarea de Windows "EXPOSURE - Radar capturas" (radar-capturas-tarea.ps1):
a las 18:00 captura todo y a las 22:00 vuelve a mirar y solo suma las historias nuevas.

  python scripts/radar-capturas.py              corrida normal (sin ventana)
  python scripts/radar-capturas.py --login      abre Chrome con ventana para iniciar sesión en Instagram (una vez)
  python scripts/radar-capturas.py --probar     igual que la normal pero con ventana y sin subir nada
  python scripts/radar-capturas.py --cuentas a,b   solo esas cuentas

Recomendación: iniciar sesión con una cuenta secundaria. Ver una historia deja registro ("visto") en la
cuenta que la mira, y así la cuenta principal no aparece mirando a la competencia todos los días.
Log: %LOCALAPPDATA%/exposure-radar/capturas.log
"""
import io, os, re, sys, json, time, datetime, urllib.request, urllib.parse, urllib.error

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "exposure-radar")
PERFIL = os.path.join(BASE, "perfil-ig")
LOG = os.path.join(BASE, "capturas.log")
COPIAS = os.path.join(os.path.expanduser("~"), "Documents", "EXPOSURE", "Central Negocio", "datos", "radar-capturas")
MAX_POR_CUENTA = 60
os.makedirs(BASE, exist_ok=True)

def log(m):
    linea = f"{datetime.datetime.now():%Y-%m-%d %H:%M:%S} {m}"
    print(linea, flush=True)
    with io.open(LOG, "a", encoding="utf-8") as f: f.write(linea + "\n")

# ── Supabase (claves de .env.local del CRM, nunca impresas) ─────────────────────
env = {}
for l in io.open(os.path.join(RAIZ, ".env.local"), encoding="utf-8"):
    m = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", l)
    if m: env[m.group(1)] = m.group(2).strip('"')
SB = (env.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL") or "").rstrip("/")
KEY = env.get("SUPABASE_SERVICE_ROLE_KEY", "")

def sb(metodo, ruta, cuerpo=None, extra=None, crudo=None, tipo="application/json"):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": tipo}
    h.update(extra or {})
    datos = crudo if crudo is not None else (json.dumps(cuerpo).encode() if cuerpo is not None else None)
    r = urllib.request.Request(SB + ruta, data=datos, headers=h, method=metodo)
    try:
        with urllib.request.urlopen(r, timeout=60) as x:
            t = x.read()
            return json.loads(t) if t and x.headers.get("content-type", "").startswith("application/json") else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"supabase {metodo} {ruta.split('?')[0]}: {e.code} {e.read()[:200]!r}")

def cuentas_a_capturar(solo):
    filas = sb("GET", "/rest/v1/radar_semillas?select=handle,tags&activa=eq.true&historias=eq.true&order=handle")
    hs = [f["handle"] for f in filas]
    return [h for h in hs if h in solo] if solo else hs

def ya_capturadas(ids):
    if not ids: return set()
    q = ",".join(f'"{i}"' for i in ids)
    return {f["id"] for f in sb("GET", f"/rest/v1/radar_historias?select=id&id=in.({urllib.parse.quote(q)})")}

# ── Instagram ───────────────────────────────────────────────────────────────────
def logueado(pg):
    pg.goto("https://www.instagram.com/", wait_until="domcontentloaded"); pg.wait_for_timeout(3500)
    html = pg.content()
    return not ("Iniciar sesión" in html and "Registrarte" in html) and "/accounts/login" not in pg.url and '"viewerId":null' not in html

def cerrar_avisos(pg):
    for t in ("Ahora no", "Not Now", "Aceptar", "Permitir todas las cookies", "Allow all cookies"):
        b = pg.get_by_role("button", name=t)
        if b.count():
            try: b.first.click(timeout=1500); pg.wait_for_timeout(500)
            except Exception: pass

def id_actual(pg, handle):
    m = re.search(rf"/stories/{re.escape(handle)}/(\d+)", pg.url)
    return m.group(1) if m else None

def leer_fecha(pg):
    try:
        t = pg.locator("time[datetime]").first.get_attribute("datetime", timeout=1500)
        if t: return datetime.datetime.fromisoformat(t.replace("Z", "+00:00")).astimezone(datetime.timezone.utc).isoformat()
    except Exception: pass
    return None

def capturar_cuenta(pg, handle, dir_copias):
    """Recorre las historias activas de una cuenta. Devuelve [{id, fecha, tipo, png}]."""
    pg.goto(f"https://www.instagram.com/stories/{handle}/", wait_until="domcontentloaded"); pg.wait_for_timeout(3000)
    cerrar_avisos(pg)
    for t in ("Ver historia", "View story", "Ver historias"):
        b = pg.get_by_role("button", name=t)
        if b.count():
            try: b.first.click(timeout=3000); pg.wait_for_timeout(2000)
            except Exception: pass
            break
    out, vistos = [], set()
    for _ in range(MAX_POR_CUENTA):
        sid = id_actual(pg, handle)
        if not sid or sid in vistos: break          # sin historias, o terminó y pasó a otra cuenta
        vistos.add(sid)
        pg.wait_for_timeout(1200)                    # que cargue la imagen o el primer cuadro del video
        try: pg.keyboard.press("k")                  # pausa (evita que avance sola mientras se captura)
        except Exception: pass
        es_video = pg.locator("video").count() > 0
        png = pg.screenshot(type="jpeg", quality=82)
        out.append({"id": sid, "fecha": leer_fecha(pg), "tipo": "video" if es_video else "foto", "png": png})
        if dir_copias:
            os.makedirs(dir_copias, exist_ok=True)
            with open(os.path.join(dir_copias, f"{datetime.datetime.now():%H%M}-{sid}.jpg"), "wb") as f: f.write(png)
        antes = pg.url
        pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(1300)
        if pg.url == antes:                          # la flecha no avanzó: probar el botón "Siguiente"
            b = pg.get_by_role("button", name=re.compile("Siguiente|Next"))
            if b.count():
                try: b.first.click(timeout=1500); pg.wait_for_timeout(1300)
                except Exception: break
            else: break
    return out

def subir(cuenta, h):
    path = f"historias/{h['id']}.jpg"
    sb("POST", f"/storage/v1/object/radar/{path}", crudo=h["png"], tipo="image/jpeg", extra={"x-upsert": "true", "cache-control": "31536000"})
    ahora = datetime.datetime.now(datetime.timezone.utc)
    fecha = h["fecha"] or ahora.isoformat()
    sb("POST", "/rest/v1/radar_historias", [{
        "id": h["id"], "cuenta": cuenta, "fecha": fecha,
        "vence": (datetime.datetime.fromisoformat(fecha) + datetime.timedelta(hours=24)).isoformat(),
        "tipo": h["tipo"], "stickers": {}, "frame_path": path, "fuente": "captura",
        "url": f"https://www.instagram.com/stories/{cuenta}/{h['id']}/",
    }], extra={"Prefer": "resolution=ignore-duplicates"})

def main():
    args = sys.argv[1:]
    login, probar = "--login" in args, "--probar" in args
    solo = args[args.index("--cuentas") + 1].split(",") if "--cuentas" in args else None
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(PERFIL, channel="chrome", headless=not (login or probar),
                                                   viewport={"width": 430, "height": 860}, locale="es-AR")
        pg = ctx.pages[0] if ctx.pages else ctx.new_page()
        if login:
            pg.goto("https://www.instagram.com/accounts/login/")
            print("Iniciá sesión en la ventana de Chrome (mejor con una cuenta secundaria). Cuando veas el inicio de Instagram, volvé acá y apretá Enter.")
            input()
            log("login: " + ("sesión guardada" if logueado(pg) else "NO quedó logueado; repetir --login"))
            ctx.close(); return
        if not logueado(pg):
            log("ERROR: la sesión de Instagram venció. Correr: python scripts/radar-capturas.py --login")
            if not probar:
                sb("POST", "/rest/v1/radar_corridas", [{"tipo": "historias", "estado": "error", "actor": "capturas", "error": "sesión de Instagram vencida: correr radar-capturas.py --login", "pedida_por": "tarea capturas", "terminado": datetime.datetime.now(datetime.timezone.utc).isoformat()}])
            ctx.close(); sys.exit(2)
        turno = "22 h (rechequeo)" if datetime.datetime.now().hour >= 21 else "18 h" if datetime.datetime.now().hour >= 17 else "a mano"
        cuentas = cuentas_a_capturar(solo)
        log(f"inicio · turno {turno} · {len(cuentas)} cuentas")
        hoy = f"{datetime.date.today():%Y-%m-%d}"
        detalle, vistas_tot, nuevas_tot = {}, 0, 0
        for c in cuentas:
            try:
                hs = capturar_cuenta(pg, c, None if probar else os.path.join(COPIAS, hoy, c))
                ya = set() if probar else ya_capturadas([h["id"] for h in hs])
                nuevas = [h for h in hs if h["id"] not in ya]
                if not probar:
                    for h in nuevas: subir(c, h)
                detalle[c] = {"activas": len(hs), "nuevas": len(nuevas)}
                vistas_tot += len(hs); nuevas_tot += len(nuevas)
                log(f"  @{c}: {len(hs)} activas · {len(nuevas)} nuevas")
            except Exception as e:
                detalle[c] = {"error": str(e)[:200]}
                log(f"  @{c}: ERROR {str(e)[:200]}")
            time.sleep(2)
        ctx.close()
    if not probar:
        sb("POST", "/rest/v1/radar_corridas", [{
            "tipo": "historias", "estado": "recogida", "actor": "capturas", "cuentas": cuentas, "items": vistas_tot, "nuevos": nuevas_tot, "costo_usd": 0,
            "pedida_por": f"tarea capturas · {turno}", "detalle": {"turno": turno, "por_cuenta": detalle}, "terminado": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }])
    publicaron = [c for c, d in detalle.items() if d.get("nuevas")]
    log(f"fin · {vistas_tot} activas · {nuevas_tot} nuevas" + (f" · publicaron: {', '.join(publicaron)}" if publicaron else " · nadie publicó nada nuevo"))

if __name__ == "__main__":
    main()
