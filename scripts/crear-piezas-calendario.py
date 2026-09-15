# crear-piezas-calendario.py — crea las piezas de contenido de la semana tipo del calendario
# (Doc "Calendario de contenido — semana tipo", 14/09/2026) en crm_content_assets.
#
#   python scripts/crear-piezas-calendario.py [--dry]
#
# Tres piezas por día en la franja 12/16/20. El ángulo sale del banco vivo (tabla crm_angulos): el
# script lo busca por número y arma la etiqueta "N · TÍTULO" exacta, así que si Alex renombró un
# ángulo la pieza queda con el título nuevo. No pisa nada: si ya existe una pieza de este calendario
# para ese día y esa hora, la saltea (se puede volver a correr sin duplicar).
import io, sys, json, uuid, datetime, pg8000

DRY = "--dry" in sys.argv

# (día de la semana, hora, categoría, número de ángulo, formato del CRM, título de la pieza, qué es, plataforma, pide keyword)
SEMANA = [
    ("martes", 12, "VOLUMEN/TOFU", 20, "VOLUMEN",      "7 industrias = 7 automatizaciones",                     "Lista de volumen: una automatización por industria, sin bajar a producto.", "IG + TikTok", False),
    ("martes", 16, "MENTALIDAD",   16, "TALKING HEAD", "Mi historia: la cocina, el 25/08 y Amalfi",             "Escena real contada como pelea, no como currículum.", "IG + TikTok", False),
    ("martes", 20, "SOLUCIÓN",      9, "CÁMARA + PC",  "Cómo ganar dinero con IA, desde el escritorio",         "Educación concreta a cámara: el modelo en pantalla, paso a paso.", "IG", True),

    ("miércoles", 12, "VOLUMEN/TOFU", 20, "VOLUMEN",      "500 USD antes de que llegue el delivery",            "Demo con reloj: se arma y se cobra dentro del video.", "IG + TikTok", False),
    ("miércoles", 16, "PROBLEMA",      4, "TALKING HEAD", "Cobrar por horas te tiene saturado",                 "Polémica de nicho contra el modelo de cobrar por hora.", "IG + TikTok", False),
    ("miércoles", 20, "VOLUMEN/TOFU", 20, "VOLUMEN",      "Hype prestado: definir la noticia del día",          "Evento, lanzamiento o noticia del momento. NUNCA lleva keyword: trae comentarios que convierten diez veces peor.", "IG + TikTok", False),

    ("jueves", 12, "VOLUMEN/TOFU", 20, "VOLUMEN",      "Comparativa: esto reemplaza a X",                       "Comparativa de herramientas o reemplazo directo de una conocida.", "IG + TikTok", False),
    ("jueves", 16, "PROBLEMA",      5, "TALKING HEAD", "El salario promedio en Argentina, en pantalla",         "Talking head con el número puesto en pantalla.", "IG + TikTok", False),
    ("jueves", 20, "PRODUCTO",     15, "TALKING HEAD", "Mi programa 1-1: para quién es y para quién no",        "Qué es, para quién es y para quién no. Sin precio.", "IG", True),

    ("viernes", 12, "VOLUMEN/TOFU", 20, "VOLUMEN",      "Paso a paso de una automatización corta",              "Una automatización corta, entera, de principio a fin.", "IG + TikTok", False),
    ("viernes", 16, "PROBLEMA",      2, "REACCIÓN",     "Respuesta a un comentario: depender de referidos",     "Fábrica de contenido: se responde un comentario real desde la misma silla.", "IG + TikTok", False),
    ("viernes", 20, "SOLUCIÓN",      8, "CARRUSEL",     "Cómo cerrar clientes con IG, paso a paso",             "Carrusel o reel educativo con el paso a paso.", "IG", True),

    # Las dos de las 12 y 16 del fin de semana son de costo cero: foto real del día + una frase, sin edición.
    # Si falta tiempo en la semana, se recorta de otro lado, no de acá.
    ("sábado", 12, "MENTALIDAD",   17, "TALKING IMAGEN", "Dejá de procrastinar: frase sobre la foto del día",  "Costo de producción cero: foto real del día y una frase filosa encima.", "IG + TikTok", False),
    ("sábado", 16, "VOLUMEN/TOFU", 20, "VOLUMEN",        "Re-subida del ganador, otra toma",                   "Slot fijo para re-subir el mejor de hace 20-25 días con otra toma. No tocar los reels de junio: esos se re-suben tal cual cada 60 días.", "IG + TikTok", False),
    ("sábado", 20, "SOLUCIÓN",     10, "TALKING HEAD",   "Ingreso extra con IA, el modelo en 60 segundos",     "Educación a cámara: el modelo entero explicado en un minuto.", "IG", True),

    ("domingo", 12, "PROBLEMA",    7, "TALKING HEAD",   "Prospección en frío: contra el método que todos enseñan", "Polémica de nicho contra el método que enseña todo el mundo.", "IG + TikTok", False),
    ("domingo", 16, "MENTALIDAD", 19, "TALKING IMAGEN", "Mostrales que están equivocados",                        "Costo cero: foto real del día y una frase filosa encima.", "IG + TikTok", False),
    ("domingo", 20, "PRODUCTO",   12, "CASO DE ÉXITO",  "Caso de éxito: Flex, con pantalla y cifra real",         "Caso distinto al del lunes, con pantalla y la cifra real de su período. Solo casos del banco, sin exagerar.", "IG", True),
]

DIAS = {"lunes": 0, "martes": 1, "miércoles": 2, "jueves": 3, "viernes": 4, "sábado": 5, "domingo": 6}
# Etapa del embudo: volumen y problema son tope, mentalidad y solución son medio, producto es fondo.
EMBUDO = {"VOLUMEN/TOFU": "TOFU", "PROBLEMA": "TOFU", "MENTALIDAD": "MOFU", "SOLUCIÓN": "MOFU", "PRODUCTO": "BOFU"}
# awareness_level solo acepta estas cuatro; el volumen entra como PROBLEMA (tope de embudo).
AWARENESS = {"VOLUMEN/TOFU": "PROBLEMA", "PROBLEMA": "PROBLEMA", "MENTALIDAD": "MENTALIDAD", "SOLUCIÓN": "SOLUCIÓN", "PRODUCTO": "PRODUCTO"}

pw = io.open(r"C:\Users\Alex\Documents\exposure-crm-secrets\db-password.txt", encoding="utf-8-sig").read().strip()
con = pg8000.connect(user="postgres", password=pw, host="db.lswghtsvmsawntmiihvr.supabase.co", port=5432, database="postgres", timeout=30, ssl_context=True)
con.autocommit = False
cur = con.cursor()

cur.execute("select numero, titulo from crm_angulos where activo")
banco = {n: f"{n} · {t}" for n, t in cur.fetchall()}

# Desde mañana hasta cubrir un martes, miércoles, jueves y viernes.
hoy = datetime.date.today()
manana = hoy + datetime.timedelta(days=1)
def proxima(dia):
    delta = (DIAS[dia] - manana.weekday()) % 7
    return manana + datetime.timedelta(days=delta)

# Qué franjas ya están cargadas. La comparación se hace en hora argentina y en la base: la columna
# es timestamptz y el driver devuelve UTC, así que comparar p.hour contra la hora del calendario
# (12/16/20) nunca coincidía y el script duplicaba todo en la segunda corrida.
cur.execute("""select to_char(planned_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24')
               from crm_content_assets where metadata->>'import_source' = 'calendario_semana_tipo' and planned_at is not null""")
ya = {fila[0] for fila in cur.fetchall()}

creadas, salteadas, faltantes = [], [], []
for dia, hora, categoria, numero, formato, titulo, nota, plataforma, keyword in SEMANA:
    etiqueta = banco.get(numero)
    if not etiqueta:
        faltantes.append(f"{dia} {hora}h: el ángulo {numero} no está en el banco")
        continue
    fecha = proxima(dia)
    # Se guarda la hora "tal cual" en UTC, sin offset: el resto del CRM lee la fecha cortando el ISO
    # (que viene en UTC), así que poner -03:00 movía la pieza de día en algunas vistas. Con esto,
    # 12:00 guardado es 12:00 mostrado y el día nunca se corre.
    cuando = f"{fecha.isoformat()}T{hora:02d}:00:00Z"
    franja = f"{fecha.isoformat()}T{hora:02d}"
    if franja in ya:
        salteadas.append(f"{fecha} {hora}h")
        continue
    ya.add(franja)
    fila = {
        "source_key": f"manual:exposure:{uuid.uuid4()}",
        "title": titulo,
        "platform": plataforma,
        "angle": etiqueta,
        "format": formato,
        "cta": "Keyword propia en comentarios (definir la palabra)" if keyword else "Sin keyword: pieza de alcance",
        "planned_at": cuando,
        "status": "idea",
        "assigned_to": "ALEX",
        "insight_notes": f"{nota}\n\nCalendario semana tipo · {dia} {hora}:00 · {categoria} · {plataforma}.",
        "awareness_level": AWARENESS[categoria],
        "week_label": f"{fecha.isocalendar()[0]}-W{fecha.isocalendar()[1]:02d}",
        "day_of_week": dia,
        "metadata": json.dumps({
            "import_source": "calendario_semana_tipo",
            "created_via": "scripts/crear-piezas-calendario.py",
            "categoria": categoria,
            "funnel_stage": EMBUDO[categoria],
            "hora": f"{hora:02d}:00",
            "pide_keyword": keyword,
        }, ensure_ascii=False),
    }
    if not DRY:
        cur.execute(
            "insert into crm_content_assets (source_key, title, platform, angle, format, cta, planned_at, status, assigned_to, insight_notes, awareness_level, week_label, day_of_week, metadata)"
            " values (%s,%s,%s,%s,%s,%s,%s::timestamptz,%s,%s,%s,%s,%s,%s,%s::jsonb)",
            tuple(fila.values()))
    creadas.append(f"{fecha} {hora:02d}h · {categoria:12} · {etiqueta[:38]:38} · {formato:13} · {titulo}")

print(f"piezas creadas: {len(creadas)} · salteadas (ya estaban): {len(salteadas)}")
for c in creadas: print("  ", c)
if salteadas: print("  salteadas:", ", ".join(salteadas))
if faltantes: print("  PROBLEMA:", "; ".join(faltantes))
if DRY:
    con.rollback(); print("(dry: no se escribió nada)")
else:
    con.commit(); print("commit ok")
con.close()
