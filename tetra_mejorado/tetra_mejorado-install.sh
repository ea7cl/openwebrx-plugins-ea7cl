#!/bin/bash
# Instala tetra-mejorado (panel TETRA completo) en este OpenWebRX+. Explicación en README.md.
# Necesita tetrarx: sudo apt install dxlaprs-tetra
exec bash "$(dirname "$(readlink -f "$0")")/tetra-mejorado.sh" aplicar
