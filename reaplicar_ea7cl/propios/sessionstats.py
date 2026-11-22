"""
Session behaviour statistics (proof of concept).

Samples the tuned frequency of every receiver client once per second and
writes one INFO line to the log as soon as a session matches the pattern:

  1. Since it first reached the 2m band, it has never left it.
  2. It has tuned at most one frequency that is not an R[0-9] bookmark.
  3. It has stayed tuned to R[0-9] bookmarks only for 10 minutes in a row.
  4. Its IP address geolocates to Europe (private addresses count as Europe).

Only one line is written per session.

It also keeps the visitor counter shown by the "contador" receiver plugin:
visits (the same address within 30 minutes is one visit), unique visitors
and unique visitors per country. Addresses are never stored, only a salted
hash; the public file only holds totals. Local network addresses are not counted.
"""

from owrx.bands import Bandplan
from owrx.bookmarks import Bookmarks
from owrx.client import ClientRegistry
from datetime import datetime
from ipaddress import ip_address
import threading
import weakref
import hashlib
import secrets
import json
import time
import os
import re

import logging

logger = logging.getLogger(__name__)


# Country database (DB-IP "IP to Country Lite", CC BY 4.0, https://db-ip.com)
GEOIP_DATABASE = "/var/lib/openwebrx/geoip/dbip-country-lite.mmdb"
# Band the session has to stay in
BAND_NAME = "2m"
# Bookmarks the session has to listen to
BOOKMARK_PATTERN = re.compile(r"^R[0-9](?![0-9])")
# Maximum distance between tuned frequency and bookmark, in Hz
FREQUENCY_TOLERANCE = 2500
# Maximum number of distinct non-bookmark frequencies
MAX_OTHER_FREQUENCIES = 1
# Seconds in a row that have to be spent on bookmarks only
BOOKMARK_DWELL_TIME = 10 * 60
# EA7CL: segundo aviso tras esta racha seguida (30 min)
BOOKMARK_LONG_DWELL_TIME = 30 * 60
# Seconds between frequency samples
SAMPLE_INTERVAL = 1
# Seconds between bookmark list refreshes
BOOKMARK_REFRESH_INTERVAL = 30

# Visitor counter: private state, hashes of known visitors and public totals
COUNTER_FILE = "/var/lib/openwebrx/contador.json"
COUNTER_FINGERPRINTS = "/var/lib/openwebrx/contador-huellas.txt"
COUNTER_PUBLIC = "/usr/lib/python3/dist-packages/htdocs/plugins/receiver/contador/datos.json"
# Visitors counted by Flag Counter before this counter existed
COUNTER_BASE = 350000
# Seconds during which the same address counts as one visit
COUNTER_WINDOW = 30 * 60
# Countries listed in the public file
COUNTER_TOP_COUNTRIES = 24
# Minimum seconds between writes to disk
COUNTER_WRITE_INTERVAL = 10


class GeoIp(object):
    def __init__(self):
        self.reader = None
        try:
            import maxminddb
            self.reader = maxminddb.open_database(GEOIP_DATABASE)
        except Exception as e:
            logger.warning("GeoIP database not available, sessions will not be geolocated: %s", e)

    def lookup(self, ip: str):
        # Returns (country code, country name, continent code)
        if ip is None:
            return (None, None, None)
        if ip_address(ip).is_private:
            return ("LAN", "Red local", "EU")
        if self.reader is None:
            return (None, None, None)
        try:
            record = self.reader.get(ip) or {}
        except Exception:
            logger.exception("GeoIP lookup failed for %s", ip)
            return (None, None, None)
        country = record.get("country", {})
        continent = record.get("continent", {})
        return (
            country.get("iso_code"),
            country.get("names", {}).get("en"),
            continent.get("code"),
        )


class UserAgent(object):
    BROWSERS = [
        ("Edge", r"Edg(?:e|A|iOS)?/([\d.]+)"),
        ("Opera", r"(?:OPR|Opera)/([\d.]+)"),
        ("Samsung Internet", r"SamsungBrowser/([\d.]+)"),
        ("Firefox", r"(?:Firefox|FxiOS)/([\d.]+)"),
        ("Chrome", r"(?:Chrome|CriOS)/([\d.]+)"),
        ("Safari", r"Version/([\d.]+).*Safari/"),
    ]
    SYSTEMS = [
        ("Windows", r"Windows NT ([\d.]+)"),
        ("Android", r"Android ([\d.]+)"),
        ("iOS", r"(?:iPhone|iPad|iPod).*? OS ([\d_]+)"),
        ("macOS", r"Mac OS X ([\d_.]+)"),
        ("ChromeOS", r"CrOS \S+ ([\d.]+)"),
        ("Linux", r"Linux()"),
    ]
    WINDOWS_VERSIONS = {"10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7"}

    @staticmethod
    def parse(ua: str):
        # Returns (browser, operating system)
        browser = "Desconocido"
        for name, pattern in UserAgent.BROWSERS:
            m = re.search(pattern, ua)
            if m:
                browser = "{0} {1}".format(name, m.group(1).split(".")[0])
                break
        system = "Desconocido"
        for name, pattern in UserAgent.SYSTEMS:
            m = re.search(pattern, ua)
            if m:
                version = m.group(1).replace("_", ".")
                if name == "Windows":
                    version = UserAgent.WINDOWS_VERSIONS.get(version, version)
                system = "{0} {1}".format(name, version).strip()
                break
        return (browser, system)


def _normalizeIp(ip: str):
    # Returns the canonical address without IPv6 zone, or None if it is not an address
    try:
        address = ip_address(ip.split("%")[0].strip())
    except (ValueError, AttributeError):
        return None
    if address.version == 6 and address.ipv4_mapped is not None:
        address = address.ipv4_mapped
    return str(address)


def _language(acceptLanguage: str):
    # Returns the preferred language tag of an Accept-Language header
    m = re.match(r"\s*([A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*)", acceptLanguage or "")
    return m.group(1) if m else None


class SessionState(object):
    def __init__(self, client, geoip: GeoIp):
        handler = client.conn.handler
        self.startTime = datetime.now()
        self.ip = _normalizeIp(ClientRegistry.getSharedInstance().getIp(handler))
        (self.browser, self.system) = UserAgent.parse(handler.headers.get("User-Agent") or "")
        self.language = _language(handler.headers.get("Accept-Language"))
        (self.countryCode, self.countryName, self.continent) = geoip.lookup(self.ip)
        # Last raw sample, a frequency only counts once it is seen twice in a row
        self.lastFrequency = None
        # Time the session first reached the band, None until then
        self.inBandSince = None
        # Reason why the session cannot match anymore, None while it can
        self.discarded = None
        # Distinct non-bookmark frequencies tuned so far
        self.otherFrequencies = []
        # Bookmarks tuned during the current streak
        self.streakBookmarks = {}
        # Start of the current bookmark-only streak, None outside a streak
        self.streakStart = None
        self.reported = False
        # EA7CL: avisos ya escritos (a los 10 min y a los 30 min)
        self.reports = 0

    def isEuropean(self):
        return self.continent == "EU"

    def finished(self):
        return self.reports >= 2 or self.discarded is not None

    def sample(self, now: float, frequency: int, inBand: bool, bookmark):
        # Skip transient values (dial being dragged, profile being switched)
        stable = frequency == self.lastFrequency
        self.lastFrequency = frequency
        if not stable:
            return

        if self.inBandSince is None:
            # Ignore everything until the session reaches the band
            if not inBand:
                return
            self.inBandSince = now

        if not inBand:
            self.discarded = "left band at {0} Hz".format(frequency)
            return

        if bookmark is None:
            self.streakStart = None
            self.streakBookmarks = {}
            if not any(abs(frequency - f) <= FREQUENCY_TOLERANCE for f in self.otherFrequencies):
                self.otherFrequencies.append(frequency)
            if len(self.otherFrequencies) > MAX_OTHER_FREQUENCIES:
                self.discarded = "too many non-bookmark frequencies"
            return

        if self.streakStart is None:
            self.streakStart = now
        self.streakBookmarks[bookmark.getFrequency()] = bookmark.getName()

    def matches(self, now: float):
        return (
            not self.finished()
            and self.isEuropean()
            and self.streakStart is not None
            and now - self.streakStart >= (BOOKMARK_DWELL_TIME if self.reports == 0 else BOOKMARK_LONG_DWELL_TIME)
        )

    def report(self, now: float):
        self.reported = True
        self.reports += 1
        bookmarks = ", ".join(
            "{0:.4f} {1}".format(f / 1e6, n) for f, n in sorted(self.streakBookmarks.items())
        )
        others = ", ".join("{0:.4f}".format(f / 1e6) for f in self.otherFrequencies) or "-"
        # Every value is either validated or parsed into a fixed charset, no client text is logged verbatim
        logger.info(
            "Patron 2m/R[0-9] detectado: ip=%s pais=%s (%s) navegador=%s so=%s idioma=%s "
            "inicio_sesion=%s racha_marcadores=%ds marcadores=[%s] otras_frecuencias=[%s]",
            self.ip,
            self.countryCode or "?",
            self.countryName or "?",
            self.browser.replace(" ", "_"),
            self.system.replace(" ", "_"),
            self.language or "?",
            self.startTime.isoformat(timespec="seconds"),
            now - self.streakStart,
            bookmarks,
            others,
        )


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


class SessionStatsThread(threading.Thread):
    sharedInstance = None
    creationLock = threading.Lock()

    @staticmethod
    def getSharedInstance():
        with SessionStatsThread.creationLock:
            if SessionStatsThread.sharedInstance is None:
                SessionStatsThread.sharedInstance = SessionStatsThread()
        return SessionStatsThread.sharedInstance

    def __init__(self):
        # Weak keys: a client closed before add_client returns can not leak here
        self.sessions = weakref.WeakKeyDictionary()
        self.lock = threading.Lock()
        self.geoip = None
        self.bookmarks = []
        self.bookmarksTime = 0
        self.counter = None
        self.counterFailed = False
        self.endEvent = threading.Event()
        super().__init__(name="session_stats", daemon=True)

    def add_client(self, c):
        # Statistics must never break a client connection
        try:
            with self.lock:
                if self.geoip is None:
                    self.geoip = GeoIp()
                state = SessionState(c, self.geoip)
                self.sessions[c] = state
                if not self.is_alive():
                    self.start()
            logger.debug("tracking session from %s (%s)", state.ip, state.countryCode)
        except Exception:
            logger.exception("could not start tracking session")
            return
        self._count(state)

    def _count(self, state: SessionState):
        # The counter must never break a client connection either
        try:
            # Created on the first connection of any kind, so the public totals exist from the start
            with self.lock:
                if self.counter is None and not self.counterFailed:
                    try:
                        self.counter = VisitCounter()
                    except Exception:
                        self.counterFailed = True
                        logger.exception("visitor counter disabled, could not read %s", COUNTER_FILE)
                counter = self.counter
            if state.ip is None or ip_address(state.ip).is_private:
                return
            if counter is not None:
                counter.count(state.ip, state.countryCode, time.monotonic())
        except Exception:
            logger.exception("could not count visit")

    def remove_client(self, c):
        try:
            with self.lock:
                self.sessions.pop(c, None)
        except Exception:
            logger.exception("could not stop tracking session")

    def run(self):
        logger.debug("session stats thread starting up")
        while not self.endEvent.wait(timeout=SAMPLE_INTERVAL):
            try:
                self._sampleAll()
            except Exception:
                logger.exception("error while sampling sessions")
            try:
                if self.counter is not None:
                    self.counter.flush(time.monotonic())
            except Exception:
                logger.exception("could not save visitor counter")

    def _refreshBookmarks(self, now: float):
        if self.bookmarks and now - self.bookmarksTime < BOOKMARK_REFRESH_INTERVAL:
            return
        bookmarks = [
            b for b in Bookmarks.getSharedInstance().getBookmarks() if BOOKMARK_PATTERN.match(b.getName())
        ]
        # Keep the previous list if the file is being rewritten
        if bookmarks:
            self.bookmarks = bookmarks
            self.bookmarksTime = now

    def _findBookmark(self, frequency: int):
        for b in self.bookmarks:
            if abs(b.getFrequency() - frequency) <= FREQUENCY_TOLERANCE:
                return b
        return None

    @staticmethod
    def _getFrequency(client):
        dsp = client.dsp
        if dsp is None:
            return None
        props = dsp.props
        if "center_freq" not in props:
            return None
        if "offset_freq" in props:
            offset = props["offset_freq"]
        elif "start_freq" in props:
            # The client has not retuned yet, it is still on the profile start frequency
            offset = props["start_freq"] - props["center_freq"]
        else:
            return None
        return int(props["center_freq"] + offset)

    def _sampleAll(self):
        now = time.monotonic()
        with self.lock:
            sessions = [(c, s) for c, s in self.sessions.items() if not s.finished() and s.isEuropean()]
        if not sessions:
            return
        self._refreshBookmarks(now)
        if not self.bookmarks:
            # Without bookmarks every frequency would count as non-bookmark
            return
        bandplan = Bandplan.getSharedInstance()
        for c, s in sessions:
            try:
                frequency = SessionStatsThread._getFrequency(c)
            except Exception:
                # DSP is being replaced, try again on the next sample
                continue
            if frequency is None:
                continue
            inBand = any(b.getName() == BAND_NAME for b in bandplan.findBands(frequency))
            s.sample(now, frequency, inBand, self._findBookmark(frequency))
            if s.matches(now):
                s.report(now)
