# sql.py — corre SQL ad hoc en la base de Supabase (host directo, contraseña en ../exposure-crm-secrets/db-password.txt).
#   python scripts/sql.py "select count(*) from pagos"
#   python scripts/sql.py archivo.sql            (varias sentencias; se aplican en una transacción)
#   python scripts/sql.py --dry "update ..."     (corre y hace rollback: para ver qué tocaría)
import io, os, sys, json, datetime, decimal
try:
    import pg8000
except ImportError:
    os.system(f'"{sys.executable}" -m pip install -q pg8000'); import pg8000

args = [a for a in sys.argv[1:] if a != "--dry"]; dry = "--dry" in sys.argv
if not args: sys.exit("uso: python scripts/sql.py [--dry] \"<sql>\" | archivo.sql")
q = args[0]
if os.path.isfile(q): q = io.open(q, encoding="utf-8").read()
ref = "lswghtsvmsawntmiihvr"
pw = io.open(os.path.join(os.path.dirname(__file__), "..", "..", "exposure-crm-secrets", "db-password.txt"), encoding="utf-8-sig").read().strip()
pw = pw.split("=", 1)[1].strip() if pw.startswith("SUPABASE_DB_PASSWORD=") else pw
con = None
for host, port, user in ((f"db.{ref}.supabase.co", 5432, "postgres"), ("aws-0-sa-east-1.pooler.supabase.com", 5432, f"postgres.{ref}")):
    try:
        con = pg8000.connect(user=user, password=pw, host=host, port=port, database="postgres", timeout=20, ssl_context=True); break
    except Exception as e:
        print("no conecta", host, "→", str(e)[:100], file=sys.stderr)
if con is None: sys.exit("sin conexión")
con.autocommit = False
cur = con.cursor()

def plano(v):
    if isinstance(v, (datetime.datetime, datetime.date)): return v.isoformat()
    if isinstance(v, decimal.Decimal): return float(v)
    return v

try:
    cur.execute(q)
    if cur.description:
        cols = [d[0] for d in cur.description]
        filas = cur.fetchall()
        print(json.dumps([dict(zip(cols, map(plano, f))) for f in filas], ensure_ascii=False, indent=1, default=str)[:20000])
        print(f"-- {len(filas)} filas", file=sys.stderr)
    else:
        print(f"-- filas afectadas: {cur.rowcount}")
    if dry: con.rollback(); print("-- ROLLBACK (--dry)")
    else: con.commit()
except Exception as e:
    con.rollback(); print("ERROR:", str(e)[:600]); sys.exit(2)
finally:
    con.close()
