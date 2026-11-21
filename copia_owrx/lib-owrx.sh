# Funciones comunes de crear-copia.sh y actualizar.sh (EA7CL). No se ejecuta solo.
P=/usr/lib/python3/dist-packages
BASE=/home/ea7cl/owrx-personalizado
ALMACEN=$BASE/paquetes      # un .deb por paquete y versión, compartido por todas las copias

version_de() { dpkg-query -W -f='${Version}' "$1" 2>/dev/null; }

# Ruta en el almacén del .deb de un paquete y versión
deb_nombre() { echo "$ALMACEN/${1}_${2//:/%3a}.deb"; }

# Paquetes instalados que vienen del repositorio de OpenWebRX+ (luarvique)
paquetes_owrx() {
    local f
    f=$(ls /var/lib/apt/lists/*luarvique*_Packages 2>/dev/null | head -1)
    if [ -z "$f" ]; then echo openwebrx; return; fi
    comm -12 <(dpkg-query -W -f='${db:Status-Abbrev} ${Package}\n' | awk '$1 == "ii" {print $2}' | sort -u) \
             <(awk '/^Package:/ {print $2}' "$f" | sort -u)
}

# Deja en el almacén el .deb de la versión instalada de un paquete: de la caché de apt,
# descargándolo o, si el repositorio ya no lo tiene, rehaciéndolo con dpkg-repack.
# Con "original" no se usa dpkg-repack: rehecho llevaría tus cambios, no el original.
guardar_deb() {
    local p=$1 v d c tmp
    v=$(version_de "$p"); [ -n "$v" ] || return 1
    d=$(deb_nombre "$p" "$v")
    [ -s "$d" ] && return 0
    mkdir -p "$ALMACEN"
    for c in /var/cache/apt/archives/"${p}_${v//:/%3a}"_*.deb; do
        [ -s "$c" ] && cp "$c" "$d" && return 0
    done
    tmp=$(mktemp -d); chmod 755 "$tmp"
    if (cd "$tmp" && apt-get download -q "$p=$v" >/dev/null 2>&1); then
        mv "$tmp"/*.deb "$d"
    elif [ "${2:-}" != original ] && (cd "$tmp" && dpkg-repack "$p" >/dev/null 2>&1); then
        mv "$tmp"/*.deb "$d"
    fi
    rm -rf "$tmp"
    [ -s "$d" ]
}

# Archivos de OpenWebRX+ cambiados a mano (sin la configuración de /etc, que se conserva sola)
modificados() { dpkg --verify openwebrx | awk '$2 != "c" {print $NF}'; }

# Deja en la carpeta $2 los dueños que tiene cada archivo en la copia $1 (hecha con cp -a);
# lo que no está en la copia queda con el dueño $3. OpenWebRX no arranca si
# /var/lib/openwebrx no es del usuario openwebrx.
duenos_como() {
    local ref=$1 dir=$2 def=$3 f
    (cd "$dir" && find . -print0 | while IFS= read -r -d '' f; do
        if [ -e "$ref/$f" ] || [ -L "$ref/$f" ]; then chown -h --reference="$ref/$f" "$f"; else chown -h "$def" "$f"; fi
    done)
}

# Archivos añadidos a mano en las carpetas de OpenWebRX+ (plugins, imágenes...)
propios() {
    find $P/htdocs $P/owrx $( [ -d $P/owrx_fmcalidad ] && echo $P/owrx_fmcalidad ) $( [ -d $P/owrx_amcalidad ] && echo $P/owrx_amcalidad ) -type f ! -path '*/__pycache__/*' ! -path '*.bak*' ! -name '*.orig' ! -name '*.antes-de-*' \
        | sort | comm -23 - <(dpkg -L openwebrx | sort)
}
