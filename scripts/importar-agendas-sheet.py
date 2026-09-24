# importar-agendas-sheet.py — trae al CRM lo que el equipo cargó a mano en la pestaña de agendas del sheet
# "EXPOSURE | CRM CENTRAL 2026" (show, cerró, estado, motivo, calificación, closer, fuente, call confirmer,
# link de Fathom, operación, medio de pago, respuestas del formulario…).
#
#   python scripts/importar-agendas-sheet.py                 → solo muestra qué cambiaría (no toca nada)
#   python scripts/importar-agendas-sheet.py --aplicar       → aplica los cambios en la base
#   python scripts/importar-agendas-sheet.py --aplicar --seguimientos   → además crea los seguimientos de los leads
#                                                              que quedaron en "Hacer Seguimiento", "Seguimiento por wpp",
#                                                              "Adentro en FUP", "Agendó 2da call" o "Fee"
#   opciones: --gid <gid de la pestaña> (default 1110927987 = "📆 AGENDAS")  --tab "<título de la pestaña>"
#             --csv <archivo.csv ya bajado>
#
# Cómo cruza: por teléfono (últimos 9 dígitos); si no, por Instagram; si no, por nombre + fecha de la call.
# Cuando un teléfono tiene más de una agenda en el CRM (2da call), elige la de fecha de call más cercana.
# Reglas: la celda del sheet manda cuando tiene valor. Show "100%/1" → show=true; "0%/0" con call ya pasada →
# show=false (No Show si no hay estado); call futura → sin resultado. Cerró "1" → cerro=true. Los textos largos
# (reporte del setter, triage, análisis IA) solo se completan si el CRM los tiene vacíos. Las fechas de la
# agenda se conservan del CRM salvo que la fecha de la call sea distinta en el sheet.
# Después de aplicar, reconstruye el mapa fila↔agenda del espejo CRM→sheet (crm_integration_assets) con las
# filas reales de la pestaña, para que el espejo no pise filas corridas.
# Contraseña de la base: ../exposure-crm-secrets/db-password.txt (o SUPABASE_DB_PASSWORD).
import io, os, re, sys, csv, json, datetime, unicodedata, urllib.request
try:
    import pg8000
except ImportError:
    os.system(f'"{sys.executable}" -m pip install -q pg8000'); import pg8000

SHEET_ID = "1mLpa1gGCgN29LYt8ul7egX-M5Paej9TY6N7NydND-9w"
args = sys.argv[1:]
def opt(nombre, default=None):
    if nombre in args:
        i = args.index(nombre); return args[i + 1] if i + 1 < len(args) else default
    return default
APLICAR = "--aplicar" in args
SEGUIMIENTOS = "--seguimientos" in args
GID = opt("--gid", "1110927987")
TAB = opt("--tab", "📆 AGENDAS")
CSV = opt("--csv")
HOY = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

# ── sheet ────────────────────────────────────────────────────────────────────────────────────────
if CSV:
    raw = io.open(CSV, encoding="utf-8").read()
else:
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}"
    raw = urllib.request.urlopen(url, timeout=60).read().decode("utf-8")
filas = list(csv.reader(io.StringIO(raw)))
H = [h.strip() for h in filas[0]]
HN = [re.sub(r"\s+", " ", unicodedata.normalize("NFD", h).encode("ascii", "ignore").decode().lower()).strip() for h in H]
def col(*claves):
    # primero el encabezado exacto (asi "closer" no cae en "fecha closer" ni "setter" en "reporte setter"), despues por contenido
    for i, hn in enumerate(HN):
        if hn == claves[0]: return i
    for i, hn in enumerate(HN):
        if all(k in hn for k in claves): return i
    return None
C = {
    "nombre": col("nombres"), "telefono": col("telefono"), "instagram": col("instagram"), "fecha_agenda": col("fecha agenda"),
    "fecha_closer": col("fecha closer"), "fecha_lead": col("fecha lead"), "edad": col("edad"), "closer": col("closer"),
    "setter": col("setter"), "calificacion": col("calif"), "fuente": col("fuente"), "resumen_chat": col("reporte setter"),
    "call_confirmer": col("call confirmer"), "info_call_triage": col("triage"), "show": col("show"), "cerro": col("cerr"),
    "estado": col("estado"), "motivo_no_cierre": col("motivo no cierre"), "link_fathom": col("fathom"), "operacion": col("operaci"),
    "plan_de_pago": col("ppp"), "medio_de_pago": col("medio de pago"), "comprobante": col("comprobante"), "cc_dia_1": col("cc dia 1"),
    "ia_analisis": col("ia anal"), "fecha_tc": col("fecha tc"), "fecha_baja": col("fecha baja"), "ocupacion": col("dedicas"),
    "ingresos": col("ingreso mensual"), "inversion": col("capital"), "intentos_previos": col("intentaste"), "motivo_urgencia": col("cuando te gustaria"),
}
faltan = [k for k, v in C.items() if v is None]
if faltan: sys.exit(f"No encuentro estas columnas en el sheet: {faltan}. Encabezados: {H}")
def celda(r, k):
    i = C[k]; v = r[i] if i is not None and i < len(r) else ""
    v = v.strip()
    return "" if v in ("-", "#ERROR!", "#REF!", "#N/A", "#DIV/0!") else v
sheet = []  # (nro de fila en el sheet, dict)
for idx, r in enumerate(filas[1:], start=2):
    if not (r and r[0].strip()): continue
    sheet.append((idx, {k: celda(r, k) for k in C}))
print(f"Sheet «{TAB}»: {len(sheet)} filas con nombre (gid {GID})")

# ── helpers ──────────────────────────────────────────────────────────────────────────────────────
def norm(s): return re.sub(r"[^a-z0-9 ]", " ", unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()).strip()
def tel9(s):
    d = re.sub(r"\D", "", str(s or "")); return d[-9:] if len(d) >= 9 else None
def ig(s):
    s = str(s or "").strip().lower().lstrip("@"); s = re.split(r"[\s(]", s)[0]
    return s or None
def fecha(v):
    v = (v or "").strip()
    if not v: return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?", v)
    if m: return f"{m[1]}-{m[2]}-{m[3]} {m[4] or '00'}:{m[5] or '00'}:{m[6] or '00'}"
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?", v)
    if m:
        y = m[3] if len(m[3]) == 4 else "20" + m[3]
        return f"{y}-{int(m[2]):02d}-{int(m[1]):02d} {int(m[4] or 0):02d}:{m[5] or '00'}:00"
    return None
def solo_fecha(v): f = fecha(v); return f[:10] if f else None
def bandera(v):
    v = (v or "").strip().replace(",", ".")
    if v in ("1", "1.0", "100%", "TRUE", "True", "true", "Sí", "Si"): return True
    if v in ("0", "0.0", "0%", "FALSE", "False", "false", "No"): return False
    return None
def numero(v):
    v = (v or "").strip()
    if not v: return None
    t = re.sub(r"\.(?=\d{3})", "", re.sub(r"[^\d.,-]", "", v)).replace(",", ".")
    try: return float(t)
    except ValueError: return None
CLOSERS = {"nawe": "Nahuel", "nahuel": "Nahuel", "cristian": "Cristian", "cris": "Cristian", "bener": "Bener", "benner": "Bener", "bener.salvod": "Bener",
           "alex": "Alex", "tobias": "Tobias", "tobías": "Tobias", "kenneth": "Bener"}
SETTERS = {"maxi": "Maximo", "maximo": "Maximo", "máximo": "Maximo", "alex": "Alex", "nawe": "Nahuel", "nahuel": "Nahuel", "santiago": "Santiago", "andres": "Andres", "lukas": "Lukas", "cesar": "Cesar", "santi": "Santi"}
def closer_canon(v):
    p = (v or "").strip().split()
    if not p: return None
    k = p[0].lower()
    if k.startswith("exposure") or k == "sin": return None
    return CLOSERS.get(k, p[0].capitalize())
def setter_canon(v):
    p = (v or "").strip().split()
    if not p: return None
    k = p[0].lower()
    if k == "webinar": return None
    return SETTERS.get(k, p[0].capitalize())

# ── base ─────────────────────────────────────────────────────────────────────────────────────────
ref = "lswghtsvmsawntmiihvr"
pw = os.environ.get("SUPABASE_DB_PASSWORD") or io.open(os.path.join(os.path.dirname(__file__), "..", "..", "exposure-crm-secrets", "db-password.txt"), encoding="utf-8-sig").read().strip()
pw = pw.split("=", 1)[1].strip() if pw.startswith("SUPABASE_DB_PASSWORD=") else pw
con = None
for host, port, user in ((f"db.{ref}.supabase.co", 5432, "postgres"), ("aws-0-sa-east-1.pooler.supabase.com", 5432, f"postgres.{ref}")):
    try: con = pg8000.connect(user=user, password=pw, host=host, port=port, database="postgres", timeout=30, ssl_context=True); break
    except Exception as e: print("no conecta", host, str(e)[:80], file=sys.stderr)
if not con: sys.exit("Sin conexión a la base")
cur = con.cursor()
fechas = [solo_fecha(d["fecha_agenda"]) or solo_fecha(d["fecha_closer"]) for _, d in sheet]
fechas = [f for f in fechas if f]
desde = (datetime.date.fromisoformat(min(fechas)) - datetime.timedelta(days=14)).isoformat()
CAMPOS = ["id", "nombre", "telefono", "instagram", "fecha_agenda", "fecha_closer", "fecha_lead", "edad", "closer", "setter", "calificacion", "fuente", "resumen_chat",
          "call_confirmer", "info_call_triage", "show", "cerro", "estado", "motivo_no_cierre", "link_fathom", "operacion", "plan_de_pago", "medio_de_pago", "comprobante",
          "cc_dia_1", "ia_analisis", "fecha_tc", "fecha_baja", "ocupacion", "ingresos", "inversion", "intentos_previos", "motivo_urgencia", "person_id"]
cur.execute(f"select {', '.join(CAMPOS)} from agendas where fecha_agenda >= %s or fecha_closer >= %s", (desde, desde))
crm = [dict(zip(CAMPOS, f)) for f in cur.fetchall()]
for a in crm:
    a["id"] = str(a["id"]); a["person_id"] = str(a["person_id"]) if a["person_id"] else None
    for k in ("fecha_agenda", "fecha_closer", "fecha_lead", "fecha_tc", "fecha_baja"):
        if a[k] is not None: a[k] = a[k].strftime("%Y-%m-%d %H:%M:%S") if hasattr(a[k], "strftime") else str(a[k])
    if a["cc_dia_1"] is not None: a["cc_dia_1"] = float(a["cc_dia_1"])
print(f"CRM: {len(crm)} agendas desde {desde}")

# ── cruce ────────────────────────────────────────────────────────────────────────────────────────
por_tel, por_ig, por_nom = {}, {}, {}
for a in crm:
    t = tel9(a["telefono"]); i = ig(a["instagram"]); n = norm(a["nombre"])
    if t: por_tel.setdefault(t, []).append(a)
    if i: por_ig.setdefault(i, []).append(a)
    if n: por_nom.setdefault(n, []).append(a)
def dist(a, d):
    fa = a["fecha_closer"] or a["fecha_agenda"] or ""; fs = fecha(d["fecha_closer"]) or fecha(d["fecha_agenda"]) or ""
    if not fa or not fs: return 9e9
    return abs((datetime.datetime.fromisoformat(fa) - datetime.datetime.fromisoformat(fs)).total_seconds())
usadas = set(); enlaces = []; nuevas = []; como = {"telefono": 0, "instagram": 0, "nombre": 0}
for fila, d in sheet:
    cands = []; via = None
    for v, tabla, k in ((tel9(d["telefono"]), por_tel, "telefono"), (ig(d["instagram"]), por_ig, "instagram"), (norm(d["nombre"]), por_nom, "nombre")):
        if v and tabla.get(v):
            cands = [a for a in tabla[v] if a["id"] not in usadas] or tabla[v]; via = k; break
    if not cands: nuevas.append((fila, d)); continue
    a = min(cands, key=lambda x: dist(x, d)); usadas.add(a["id"]); como[via] += 1
    enlaces.append((fila, d, a))
print(f"Cruce: {len(enlaces)} filas enlazadas ({como}) · {len(nuevas)} filas del sheet sin agenda en el CRM")

# ── cambios ──────────────────────────────────────────────────────────────────────────────────────
SOLO_SI_VACIO = {"resumen_chat", "info_call_triage", "ia_analisis", "fecha_lead", "edad"}
TEXTO = ["calificacion", "fuente", "call_confirmer", "estado", "motivo_no_cierre", "link_fathom", "operacion", "plan_de_pago", "medio_de_pago", "comprobante",
         "ocupacion", "ingresos", "inversion", "intentos_previos", "motivo_urgencia", "resumen_chat", "info_call_triage", "ia_analisis", "edad"]
resumen = {}; conflictos = []; updates = []
def cuenta(k): resumen[k] = resumen.get(k, 0) + 1
for fila, d, a in enlaces:
    u = {}
    for k in TEXTO:
        v = d[k]
        if not v: continue
        actual = (a[k] or "").strip() if isinstance(a[k], str) else a[k]
        if k in SOLO_SI_VACIO and actual: continue
        if v != (actual or ""): u[k] = v; cuenta(k)
    for k in ("fecha_tc", "fecha_baja", "fecha_lead"):
        v = fecha(d[k])
        if v and (a[k] or "")[:10] != v[:10] and not (k in SOLO_SI_VACIO and a[k]): u[k] = v; cuenta(k)
    fc = fecha(d["fecha_closer"])
    if fc and a["fecha_closer"] and abs((datetime.datetime.fromisoformat(fc) - datetime.datetime.fromisoformat(a["fecha_closer"])).total_seconds()) > 60:
        u["fecha_closer"] = fc; cuenta("fecha_closer")
        if resumen.get("fecha_closer", 0) <= 6: print(f"  fecha de call distinta · fila {fila} {d['nombre']}: sheet {fc} · CRM {a['fecha_closer']}")
    cl = closer_canon(d["closer"])
    if cl and cl != (a["closer"] or ""): u["closer"] = cl; cuenta("closer")
    st = setter_canon(d["setter"])
    if st and st != (a["setter"] or ""): u["setter"] = st; cuenta("setter")
    n = numero(d["cc_dia_1"])
    if n is not None and (a["cc_dia_1"] is None or abs(a["cc_dia_1"] - n) > 0.01): u["cc_dia_1"] = n; cuenta("cc_dia_1")
    show = bandera(d["show"]); cerro = bandera(d["cerro"])
    # "pasada" con 12 h de margen: una call de hace unas horas sin resultado cargado no se marca No Show todavia
    pasada = bool(fc or a["fecha_closer"]) and datetime.datetime.fromisoformat(fc or a["fecha_closer"]) < HOY - datetime.timedelta(hours=12)
    if cerro is True:
        if not a["cerro"]: u["cerro"] = True; cuenta("cerro→sí")
        if a["show"] is not True: u["show"] = True; cuenta("show→sí (por cierre)")
    elif cerro is False and a["cerro"]:
        conflictos.append(f"fila {fila} {d['nombre']}: el CRM dice cerró y el sheet 0 → se deja cerró (probablemente hay pago)")
    if show is True and a["show"] is not True and "show" not in u: u["show"] = True; cuenta("show→sí")
    if show is False and cerro is not True:
        if a["show"] is True:
            u["show"] = False; cuenta("show sí→no (sheet)"); conflictos.append(f"fila {fila} {d['nombre']}: el CRM tenía show y el sheet 0 → queda no show")
        elif a["show"] is None and pasada:
            u["show"] = False; cuenta("show→no (call pasada sin resultado)")
        if u.get("show") is False and not (u.get("estado") or a["estado"]): u["estado"] = "No Show"; cuenta("estado No Show")
    if u: updates.append((a["id"], fila, d["nombre"], u))
print("\nCambios por campo (filas afectadas):")
for k, v in sorted(resumen.items(), key=lambda x: -x[1]): print(f"  {k}: {v}")
print(f"Agendas a actualizar: {len(updates)} · nuevas a crear: {len(nuevas)}")
for fila, d in nuevas: print(f"  nueva → fila {fila}: {d['nombre']} · {d['telefono']} · {d['instagram']} · agenda {d['fecha_agenda']} · call {d['fecha_closer']} · closer {d['closer']} · {d['calificacion']} · fuente {d['fuente'] or '—'}")
if conflictos:
    print("\nConflictos (se resuelven como dice cada línea):"); [print("  ", c) for c in conflictos]

# ── seguimientos a crear ─────────────────────────────────────────────────────────────────────────
FUP_ESTADOS = {"hacer seguimiento", "seguimiento por wpp", "adentro en fup", "agendó 2da call", "agendo 2da call", "fee"}
seg = []
if SEGUIMIENTOS:
    cur.execute("select agenda_id::text from seguimientos where agenda_id is not null"); ya = {r[0] for r in cur.fetchall()}
    for fila, d, a in enlaces:
        u = next((x[3] for x in updates if x[0] == a["id"]), {})
        estado = (u.get("estado") or a["estado"] or "").strip().lower()
        cerro = u.get("cerro", a["cerro"])
        if a["id"] in ya or cerro or estado not in FUP_ESTADOS: continue
        fc = u.get("fecha_closer") or a["fecha_closer"]
        seg.append({
            "agenda_id": a["id"], "person_id": a["person_id"], "mes": (fc or "")[:7] or None, "nombre": a["nombre"], "telefono": a["telefono"], "instagram": a["instagram"],
            "fecha_call": fc, "closer": u.get("closer") or a["closer"], "tuvo_call": u.get("show", a["show"]), "situacion": u.get("motivo_no_cierre") or a["motivo_no_cierre"],
            "tipo_lead": u.get("calificacion") or a["calificacion"], "transcripcion_fathom": u.get("link_fathom") or a["link_fathom"],
            "notas": (u.get("estado") or a["estado"]), "estado": "Reagendó" if "2da" in estado else "Activo", "creado_por": "importación sheet",
        })
    print(f"\nSeguimientos a crear: {len(seg)} (leads en Hacer Seguimiento / Seguimiento por wpp / Adentro en FUP / Agendó 2da call / Fee, sin cierre)")

if not APLICAR:
    print("\nModo prueba: no se cambió nada. Agregá --aplicar para aplicar."); sys.exit(0)

# ── aplicar ──────────────────────────────────────────────────────────────────────────────────────
try:
    cur.execute("alter table public.agendas disable trigger crm_sheet_webhook_agendas")  # el espejo lo levanta el cron de a 150
    for aid, fila, nombre, u in updates:
        sets = ", ".join(f"{k} = %s" for k in u) + ", updated_at = now()"
        cur.execute(f"update agendas set {sets} where id = %s", (*u.values(), aid))
    ids_nuevas = []
    for fila, d in nuevas:
        campos = {
            "nombre": d["nombre"], "telefono": re.sub(r"\D", "", d["telefono"]) or None, "instagram": (d["instagram"].lstrip("@") or None),
            "fecha_agenda": fecha(d["fecha_agenda"]), "fecha_closer": fecha(d["fecha_closer"]), "fecha_lead": fecha(d["fecha_lead"]), "edad": d["edad"] or None,
            "closer": closer_canon(d["closer"]), "setter": setter_canon(d["setter"]), "calificacion": d["calificacion"] or None, "fuente": d["fuente"] or None,
            "resumen_chat": d["resumen_chat"] or None, "call_confirmer": d["call_confirmer"] or None, "info_call_triage": d["info_call_triage"] or None,
            "estado": d["estado"] or None, "motivo_no_cierre": d["motivo_no_cierre"] or None, "link_fathom": d["link_fathom"] or None, "operacion": d["operacion"] or None,
            "plan_de_pago": d["plan_de_pago"] or None, "medio_de_pago": d["medio_de_pago"] or None, "comprobante": d["comprobante"] or None, "cc_dia_1": numero(d["cc_dia_1"]),
            "ia_analisis": d["ia_analisis"] or None, "fecha_tc": fecha(d["fecha_tc"]), "fecha_baja": fecha(d["fecha_baja"]), "ocupacion": d["ocupacion"] or None,
            "ingresos": d["ingresos"] or None, "inversion": d["inversion"] or None, "intentos_previos": d["intentos_previos"] or None, "motivo_urgencia": d["motivo_urgencia"] or None,
            "motivo_inclusion": f"Cargada a mano en el sheet ({TAB}, fila {fila}); importada el {HOY.date().isoformat()}",
        }
        show = bandera(d["show"]); cerro = bandera(d["cerro"]); fc = campos["fecha_closer"]
        campos["cerro"] = bool(cerro)
        campos["show"] = True if (show or cerro) else (False if show is False and fc and datetime.datetime.fromisoformat(fc) < HOY else None)
        if campos["show"] is False and not campos["estado"]: campos["estado"] = "No Show"
        cols = [k for k, v in campos.items() if v is not None]
        cur.execute(f"insert into agendas ({', '.join(cols)}) values ({', '.join(['%s'] * len(cols))}) returning id::text", tuple(campos[k] for k in cols))
        ids_nuevas.append((cur.fetchone()[0], fila, d["nombre"]))
    # mapa fila ↔ agenda del espejo, reconstruido con las filas reales de la pestaña
    cur.execute("select source_id, metadata from crm_integration_assets where source='gsheet' and asset_type='agenda' and metadata->>'tab' = %s", (TAB,))
    viejos = {r[0]: (r[1] if isinstance(r[1], dict) else json.loads(r[1] or "{}")) for r in cur.fetchall()}
    en_sheet = {}
    for fila, d, a in enlaces: en_sheet[a["id"]] = (fila, a["nombre"])
    for aid, fila, nombre in ids_nuevas: en_sheet[aid] = (fila, nombre)
    ym = (fechas and max(fechas)[:7]) or HOY.strftime("%Y-%m")
    remapeadas = 0
    for aid, (fila, nombre) in en_sheet.items():
        meta = {"tab": TAB, "row": fila, "ym": ym}   # sin hash: el espejo reescribe la fila con lo que tenga el CRM cuando la agenda cambie
        cur.execute("""insert into crm_integration_assets (source, asset_type, source_id, name, metadata, last_seen_at) values ('gsheet','agenda',%s,%s,%s,now())
                       on conflict (source, asset_type, source_id) do update set metadata = excluded.metadata, name = excluded.name, last_seen_at = now()""", (aid, nombre, json.dumps(meta)))
        remapeadas += 1
    quitadas = 0
    for aid, meta in viejos.items():
        if aid in en_sheet: continue
        meta = dict(meta); meta["quitada"] = True   # la fila ya no está en la pestaña: el espejo no la vuelve a escribir
        cur.execute("update crm_integration_assets set metadata = %s, last_seen_at = now() where source='gsheet' and asset_type='agenda' and source_id = %s", (json.dumps(meta), aid))
        quitadas += 1
    creados = 0
    for s in seg:
        cols = [k for k, v in s.items() if v is not None]
        cur.execute(f"insert into seguimientos ({', '.join(cols)}) values ({', '.join(['%s'] * len(cols))}) on conflict do nothing", tuple(s[k] for k in cols))
        creados += cur.rowcount
    cur.execute("alter table public.agendas enable trigger crm_sheet_webhook_agendas")
    con.commit()
    print(f"\nAplicado: {len(updates)} agendas actualizadas · {len(ids_nuevas)} creadas · mapa del espejo: {remapeadas} filas remapeadas, {quitadas} marcadas como quitadas · {creados} seguimientos creados")
except Exception as e:
    con.rollback(); sys.exit(f"ERROR, no se aplicó nada: {e}")
