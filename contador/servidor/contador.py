"""
Visitor counter for the "contador" receiver plugin (EA7CL).

Counts every receiver connection and keeps:

  - visits: the same address within COUNTER_WINDOW seconds is one visit,
  - unique visitors,
  - unique visitors per country (needs python3-maxminddb and a country database).

Addresses are never stored, only a salted hash. The public file read by the
browser (datos.json, next to contador.js) only holds totals. Local network
addresses are not counted.

Installed as owrx/contador.py and called from owrx/connection.py, see the README.
"""

from owrx.client import ClientRegistry
from datetime import datetime
from ipaddress import ip_address
import threading
import hashlib
import secrets
import json
import time
import os

import logging

logger = logging.getLogger(__name__)


# --- SETTINGS ---
# Country database (DB-IP "IP to Country Lite", CC BY 4.0, https://db-ip.com)
GEOIP_DATABASE = "/var/lib/openwebrx/geoip/dbip-country-lite.mmdb"
# Private state: salt and totals, and hashes of known visitors
COUNTER_FILE = "/var/lib/openwebrx/contador.json"
COUNTER_FINGERPRINTS = "/var/lib/openwebrx/contador-huellas.txt"
# Public totals, next to the browser plugin
COUNTER_PUBLIC = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "htdocs", "plugins", "receiver", "contador", "datos.json"
)
# Added to the totals, for example the visitors counted by a previous counter
COUNTER_BASE = 0
# Seconds during which the same address counts as one visit
COUNTER_WINDOW = 30 * 60
# Countries listed in the public file
COUNTER_TOP_COUNTRIES = 24
# Seconds between writes to disk
COUNTER_WRITE_INTERVAL = 10


class GeoIp(object):
    def __init__(self):
        self.reader = None
        try:
            import maxminddb
            self.reader = maxminddb.open_database(GEOIP_DATABASE)
        except Exception as e:
            logger.warning("GeoIP database not available, visitors will not have a country: %s", e)

    def country(self, ip: str):
        if self.reader is None:
            return None
        try:
            record = self.reader.get(ip) or {}
        except Exception:
            logger.exception("GeoIP lookup failed for %s", ip)
            return None
        return record.get("country", {}).get("iso_code")


def _normalizeIp(ip: str):
    # Returns the canonical address without IPv6 zone, or None if it is not an address
    try:
        address = ip_address(ip.split("%")[0].strip())
    except (ValueError, AttributeError):
        return None
    if address.version == 6 and address.ipv4_mapped is not None:
        address = address.ipv4_mapped
    return address


def _writeAtomic(path: str, content: str, mode: int):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        f.write(content)
    os.chmod(tmp, mode)
    os.replace(tmp, path)


class VisitCounter(object):
    def __init__(self):
        self.lock = threading.Lock()
        # Last time each visitor was seen, to merge reconnections into one visit
        self.lastSeen = {}
        self.dirty = True
        self.lastWrite = None
        # A damaged state file raises here: better no counter than a counter reset to zero
        self.data = self._load()
        self.fingerprints = self._loadFingerprints()

    @staticmethod
    def _load():
        try:
            with open(COUNTER_FILE) as f:
                data = json.load(f)
        except FileNotFoundError:
            data = {}
        data.setdefault("salt", secrets.token_hex(16))
        data.setdefault("since", datetime.now().date().isoformat())
        data.setdefault("visits", 0)
        data.setdefault("unique", 0)
        data.setdefault("countries", {})
        return data

    @staticmethod
    def _loadFingerprints():
        try:
            with open(COUNTER_FINGERPRINTS) as f:
                return set(line.strip() for line in f if line.strip())
        except FileNotFoundError:
            return set()

    def _fingerprint(self, ip: str):
        return hashlib.sha256((self.data["salt"] + ip).encode()).hexdigest()[:20]

    def count(self, ip: str, country: str, now: float):
        fingerprint = self._fingerprint(ip)
        with self.lock:
            last = self.lastSeen.get(fingerprint)
            self.lastSeen[fingerprint] = now
            if last is not None and now - last < COUNTER_WINDOW:
                return
            self.data["visits"] += 1
            if fingerprint not in self.fingerprints:
                with open(COUNTER_FINGERPRINTS, "a") as f:
                    f.write(fingerprint + "\n")
                os.chmod(COUNTER_FINGERPRINTS, 0o600)
                self.fingerprints.add(fingerprint)
                self.data["unique"] += 1
                code = country or "??"
                self.data["countries"][code] = self.data["countries"].get(code, 0) + 1
            self.dirty = True

    def flush(self, now: float):
        with self.lock:
            if not self.dirty or (self.lastWrite is not None and now - self.lastWrite < COUNTER_WRITE_INTERVAL):
                return
            self.dirty = False
            self.lastWrite = now
            for fingerprint in [k for k, t in self.lastSeen.items() if now - t >= COUNTER_WINDOW]:
                del self.lastSeen[fingerprint]
            countries = sorted(self.data["countries"].items(), key=lambda kv: (-kv[1], kv[0]))
            public = {
                "visitas": COUNTER_BASE + self.data["visits"],
                "unicos": COUNTER_BASE + self.data["unique"],
                "paises": [[code, n] for code, n in countries[:COUNTER_TOP_COUNTRIES]],
                "num_paises": len([c for c in self.data["countries"] if c != "??"]),
                "desde": self.data["since"],
                "actualizado": datetime.now().isoformat(timespec="seconds"),
            }
            _writeAtomic(COUNTER_FILE, json.dumps(self.data), 0o600)
            _writeAtomic(COUNTER_PUBLIC, json.dumps(public), 0o644)


class ContadorThread(threading.Thread):
    sharedInstance = None
    creationLock = threading.Lock()

    @staticmethod
    def getSharedInstance():
        with ContadorThread.creationLock:
            if ContadorThread.sharedInstance is None:
                ContadorThread.sharedInstance = ContadorThread()
        return ContadorThread.sharedInstance

    def __init__(self):
        self.lock = threading.Lock()
        self.geoip = None
        self.counter = None
        self.counterFailed = False
        self.endEvent = threading.Event()
        super().__init__(name="contador", daemon=True)

    def add_client(self, c):
        # The counter must never break a client connection
        try:
            # Created on the first connection of any kind, so the public totals exist from the start
            with self.lock:
                if self.counter is None and not self.counterFailed:
                    try:
                        self.counter = VisitCounter()
                        self.geoip = GeoIp()
                        self.start()
                    except Exception:
                        self.counterFailed = True
                        logger.exception("visitor counter disabled, could not read %s", COUNTER_FILE)
                counter = self.counter
            if counter is None:
                return
            address = _normalizeIp(ClientRegistry.getSharedInstance().getIp(c.conn.handler))
            if address is None or address.is_private:
                return
            counter.count(str(address), self.geoip.country(str(address)), time.monotonic())
        except Exception:
            logger.exception("could not count visit")

    def run(self):
        logger.debug("visitor counter thread starting up")
        while not self.endEvent.wait(timeout=1):
            try:
                self.counter.flush(time.monotonic())
            except Exception:
                logger.exception("could not save visitor counter")
