#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(dirname "$script_dir")"
diagrams_dir="$root_dir/docs/diagrams"
imgs_dir="$diagrams_dir/imgs"
config_file="$script_dir/mermaid-config.json"
doc_file="docs/01-diagramas.md"

usage() {
  cat <<'EOF'
Uso: render-diagrams.sh [--svg | --both] [diagrama...]

Genera las imagenes de los diagramas mermaid del proyecto en docs/diagrams/imgs/.

Sin opciones genera PNG (escala 3) de todos los diagramas de docs/diagrams/.
  --svg          genera SVG (con htmlLabels: false, para que los visores muestren el texto)
  --both         genera PNG y SVG
  -h, --help     muestra esta ayuda
  [diagrama...]  limita la generacion a esos diagramas (nombre, nombre.mmd o ruta)

Ejemplos:
  ./scripts/render-diagrams.sh
  ./scripts/render-diagrams.sh --svg 02-casos_uso
  ./scripts/render-diagrams.sh --both docs/diagrams/01-DER.mmd
EOF
}

check_mermaid12() {
  local tmp err
  tmp="$(mktemp -d)"
  err="$tmp/error.log"
  printf 'usecase-beta\nactor A("A")\nCaso("Caso")\nA --> Caso\n' > "$tmp/smoke.mmd"
  if ! mmdc -i "$tmp/smoke.mmd" -o "$tmp/smoke.svg" -q >"$err" 2>&1; then
    echo "ERROR: 'mmdc' no soporta mermaid 12: el diagrama de casos de uso va a fallar." >&2
    grep -m1 -E 'UnknownDiagramError|No such shape' "$err" >&2 || true
    echo "Ver la seccion de instalacion del entorno en $doc_file." >&2
    rm -rf "$tmp"
    exit 1
  fi
  rm -rf "$tmp"
}

formats=(png)
args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --svg) formats=(svg) ;;
    --both) formats=(png svg) ;;
    -h|--help) usage; exit 0 ;;
    --) shift; args+=("$@"); break ;;
    -*) echo "Opcion desconocida: $1" >&2; usage >&2; exit 2 ;;
    *) args+=("$1") ;;
  esac
  shift
done

command -v mmdc >/dev/null 2>&1 || {
  echo "ERROR: no se encontro 'mmdc' en PATH." >&2
  echo "Instalar el CLI con soporte de mermaid 12 (ver $doc_file)." >&2
  exit 1
}

check_mermaid12

all=0
files=()
if [[ ${#args[@]} -eq 0 ]]; then
  all=1
  shopt -s nullglob
  files=("$diagrams_dir"/*.mmd)
  shopt -u nullglob
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "ERROR: no hay diagramas .mmd en $diagrams_dir" >&2
    exit 1
  fi
else
  for arg in "${args[@]}"; do
    if [[ -f "$arg" ]]; then
      files+=("$arg")
    elif [[ -f "$diagrams_dir/$arg" ]]; then
      files+=("$diagrams_dir/$arg")
    elif [[ -f "$diagrams_dir/$arg.mmd" ]]; then
      files+=("$diagrams_dir/$arg.mmd")
    else
      echo "ERROR: no existe el diagrama '$arg'" >&2
      exit 1
    fi
  done
fi

mkdir -p "$imgs_dir"

generated=0
failures=0
for file in "${files[@]}"; do
  base="$(basename "${file%.mmd}")"
  for format in "${formats[@]}"; do
    output="$imgs_dir/$base.$format"
    cmd=(mmdc -i "$file" -o "$output" -q)
    if [[ "$format" == "png" ]]; then
      cmd+=(-s 3)
    else
      cmd+=(-c "$config_file")
    fi
    if "${cmd[@]}"; then
      echo "OK    $output"
      generated=$((generated + 1))
    else
      echo "ERROR $file -> $output" >&2
      failures=$((failures + 1))
    fi
  done
done

if [[ $all -eq 1 ]]; then
  declare -A have_mmd=()
  for file in "${files[@]}"; do
    have_mmd["$(basename "${file%.mmd}")"]=1
  done
  shopt -s nullglob
  for img in "$imgs_dir"/*.png "$imgs_dir"/*.svg; do
    name="$(basename "${img%.*}")"
    if [[ -z "${have_mmd[$name]:-}" ]]; then
      echo "ADVERTENCIA: $img no tiene un .mmd asociado" >&2
    fi
  done
  shopt -u nullglob
fi

echo
echo "Generadas: $generated  Errores: $failures"

if [[ $failures -gt 0 ]]; then
  exit 1
fi
