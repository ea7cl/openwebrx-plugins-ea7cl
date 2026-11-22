# arreglo_modo_digital (EA7CL)

Arregla un fallo de OpenWebRX+ 1.2.130: al cambiar a un perfil cuya modulación inicial es digital (FT8,
ADS-B, AIS…), la página a veces pide ese modo digital como **modo base** (por ejemplo FT8 sobre "ft8") y el
servidor lo rechaza con `unsupported demodulator`: no se oye nada y el decodificador no arranca.

El plugin envuelve `DemodulatorPanel.prototype.setMode`: si el modo base pedido no es uno de los que admite
ese modo digital, lo descarta y OpenWebRX usa el correcto (USB, NFM…). No cambia nada más.

`arreglo_modo_digital.css` está vacío a propósito: el cargador de plugins lo pide siempre.

## Instalar o reinstalar

```bash
scp arreglo_modo_digital/arreglo_modo_digital.js arreglo_modo_digital/arreglo_modo_digital.css arreglo_modo_digital/scripts/arreglo_modo_digital-install.sh arreglo_modo_digital/scripts/arreglo_modo_digital-uninstall.sh openwebrx:~/
ssh -t openwebrx 'sudo bash ~/arreglo_modo_digital-install.sh'
```

Después, Ctrl+F5 en el navegador.

## Desinstalar

```bash
ssh -t openwebrx 'sudo bash ~/arreglo_modo_digital-uninstall.sh'
```

No borra nada: guarda `init.js` y la carpeta del plugin en `/home/ea7cl/desinstalado-arreglo_modo_digital-FECHA`
y al terminar dice la orden para volver a ponerlo.

Cuando salga una versión de OpenWebRX+ que corrija el fallo, se puede quitar.
