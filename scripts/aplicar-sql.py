# aplicar-sql.py — corre un archivo SQL en la base de Supabase con la contraseña de la base (pooler, modo sesión).
#   python scripts/aplicar-sql.py supabase/migrations/20260911000001_tipos_pendientes.sql
# Contraseña: ../exposure-crm-secrets/db-password.txt (o SUPABASE_DB_PASSWORD). Reemplaza {{CRON_SECRET}} y
# {{APP_URL}} con .env.local, corre todo en una transacción y anota la versión en supabase_migrations.schema_migrations.
import io, os, re, sys
try:
    import pg8000
except ImportError:
    os.system(f'"{sys.executable}" -m pip install -q pg8000'); import pg8000

if len(sys.argv) < 2: sys.exit("uso: python scripts/aplicar-sql.py <archivo.sql>")
archivo = sys.argv[1]
env = {}
for l in io.open(".env.local", encoding="utf-8"):
    l = l.strip()
    if l and not l.startswith("#") and "=" in l:
        k, v = l.split("=", 1); env[k.strip()] = v.strip().strip('"')
ref = env.get("SUPABASE_PROJECT_REF") or "lswghtsvmsawntmiihvr"
pw = (os.environ.get("SUPABASE_DB_PASSWORD") or io.open("../exposure-crm-secrets/db-password.txt", encoding="utf-8-sig").read()).strip()
pw = pw.split("=", 1)[1].strip() if pw.startswith("SUPABASE_DB_PASSWORD=") else pw
sql = io.open(archivo, encoding="utf-8").read()
sql = sql.replace("{{CRON_SECRET}}", env.get("CRON_SECRET", "")).replace("{{APP_URL}}", (env.get("CRM_PUBLIC_URL") or env.get("NEXT_PUBLIC_APP_URL") or "").rstrip("/"))
m = re.match(r"^(\d{14})_(.+)\.sql$", os.path.basename(archivo))

con = None
# primero el host directo (IPv6/IPv4), después el pooler en modo sesión (tarda unos minutos en tomar una contraseña nueva)
for host, port, user in ((f"db.{ref}.supabase.co", 5432, "postgres"), ("aws-0-sa-east-1.pooler.supabase.com", 5432, f"postgres.{ref}")):
    try:
        con = pg8000.connect(user=user, password=pw, host=host, port=port, database="postgres", timeout=20, ssl_context=True); print("conectado a", host); break
    except Exception as e:
        print("no conecta", host, "→", str(e)[:100])
if con is None: sys.exit("sin conexión a la base")
con.autocommit = False
cur = con.cursor()
try:
    cur.execute(sql)
    if m:
        cur.execute("select to_regclass('supabase_migrations.schema_migrations')")
        if cur.fetchone()[0]:
            cur.execute("insert into supabase_migrations.schema_migrations(version, name) values (%s, %s) on conflict (version) do nothing", (m.group(1), m.group(2)))
    con.commit()
    print("OK aplicado:", os.path.basename(archivo))
except Exception as e:
    con.rollback()
    print("ERROR (nada aplicado):", str(e)[:800]); sys.exit(2)
finally:
    con.close()
