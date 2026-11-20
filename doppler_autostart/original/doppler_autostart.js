Plugins.doppler_autostart = Plugins.doppler_autostart || {};
Plugins.doppler_autostart.no_css = true;
Plugins.doppler_autostart.init = function () {
    var cache = {}, lastId = null, busy = false;

    function waitForDoppler(fn, n) {
        n = n || 0;
        if (Plugins.doppler && typeof Plugins.doppler.start_tracker === "function" && Plugins.doppler.launchButton) return fn();
        if (n >= 40) {
            console.warn("[doppler_autostart] Doppler no disponible.");
            busy = false; lastId = null; return;
        }
        setTimeout(function () { waitForDoppler(fn, n + 1); }, 500);
    }

    function start(sat) {
        if (!sat || !sat.id || busy || String(sat.id) === lastId) return;
        var id = String(sat.id);
        busy = true; lastId = id;

        waitForDoppler(function () {
            function launch(gp) {
                try {
                    if (Plugins.doppler.intervalId !== undefined &&
                        typeof Plugins.doppler.stop_tracker === "function") {
                        Plugins.doppler.stop_tracker("Cambiando de satélite");
                    }
                    Plugins.doppler.start_tracker(gp);
                    console.log("[doppler_autostart] Seguimiento solicitado:", sat.name, id);
                } catch (e) {
                    console.error("[doppler_autostart] Error al iniciar:", e);
                    lastId = null;
                }
                busy = false;
            }
            if (cache[id]) return launch(cache[id]);
            fetch("https://celestrak.org/NORAD/elements/gp.php?CATNR=" +
                encodeURIComponent(id) + "&FORMAT=JSON", {cache: "no-store"})
                .then(function (r) {
                    if (!r.ok) throw new Error("CelesTrak HTTP " + r.status);
                    return r.json();
                })
                .then(function (data) {
                    if (!Array.isArray(data) || !data[0] || !data[0].OBJECT_NAME)
                        throw new Error("Sin datos GP para NORAD " + id);
                    cache[id] = data[0]; launch(data[0]);
                })
                .catch(function (e) {
                    console.error("[doppler_autostart] Error consultando CelesTrak:", e);
                    busy = false; lastId = null;
                });
        });
    }

    $(document).on("owrxplus:satellite-tuned.doppler_autostart", function (e, sat) {
        start(sat);
    });
    $(document).on("click.doppler_autostart", "#satellite-track", function () {
        setTimeout(function () {
            if (Plugins.doppler && Plugins.doppler.intervalId === undefined) lastId = null;
        }, 150);
    });
    console.log("[doppler_autostart] Plugin cargado.");
    return true;
};
