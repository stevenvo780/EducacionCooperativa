#!/usr/bin/env python3
import argparse
import json
import sys


def read_env_value(env_path, key):
    try:
        with open(env_path, "r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                if not line.startswith(f"{key}="):
                    continue
                return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        return None
    return None


def normalize_json(raw):
    value = raw.strip()
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        value = value[1:-1]
    try:
        data = json.loads(value)
    except json.JSONDecodeError:
        try:
            data = json.loads(value.encode("utf-8").decode("unicode_escape"))
        except Exception as exc:
            raise ValueError(f"No se pudo parsear JSON: {exc}") from exc
    if isinstance(data, str):
        data = json.loads(data)
    return json.dumps(data, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description="Extrae FIREBASE_SERVICE_ACCOUNT de un archivo .env y lo imprime como JSON."
    )
    parser.add_argument("--env-file", default=".env.local", help="Ruta al archivo .env")
    parser.add_argument("--key", default="FIREBASE_SERVICE_ACCOUNT", help="Nombre de la variable")
    parser.add_argument("--out", default="-", help="Archivo de salida o '-' para stdout")
    args = parser.parse_args()

    raw = read_env_value(args.env_file, args.key)
    if not raw:
        print(f"No se encontro {args.key} en {args.env_file}", file=sys.stderr)
        sys.exit(1)

    try:
        json_payload = normalize_json(raw)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)

    if args.out == "-":
        print(json_payload)
    else:
        with open(args.out, "w", encoding="utf-8") as handle:
            handle.write(json_payload)
            handle.write("\n")


if __name__ == "__main__":
    main()
