"""AdGuard VPN for Decky: a Quick Access panel around the official adguardvpn-cli.

The plugin runs as root (flag "root" in plugin.json) because TUN mode needs it.
The CLI keeps its login and config under $HOME, so every call gets a HOME inside
the plugin's settings directory; that keeps one stable account no matter which
user Decky runs us as.
"""

import asyncio
import json
import logging
import os
import platform
import re
import shutil
import signal
import ssl
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "py_modules"))
import qr  # noqa: E402

SETTINGS_DIR = os.environ.get("DECKY_PLUGIN_SETTINGS_DIR", "/tmp/adguard-vpn-decky")
RUNTIME_DIR = os.environ.get("DECKY_PLUGIN_RUNTIME_DIR", SETTINGS_DIR)

CLI_HOME = os.path.join(SETTINGS_DIR, "home")
CLI_DIR = os.path.join(RUNTIME_DIR, "cli")
CLI_BIN = os.path.join(CLI_DIR, "adguardvpn-cli")
PREFS_FILE = os.path.join(SETTINGS_DIR, "prefs.json")
RELEASE_API = "https://api.github.com/repos/AdguardTeam/AdGuardVPNCLI/releases/latest"

ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|\r")
CONNECTED_RE = re.compile(
    r"Connected to\s+(?P<loc>.+?)\s+in\s+(?P<mode>TUN|SOCKS)\s+mode", re.IGNORECASE
)
EMAIL_RE = re.compile(r"Logged in as\s+(\S+@\S+)", re.IGNORECASE)
TIER_RE = re.compile(r"using the\s+([A-Za-z]+)\s+version", re.IGNORECASE)
VALID_RE = re.compile(r"valid until\s+(\d{4}-\d{2}-\d{2})", re.IGNORECASE)
DEVICE_URL_RE = re.compile(r"https://\S*device_code\S*")
USER_CODE_RE = re.compile(r"user_code=([A-Za-z0-9-]+)")
ANY_URL_RE = re.compile(r"https://\S+")

LICENSE_CACHE_SEC = 120
LOCATIONS_CACHE_SEC = 300
LOGIN_TIMEOUT_SEC = 900

os.makedirs(SETTINGS_DIR, exist_ok=True)
os.makedirs(CLI_HOME, exist_ok=True)

# Decky routes plugin logging into its own per-session file under ~/homebrew/logs/<plugin>/.
log = logging.getLogger("adguard-vpn")

EMAIL_ANY_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
USER_CODE_ANY_RE = re.compile(r"(user_code=)[A-Za-z0-9-]+")
# Polled every couple of seconds while the panel is open; only failures are worth a line.
ROUTINE_COMMANDS = {"status", "license", "list-locations", "--version"}


class PluginError(RuntimeError):
    """A failure the panel can explain in the user's language."""

    def __init__(self, code, detail=""):
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code
        self.detail = detail


def make_error(code, detail=""):
    return {"code": code, "detail": str(detail)}


def clean(text):
    return ANSI_RE.sub("", text or "").strip()


def redact(text):
    """Keep the user's account email and one-time login codes out of log files,
    which people may share when asking for help."""
    text = EMAIL_ANY_RE.sub("<email>", text or "")
    return USER_CODE_ANY_RE.sub(r"\1<code>", text)


def load_prefs():
    prefs = {"auto_connect": False, "location": "", "favorites": []}
    try:
        with open(PREFS_FILE) as f:
            prefs.update(json.load(f))
    except (OSError, ValueError):
        pass
    return prefs


CACHE_FILE = os.path.join(SETTINGS_DIR, "cache.json")
REFRESH_MIN_SEC = 1.5


def load_cache():
    """Last known account and connection, so the panel has something to show
    before the first CLI calls come back."""
    try:
        with open(CACHE_FILE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_cache():
    data = {"status": state.status, "license": state.license}
    try:
        tmp = CACHE_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(data, f)
        os.replace(tmp, CACHE_FILE)
    except OSError as e:
        log.info("cache not saved: %s", e)


async def refresh_all():
    try:
        if not os.path.isfile(CLI_BIN):
            return
        if not state.version:
            await refresh_version()
        await refresh_status()
        await refresh_license()
        state.ready = True
        save_cache()
    except Exception:
        log.exception("refresh failed")
    finally:
        state.refreshed_at = time.monotonic()
        state.refreshing = None


def request_refresh():
    """Start a background refresh unless one is running or one just finished."""
    if state.refreshing or state.busy:
        return
    if time.monotonic() - state.refreshed_at < REFRESH_MIN_SEC:
        return
    state.refreshing = spawn(refresh_all())


def save_prefs():
    tmp = PREFS_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state.prefs, f)
    os.replace(tmp, PREFS_FILE)


def cli_env():
    env = dict(os.environ)
    env.update(
        HOME=CLI_HOME,
        LANG="C.UTF-8",
        LC_ALL="C.UTF-8",
        TERM="dumb",
        NO_COLOR="1",
        PATH=f"{CLI_DIR}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    )
    # Decky's environment can carry its bundled library paths; the CLI wants the system's.
    env.pop("LD_LIBRARY_PATH", None)
    for path in CA_BUNDLES:
        if os.path.isfile(path):
            env.setdefault("SSL_CERT_FILE", path)
            break
    return env


async def run_cli(*args, timeout=30):
    """Run the CLI to completion and return (exit code, cleaned output)."""
    if not os.path.isfile(CLI_BIN):
        return 127, "adguardvpn-cli is not installed"
    proc = await asyncio.create_subprocess_exec(
        CLI_BIN,
        *args,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        env=cli_env(),
        cwd=CLI_HOME,
        # `connect` forks the VPN service; keep it out of Decky's process group
        # so reloading the plugin does not take the tunnel down with it.
        start_new_session=True,
    )
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return 124, f"timed out after {timeout}s: {' '.join(args)}"
    text = clean(out.decode("utf-8", "replace"))
    routine = args and args[0] in ROUTINE_COMMANDS and proc.returncode == 0
    log.log(logging.DEBUG if routine else logging.INFO,
            "cli %s -> %s: %s", " ".join(args), proc.returncode, redact(text[:500]))
    return proc.returncode, text


class State:
    def __init__(self):
        self.prefs = load_prefs()
        self.busy = ""  # what the backend is doing right now, shown in the panel
        self.error = ""
        self.version = ""
        self.status = {"connected": False, "location": "", "mode": ""}
        self.license = {"logged_in": False, "email": "", "tier": "", "valid_until": ""}
        self.license_at = 0.0
        self.locations = []
        self.locations_at = 0.0
        self.login = {"active": False, "url": "", "code": "", "output": "", "qr": []}
        self.login_proc = None
        self.update = {"latest": "", "available": False, "checked": False}
        self.update_at = 0.0
        self.ready = False  # True once a background refresh has finished
        self.refreshing = None
        self.refreshed_at = 0.0
        self.tasks = set()
        cached = load_cache()
        self.status.update(cached.get("status", {}))
        self.license.update(cached.get("license", {}))
        self.lock = asyncio.Lock()


state = State()


def spawn(coro):
    task = asyncio.create_task(coro)
    state.tasks.add(task)
    task.add_done_callback(state.tasks.discard)
    return task


VERSION_FILE = os.path.join(CLI_DIR, "VERSION")
VERSION_RE = re.compile(r"(\d+)\.(\d+)\.(\d+)")
UPDATE_CHECK_SEC = 6 * 3600


def version_tuple(text):
    match = VERSION_RE.search(text or "")
    return tuple(int(x) for x in match.groups()) if match else None


async def refresh_version():
    if not os.path.isfile(CLI_BIN):
        state.version = ""
        return
    # The release tag recorded at install time is exact; --version output is the fallback.
    try:
        with open(VERSION_FILE) as f:
            tag = f.read().strip()
    except OSError:
        tag = ""
    if version_tuple(tag):
        state.version = tag
        return
    rc, out = await run_cli("--version", timeout=10)
    found = VERSION_RE.search(out) if rc == 0 else None
    state.version = f"v{found.group(0)}" if found else ""


def latest_release():
    return json.loads(fetch(RELEASE_API))


async def check_update(force=False):
    if not force and time.monotonic() - state.update_at < UPDATE_CHECK_SEC:
        return
    release = await asyncio.to_thread(latest_release)
    latest = release.get("tag_name", "")
    current = version_tuple(state.version)
    newest = version_tuple(latest)
    state.update = {
        "latest": latest,
        # Unknown installed version counts as outdated so the user can still refresh it.
        "available": bool(newest) and (current is None or newest > current),
        "checked": True,
    }
    state.update_at = time.monotonic()
    log.info("update check: installed=%s latest=%s", state.version, latest)


async def quiet_update_check():
    try:
        await check_update()
    except Exception as e:
        log.info("update check failed: %s", e)


async def refresh_status():
    rc, out = await run_cli("status", timeout=15)
    match = CONNECTED_RE.search(" ".join(out.split()))
    state.status = {
        "connected": bool(match),
        "location": match.group("loc") if match else "",
        "mode": match.group("mode").upper() if match else "",
    }


async def refresh_license(force=False):
    if not force and time.monotonic() - state.license_at < LICENSE_CACHE_SEC:
        return
    rc, out = await run_cli("license", timeout=30)
    low = out.lower()
    email = EMAIL_RE.search(out)
    tier = TIER_RE.search(out)
    valid = VALID_RE.search(out)
    logged_in = bool(email) and "not logged in" not in low
    state.license = {
        "logged_in": logged_in,
        "email": email.group(1) if email else "",
        "tier": tier.group(1).upper() if tier else "",
        "valid_until": valid.group(1) if valid else "",
    }
    # A network hiccup should not look like a logout; retry sooner next time.
    state.license_at = time.monotonic() if rc == 0 else time.monotonic() - LICENSE_CACHE_SEC + 15


def parse_locations(out):
    found = []
    for line in out.splitlines():
        cols = re.split(r"\s{2,}", line.strip())
        if len(cols) < 3:
            continue
        iso = cols[0].upper()
        if len(iso) != 2 or not iso.isalpha() or iso == "IS":
            continue
        ping = None
        if len(cols) >= 4:
            digits = re.findall(r"\d+", cols[3])
            ping = int(digits[0]) if digits else None
        found.append({"iso": iso, "country": cols[1], "city": cols[2], "ping": ping})
    return found


async def connect_vpn(location):
    args = ["connect", "-y"]
    args += ["-l", location] if location else ["-f"]
    rc, out = await run_cli(*args, timeout=90)
    await refresh_status()
    if not state.status["connected"]:
        state.error = make_error("connect_failed", out.splitlines()[-1] if out else f"code {rc}")
    return state.status["connected"]


def pick_asset(assets):
    arch = {"x86_64": "x86_64", "amd64": "x86_64", "aarch64": "aarch64", "arm64": "aarch64"}
    want = f"linux-{arch.get(platform.machine().lower(), platform.machine().lower())}.tar.gz"
    for asset in assets:
        if asset["name"].endswith(want):
            return asset
    raise PluginError("arch_unsupported", platform.machine())


CA_BUNDLES = (
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/ca-certificates/extracted/tls-ca-bundle.pem",
    "/etc/pki/tls/certs/ca-bundle.crt",
    "/etc/ssl/cert.pem",
)


def tls_context():
    """Decky's bundled Python does not know where SteamOS keeps its CA certificates."""
    for path in CA_BUNDLES:
        if os.path.isfile(path):
            return ssl.create_default_context(cafile=path)
    return ssl.create_default_context()


def fetch(url, dest=None):
    req = urllib.request.Request(url, headers={"User-Agent": "decky-adguard-vpn"})
    with urllib.request.urlopen(req, timeout=60, context=tls_context()) as resp:
        if dest is None:
            return resp.read()
        with open(dest, "wb") as f:
            shutil.copyfileobj(resp, f)


# AdGuard's release signing key, as published in the AdGuardVPNCLI README
# ("Verify Releases"). The key itself ships with the plugin in keys/adguard.gpg.
ADGUARD_KEY_FPR = "28645AC9776EC4C00BCE2AFC0FE641E7235E2EC6"
ADGUARD_KEYRING = os.path.join(os.path.dirname(os.path.abspath(__file__)), "keys", "adguard.gpg")
GPGV_PATHS = ("/usr/bin/gpgv", "/bin/gpgv")


def verify_signature(binary, signature):
    """Raise unless `signature` is a good signature of `binary` by AdGuard's key.
    gpgv only trusts the keyring it is given, so no system keys are involved."""
    gpgv = next((p for p in GPGV_PATHS if os.path.isfile(p)), None) or shutil.which("gpgv")
    if not gpgv:
        raise PluginError("gpgv_missing")
    if not os.path.isfile(ADGUARD_KEYRING):
        raise PluginError("key_missing")
    if not os.path.isfile(signature):
        raise PluginError("sig_missing")
    with tempfile.TemporaryDirectory() as gnupg_home:
        env = {k: v for k, v in os.environ.items() if k != "LD_LIBRARY_PATH"}
        env.update(GNUPGHOME=gnupg_home, LANG="C", LC_ALL="C")
        proc = subprocess.run(
            [gpgv, "--status-fd", "1", "--keyring", ADGUARD_KEYRING, signature, binary],
            capture_output=True, text=True, timeout=60, env=env,
        )
    # VALIDSIG <signing key fpr> <date> ... <primary key fpr>
    valid = [
        line.split() for line in proc.stdout.splitlines() if line.startswith("[GNUPG:] VALIDSIG ")
    ]
    if proc.returncode != 0 or not any(fields[-1] == ADGUARD_KEY_FPR for fields in valid):
        log.error("signature check failed rc=%s\n%s\n%s", proc.returncode, proc.stdout, proc.stderr)
        raise PluginError("sig_invalid")
    log.info("signature ok: %s", binary)


def install_cli_blocking():
    release = latest_release()
    asset = pick_asset(release["assets"])
    with tempfile.TemporaryDirectory(dir=RUNTIME_DIR) as tmp:
        archive = os.path.join(tmp, asset["name"])
        fetch(asset["browser_download_url"], archive)
        unpack = os.path.join(tmp, "unpack")
        with tarfile.open(archive) as tar:
            try:
                tar.extractall(unpack, filter="data")
            except TypeError:  # Python without extraction filters
                for member in tar.getmembers():
                    if member.name.startswith("/") or ".." in member.name.split("/"):
                        raise PluginError("archive_bad_path", member.name)
                    if not (member.isfile() or member.isdir()):
                        raise PluginError("archive_bad_entry", member.name)
                tar.extractall(unpack)
        binary = None
        for root, _, files in os.walk(unpack):
            if "adguardvpn-cli" in files:
                binary = root
                break
        if not binary:
            raise PluginError("archive_no_cli")
        # This binary will run as root: refuse it unless AdGuard's own key signed it.
        verify_signature(os.path.join(binary, "adguardvpn-cli"), os.path.join(binary, "adguardvpn-cli.sig"))
        staged = CLI_DIR + ".new"
        shutil.rmtree(staged, ignore_errors=True)
        shutil.copytree(binary, staged)
        os.chmod(os.path.join(staged, "adguardvpn-cli"), 0o755)
        with open(os.path.join(staged, "VERSION"), "w") as f:
            f.write(release["tag_name"])
        with open(os.path.join(staged, "VERIFIED"), "w") as f:
            f.write(ADGUARD_KEY_FPR)
        shutil.rmtree(CLI_DIR, ignore_errors=True)
        os.replace(staged, CLI_DIR)
    return release["tag_name"]


async def install_task(updating=False):
    reconnect = False
    try:
        if updating:
            # The running VPN service is the old binary; stop it so the new one takes over.
            await refresh_status()
            reconnect = state.status["connected"]
            if reconnect:
                await run_cli("disconnect", timeout=30)
        tag = await asyncio.to_thread(install_cli_blocking)
        log.info("installed adguardvpn-cli %s", tag)
        # Crash reports and hints only add noise to non-interactive output.
        await run_cli("config", "set-crash-reporting", "off")
        await run_cli("config", "set-show-hints", "off")
        await refresh_version()
        state.update = {"latest": tag, "available": False, "checked": True}
        state.update_at = time.monotonic()
        await refresh_license(force=True)
    except PluginError as e:
        log.exception("install refused")
        state.error = make_error(e.code, e.detail)
    except Exception as e:
        log.exception("install failed")
        state.error = make_error("update_failed" if updating else "install_failed", e)
    finally:
        if reconnect:
            state.busy = "reconnecting"
            await connect_vpn(state.prefs["location"])
        state.busy = ""


async def login_task():
    """`adguardvpn-cli login` without a terminal prints a device-code URL and then
    waits until the browser side is finished."""
    state.login = {"active": True, "url": "", "code": "", "output": "", "qr": []}
    try:
        proc = await asyncio.create_subprocess_exec(
            CLI_BIN,
            "login",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=cli_env(),
            cwd=CLI_HOME,
            start_new_session=True,
        )
        state.login_proc = proc
        lines = []

        async def read_output():
            while True:
                chunk = await proc.stdout.read(1024)
                if not chunk:
                    return
                text = clean(chunk.decode("utf-8", "replace"))
                lines.append(text)
                joined = "\n".join(lines)
                state.login["output"] = joined[-1500:]
                if not state.login["url"]:
                    url = DEVICE_URL_RE.search(joined) or ANY_URL_RE.search(joined)
                    if url:
                        state.login["url"] = url.group(0).rstrip(".,)")
                        code = USER_CODE_RE.search(state.login["url"])
                        state.login["code"] = code.group(1) if code else ""
                        try:
                            state.login["qr"] = qr.encode_rows(state.login["url"])
                        except ValueError:
                            log.info("login link too long for a QR code")
                # Older builds ask how to log in; "b" picks the browser link.
                if re.search(r"\bb\s*-\s*Open link", text, re.IGNORECASE):
                    proc.stdin.write(b"b\n")
                    await proc.stdin.drain()

        await asyncio.wait_for(read_output(), LOGIN_TIMEOUT_SEC)
        rc = await proc.wait()
        log.info("login exited %s: %s", rc, redact(state.login["output"][-500:]))
        if rc != 0 and proc.returncode != -signal.SIGTERM:
            state.error = make_error("login_failed", lines[-1] if lines else f"code {rc}")
    except asyncio.TimeoutError:
        state.error = make_error("login_timeout")
        if state.login_proc:
            state.login_proc.kill()
    except Exception as e:
        log.exception("login failed")
        state.error = make_error("login_failed", e)
    finally:
        state.login_proc = None
        state.login = {"active": False, "url": "", "code": "", "output": "", "qr": []}
        await refresh_license(force=True)


async def auto_connect_task():
    # Network can take a while after boot or wake; try for about two minutes.
    for attempt in range(8):
        await refresh_status()
        if state.status["connected"]:
            return
        await refresh_license(force=True)
        if state.license["logged_in"]:
            async with state.lock:
                state.busy = "auto_connecting"
                try:
                    if await connect_vpn(state.prefs["location"]):
                        state.error = ""
                        return
                finally:
                    state.busy = ""
        await asyncio.sleep(15)


def snapshot():
    return {
        "installed": os.path.isfile(CLI_BIN),
        "version": state.version,
        "busy": state.busy,
        "error": state.error,
        "status": state.status,
        "license": state.license,
        "login": state.login,
        "prefs": state.prefs,
        "update": state.update,
        "ready": state.ready,
        # Installs from before signature checking have no marker; updating adds it.
        "verified": os.path.isfile(os.path.join(CLI_DIR, "VERIFIED")),
    }


class Plugin:
    async def _main(self):
        await refresh_version()
        if state.version and state.prefs["auto_connect"]:
            spawn(auto_connect_task())
        if state.version:
            spawn(quiet_update_check())
            # Warm up so the first panel open already has fresh state.
            request_refresh()
        log.info("loaded, cli=%s", state.version or "missing")

    async def _unload(self):
        # The tunnel is a separate service and keeps running; only stop our helpers.
        if state.login_proc:
            state.login_proc.terminate()
        for task in list(state.tasks):
            task.cancel()

    async def get_state(self):
        # Answer with what we know now; the CLI calls run behind it and the
        # panel's next poll picks up their results.
        request_refresh()
        return snapshot()

    async def clear_error(self):
        state.error = ""
        return snapshot()

    async def install_cli(self):
        if not state.busy:
            state.busy = "installing"
            state.error = ""
            spawn(install_task())
        return snapshot()

    async def start_login(self):
        if not state.login["active"] and os.path.isfile(CLI_BIN):
            state.error = ""
            # Mark it started now, before the task runs, so the wait below and the
            # panel's next poll both see a login in progress.
            state.login = {"active": True, "url": "", "code": "", "output": "", "qr": []}
            spawn(login_task())
            # Give the CLI a moment to print its link before the panel polls again.
            for _ in range(20):
                if state.login["url"] or not state.login["active"]:
                    break
                await asyncio.sleep(0.25)
        return snapshot()

    async def cancel_login(self):
        if state.login_proc:
            state.login_proc.terminate()
        return snapshot()

    async def logout(self):
        async with state.lock:
            state.busy = "logging_out"
            try:
                await run_cli("disconnect", timeout=30)
                await run_cli("logout", timeout=30)
                await refresh_status()
                await refresh_license(force=True)
            finally:
                state.busy = ""
        return snapshot()

    async def list_locations(self, force=False):
        if force or not state.locations or time.monotonic() - state.locations_at > LOCATIONS_CACHE_SEC:
            rc, out = await run_cli("list-locations", timeout=60)
            parsed = parse_locations(out)
            if parsed:
                state.locations = parsed
                state.locations_at = time.monotonic()
        return state.locations

    async def connect(self, location=None):
        if location is not None:
            state.prefs["location"] = location
            save_prefs()
        async with state.lock:
            state.busy = "connecting"
            state.error = ""
            try:
                if state.status["connected"]:
                    await run_cli("disconnect", timeout=30)
                await connect_vpn(state.prefs["location"])
            finally:
                state.busy = ""
        return snapshot()

    async def disconnect(self):
        async with state.lock:
            state.busy = "disconnecting"
            state.error = ""
            try:
                rc, out = await run_cli("disconnect", timeout=30)
                await refresh_status()
                if state.status["connected"]:
                    state.error = make_error("disconnect_failed", out.splitlines()[-1] if out else "")
            finally:
                state.busy = ""
        return snapshot()

    async def set_auto_connect(self, enabled):
        state.prefs["auto_connect"] = bool(enabled)
        save_prefs()
        return snapshot()

    async def set_location(self, city):
        """Remember a location without connecting; the next connect uses it."""
        state.prefs["location"] = city or ""
        save_prefs()
        return snapshot()

    async def toggle_favorite(self, city):
        favorites = state.prefs.setdefault("favorites", [])
        if not city:
            return snapshot()
        if city in favorites:
            favorites.remove(city)
        else:
            favorites.append(city)
        save_prefs()
        return snapshot()

    async def check_update(self):
        state.error = ""
        try:
            await refresh_version()
            await check_update(force=True)
        except Exception as e:
            log.exception("update check failed")
            state.error = make_error("update_check_failed", e)
        return snapshot()

    async def update_cli(self):
        if not state.busy:
            state.busy = "updating"
            state.error = ""
            spawn(install_task(updating=True))
        return snapshot()

    async def uninstall_cli(self):
        """Remove the CLI together with its login and config. Favorites and the
        plugin's own preferences stay."""
        async with state.lock:
            state.busy = "uninstalling"
            state.error = ""
            try:
                if state.login_proc:
                    state.login_proc.terminate()
                if os.path.isfile(CLI_BIN):
                    await run_cli("disconnect", timeout=30)
                    # Logging out frees this device's slot on the AdGuard account.
                    await run_cli("logout", timeout=30)
                await asyncio.to_thread(shutil.rmtree, CLI_DIR, True)
                await asyncio.to_thread(shutil.rmtree, CLI_HOME, True)
                os.makedirs(CLI_HOME, exist_ok=True)
                state.version = ""
                state.status = {"connected": False, "location": "", "mode": ""}
                state.license = {"logged_in": False, "email": "", "tier": "", "valid_until": ""}
                state.license_at = 0.0
                state.locations = []
                state.update = {"latest": "", "available": False, "checked": False}
                state.ready = False
                save_cache()
                log.info("adguardvpn-cli removed")
            except Exception as e:
                log.exception("uninstall failed")
                state.error = make_error("uninstall_failed", e)
            finally:
                state.busy = ""
        return snapshot()
