// tetra-mejorado (EA7CL): panel TETRA con TS1-TS4, datos de la red e identidades.
// tetrarx numera los intervalos 0-3 (TN); en TETRA se llaman 1-4, así que se enseña TN+1.
// El original ocultaba los valores 0 ("if (data.ft)") y enseñaba el tipo de trama como "TS".
(function() {
    if (typeof TetraMetaPanel === 'undefined') return;

    var esc = function(s) {
        return String(s).replace(/[&<>"']/g, function(c) {
            return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
        });
    };
    var hay = function(v) { return v !== undefined && v !== null && v !== ''; };
    var num = function(v, d) { return Number(v).toFixed(d).replace('.', ','); };
    var fila = function(nombre, valor) {
        return '<tr><td class="tetra-ea7cl-n">' + nombre + '</td><td>' + valor + '</td></tr>';
    };
    var ids = function(lista) {
        return lista.map(function(x) {
            return esc(x.id) + (hay(x.ts) ? ' <span class="tetra-ea7cl-gris">TS' + (Number(x.ts) + 1) + '</span>' : '');
        }).join(', ');
    };

    TetraMetaPanel.prototype.update = function(data) {
        if (!this.isSupported(data)) return;
        var slot = this.el.find('.openwebrx-meta-slot');
        slot.addClass('active');
        var h = '<div class="tetra-ea7cl">';

        // los 4 intervalos de tiempo; en verde los que tienen voz
        h += '<div class="tetra-ea7cl-ts">';
        for (var i = 0; i < 4; i++) {
            var voz = data.slots && data.slots[i];
            h += '<span class="' + (voz ? 'voz' : '') + '" title="' +
                (voz ? 'Con voz' : 'Sin voz') + ' (TN ' + i + ' en tetrarx)">TS' + (i + 1) + '</span>';
        }
        h += '</div><table class="openwebrx-tetra-display">';

        if (hay(data.mcc)) {
            var red = hay(data.network) ? esc(data.network) + '<br>' : '';
            red += data.mcc + '-' + data.mnc +
                (hay(data.country) ? ' <span class="tetra-ea7cl-gris">(' + esc(data.country) + ')</span>' : '');
            h += fila('Red:', red);
            h += fila('Color:', data.bcc + (hay(data.la) ? ' · zona (LA) ' + data.la : ''));
        } else if (hay(data.la)) {
            h += fila('Zona (LA):', data.la);
        }
        if (hay(data.tx_mhz))
            h += fila('Base emite:', num(data.tx_mhz, 4) + ' MHz');
        if (hay(data.rx_mhz))
            h += fila('Base oye:', num(data.rx_mhz, 4) + ' MHz');
        if (hay(data.power_dbm))
            h += fila('Móvil máx.:', data.power_dbm + ' dBm');
        if (hay(data.air_encrypted) || hay(data.voice_service)) {
            var s = [];
            if (hay(data.voice_service)) s.push(data.voice_service ? 'voz' : 'sin voz');
            if (hay(data.air_encrypted)) s.push(data.air_encrypted ?
                '<span class="tetra-ea7cl-cifrado">cifrado</span>' : 'sin cifrar');
            h += fila('Servicio:', s.join(' · '));
        }
        if (data.gssi_list && data.gssi_list.length) h += fila('Grupo (GSSI):', ids(data.gssi_list));
        if (data.ssi_list && data.ssi_list.length) h += fila('SSI:', ids(data.ssi_list));
        if (data.ussi_list && data.ussi_list.length) h += fila('USSI:', ids(data.ussi_list));
        if (data.smi_list && data.smi_list.length) h += fila('SMI:', ids(data.smi_list));
        if (hay(data.last_voice_s))
            h += fila('Última voz:', data.last_voice_s < 2 ? 'ahora' : 'hace ' + data.last_voice_s + ' s');
        if (hay(data.rfdb)) {
            var sen = num(data.rfdb, 1) + ' dB';
            if (hay(data.eye)) sen += ' · ojo ' + data.eye + ' %';
            h += fila('Señal:', sen);
        }
        if (hay(data.offset))
            h += fila('Desvío:', data.offset + ' Hz');
        h += '</table></div>';
        slot.removeClass('tetra-ea7cl-sin').html(h);

        // si dejan de llegar datos, se avisa
        var self = this;
        clearTimeout(this.tetraEa7clTimer);
        this.tetraEa7clTimer = setTimeout(function() {
            slot.addClass('tetra-ea7cl-sin');
            slot.find('.tetra-ea7cl-ts span').removeClass('voz');
        }, 5000);
    };

    var clearOriginal = TetraMetaPanel.prototype.clear;
    TetraMetaPanel.prototype.clear = function() {
        clearTimeout(this.tetraEa7clTimer);
        clearOriginal.call(this);
        this.el.find('.openwebrx-meta-slot').removeClass('tetra-ea7cl-sin');
    };
})();
