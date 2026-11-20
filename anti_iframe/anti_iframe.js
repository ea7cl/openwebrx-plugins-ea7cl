/* anti_iframe v0.2 (EA7CL) - avisa si el receptor se muestra incrustado en la web de otro
   0.2: se permite dentro de la propia web del receptor (pantalla dividida del doble receptor) */
Plugins.anti_iframe = Plugins.anti_iframe || {};
Plugins.anti_iframe.no_css = true;
Plugins.anti_iframe._version = 0.2;

// Webs a las que SI se permite incrustar el receptor. Ejemplo: ['miweb.es']
Plugins.anti_iframe.permitidos = [];

Plugins.anti_iframe.init = function () {
  var incrustado;
  try { incrustado = window.top !== window.self; } catch (e) { incrustado = true; }
  if (!incrustado) return true;

  // dentro de la propia web (misma dirección): no es la web de otro
  try { if (window.top.location.origin === window.location.origin) return true; } catch (e) {}

  var origen = '';
  try { origen = new URL(document.referrer).hostname; } catch (e) {}
  var ok = Plugins.anti_iframe.permitidos.some(function (d) {
    return origen === d || origen.endsWith('.' + d);
  });
  if (ok) return true;

  var url = window.location.href;
  try { window.top.location.href = url; } catch (e) {}

  var capa = document.createElement('div');
  capa.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;' +
    'background:#101418;color:#fff;font-family:sans-serif;text-align:center;padding:10% 20px;';

  var h = document.createElement('h2');
  h.textContent = 'Este receptor es de EA7CL';
  var p = document.createElement('p');
  p.textContent = 'Se está mostrando dentro de otra página sin permiso. Ábrelo en su dirección original:';
  var a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = url;
  a.style.cssText = 'display:inline-block;margin-top:16px;padding:12px 20px;background:#ffd700;' +
    'color:#000;font-weight:bold;border-radius:6px;text-decoration:none;';

  capa.appendChild(h);
  capa.appendChild(p);
  capa.appendChild(a);
  document.body.appendChild(capa);
  return true;
};
