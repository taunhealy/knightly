import os
import re
import sqlite3
from typing import Any, Iterable, Optional, Sequence
from db.session import engine, is_postgres

_PK_MAP = {
    "listings": "id",
    "suburb_sync_state": "suburb_normalized",
    "address_cache": "raw_hash",
    "estate_cache": "coord_key",
    "user_nicknames": "user_id",
    "users_auth": "user_id",
    "listing_comments": "id",
}


class CompatRow(dict):
    """Supports both dict-key access (row['col']) and positional index (row[0]) like sqlite3.Row."""

    def __init__(self, columns: Sequence[str], values: Sequence[Any]):
        super().__init__(zip(columns, values))
        self._values = tuple(values)

    def __getitem__(self, key: Any) -> Any:
        if isinstance(key, int):
            return self._values[key]
        return super().__getitem__(key)


def _translate_sql(sql: str) -> str:
    s = sql.strip()
    # Translate INSERT OR IGNORE
    if re.match(r"^INSERT\s+OR\s+IGNORE\s+INTO\s+", s, re.IGNORECASE):
        s = re.sub(r"^INSERT\s+OR\s+IGNORE\s+INTO\s+", "INSERT INTO ", s, flags=re.IGNORECASE)
        if "ON CONFLICT" not in s.upper():
            s = s.rstrip(";") + " ON CONFLICT DO NOTHING"

    # Translate INSERT OR REPLACE INTO table (c1, c2, ...) VALUES (...)
    m = re.match(
        r"^INSERT\s+OR\s+REPLACE\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*(.+)$",
        s,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if m:
        table = m.group(1).strip()
        cols = [c.strip() for c in m.group(2).split(",")]
        pk = _PK_MAP.get(table.lower(), cols[0])
        updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c != pk)
        s = f"INSERT INTO {table} ({', '.join(cols)}) VALUES {m.group(3).rstrip(';')}"
        if updates:
            s += f" ON CONFLICT ({pk}) DO UPDATE SET {updates}"
        else:
            s += f" ON CONFLICT ({pk}) DO NOTHING"

    # Replace ? placeholders with %s outside single-quoted literals
    out = []
    in_quote = False
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == "'":
            in_quote = not in_quote
            out.append(ch)
        elif ch == "?" and not in_quote:
            out.append("%s")
        else:
            out.append(ch)
        i += 1
    return "".join(out)


class _PgCursorWrapper:
    def __init__(self, raw_cur: Any):
        self._cur = raw_cur

    @property
    def lastrowid(self) -> Any:
        return getattr(self._cur, "lastrowid", None)

    @property
    def rowcount(self) -> int:
        return getattr(self._cur, "rowcount", 0)

    def execute(self, sql: str, params: Iterable[Any] = ()) -> "_PgCursorWrapper":
        translated = _translate_sql(sql)
        p = tuple(params) if params is not None else ()
        if p:
            self._cur.execute(translated, p)
        else:
            self._cur.execute(translated)
        return self

    def fetchone(self) -> Optional[CompatRow]:
        row = self._cur.fetchone()
        if row is None:
            return None
        cols = [d[0] for d in (self._cur.description or [])]
        return CompatRow(cols, row)

    def fetchall(self) -> list[CompatRow]:
        rows = self._cur.fetchall()
        cols = [d[0] for d in (self._cur.description or [])]
        return [CompatRow(cols, r) for r in rows]


class _PgCompatConnection:
    def __init__(self):
        self._conn = engine.raw_connection()

    def cursor(self) -> _PgCursorWrapper:
        return _PgCursorWrapper(self._conn.cursor())

    def execute(self, sql: str, params: Iterable[Any] = ()) -> _PgCursorWrapper:
        cur = self.cursor()
        return cur.execute(sql, params)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        try:
            self._conn.close()
        except Exception:
            pass

    def __enter__(self) -> "_PgCompatConnection":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if exc_type is not None:
            self.rollback()
        else:
            self.commit()
        self.close()


def get_compat_connection(sqlite_path: str):
    """Returns a pooled Supabase Postgres connection when SUPABASE_DB_URL is set, else SQLite."""
    if is_postgres():
        return _PgCompatConnection()
    os.makedirs(os.path.dirname(os.path.abspath(sqlite_path)), exist_ok=True)
    conn = sqlite3.connect(sqlite_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn
