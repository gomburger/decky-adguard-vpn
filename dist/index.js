const manifest = { name: "AdGuard VPN" };
const API_VERSION = 2;
const internalAPIConnection = window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit;
if (!internalAPIConnection) {
    throw new Error("[AdGuard VPN] Decky Loader API is not available");
}
let api;
try {
    api = internalAPIConnection.connect(API_VERSION, manifest.name);
}
catch {
    api = internalAPIConnection.connect(1, manifest.name);
}
const callable = api.callable;
const getState = callable("get_state");
const clearError = callable("clear_error");
const installCli = callable("install_cli");
const startLogin = callable("start_login");
const cancelLogin = callable("cancel_login");
const logout = callable("logout");
const listLocations = callable("list_locations");
const connect = callable("connect");
const disconnect = callable("disconnect");
const setAutoConnect = callable("set_auto_connect");
const toggleFavorite = callable("toggle_favorite");
const setLocation = callable("set_location");
const checkUpdate = callable("check_update");
const updateCli = callable("update_cli");
const uninstallCli = callable("uninstall_cli");

const h = SP_REACT.createElement;
const { useState, useEffect, useRef, useCallback } = SP_REACT;

const POLL_MS = 2000;
const FAST_POLL_MS = 500;
const ON_COLOR = "#67d28c";
const OFF_COLOR = "#9aa4ae";
const ERROR_COLOR = "#ff7a7a";
const NOTE = { fontSize: "12px", lineHeight: "15px", color: "#b8bcbf" };
const FASTEST = "";

const LANG = (() => {
    const locale = window.LocalizationManager?.m_rgLocalesToUse?.[0] || navigator.language || "en";
    return String(locale).toLowerCase().startsWith("ko") ? "ko" : "en";
})();

const STRINGS = {
    en: {
        "busy.reconnecting": "Reconnecting",
        "busy.auto_connecting": "Connecting automatically",
        "busy.installing": "Installing CLI",
        "busy.logging_out": "Logging out",
        "busy.connecting": "Connecting",
        "busy.disconnecting": "Disconnecting",
        "busy.updating": "Updating CLI",
        "busy.uninstalling": "Removing CLI",
        "err.connect_failed": "Connection failed",
        "err.disconnect_failed": "Could not disconnect",
        "err.arch_unsupported": "No CLI build is available for this device",
        "err.gpgv_missing": "Installation stopped: gpgv is needed to check the signature",
        "err.key_missing": "Installation stopped: the plugin's AdGuard signing key is missing",
        "err.sig_missing": "Installation stopped: the release has no signature file (.sig)",
        "err.sig_invalid": "Installation stopped: the AdGuard signature does not match",
        "err.archive_bad_path": "The archive contains an invalid path",
        "err.archive_bad_entry": "The archive contains an unexpected item",
        "err.archive_no_cli": "The archive does not contain adguardvpn-cli",
        "err.install_failed": "Installation failed",
        "err.update_failed": "Update failed",
        "err.login_failed": "Login failed",
        "err.login_timeout": "Login timed out",
        "err.update_check_failed": "Could not check for updates",
        "err.uninstall_failed": "Could not remove the CLI",
        "picker.title": "Choose Location",
        "picker.hint": "City, country, or country code",
        "picker.empty": "No results.",
        "fastest": "⚡ Fastest Location",
        "uninstall.title": "Remove AdGuard VPN CLI?",
        "uninstall.body": "This disconnects the VPN, logs out, and deletes the CLI, your login, and the CLI settings. Favorites and the auto-connect setting are kept. To use it again, install the CLI and log in.",
        "uninstall.ok": "Remove",
        "uninstall.button": "Remove AdGuard VPN CLI",
        "cancel": "Cancel",
        "loading": "Loading…",
        "close": "Close",
        "install.title": "Install",
        "install.body": "Downloads AdGuard's official VPN CLI (adguardvpn-cli) from GitHub into the plugin folder.",
        "install.button": "Install AdGuard VPN CLI",
        "checking": "Checking account…",
        "login.title": "Log In",
        "login.required": "Log in with an AdGuard account. Free accounts work too.",
        "login.button": "Log In",
        "login.waiting": "Getting login link…",
        "login.instructions": "Scan the QR code with your phone, or open the link in the Steam browser with the button below. This panel continues automatically when you finish.",
        "login.open": "Open in Browser",
        "status.connected": "Connected · {location}",
        "status.disconnected": "Not connected",
        "vpn.toggle": "VPN Connection",
        "location": "Location",
        "favorite.add": "★ Add to Favorites",
        "locations.refresh": "Refresh Location List",
        "favorites": "Favorites",
        "settings": "Settings",
        "auto.label": "Auto-Connect",
        "auto.description": "Connects to the last location when Steam starts",
        "account": "Account",
        "account.logged_in": "Logged in",
        "logout": "Log Out",
        "version.unknown": "unknown",
        "version.installed": "Installed version {version}",
        "version.new": "New version {latest} available (current: {version})",
        "version.latest": "Up to date ({version})",
        "signature.ok": "✓ AdGuard official signature verified",
        "signature.none": "No signature check on record (installed by an earlier version)",
        "update.to": "Update to {version}",
        "update.latest": "the latest version",
        "update.reinstall": "Verify Signature and Reinstall",
        "update.reconnect": " (briefly disconnects)",
        "update.check": "Check for Updates",
    },
    ko: {
        "busy.reconnecting": "다시 연결 중",
        "busy.auto_connecting": "자동 연결 중",
        "busy.installing": "CLI 설치 중",
        "busy.logging_out": "로그아웃 중",
        "busy.connecting": "연결 중",
        "busy.disconnecting": "연결 해제 중",
        "busy.updating": "CLI 업데이트 중",
        "busy.uninstalling": "CLI 제거 중",
        "err.connect_failed": "연결 실패",
        "err.disconnect_failed": "연결 해제 실패",
        "err.arch_unsupported": "이 기기용 CLI 파일을 찾지 못했습니다",
        "err.gpgv_missing": "서명을 확인할 gpgv가 없어 설치를 중단했습니다",
        "err.key_missing": "플러그인에 AdGuard 서명 키가 없어 설치를 중단했습니다",
        "err.sig_missing": "릴리스에 서명 파일(.sig)이 없어 설치를 중단했습니다",
        "err.sig_invalid": "AdGuard 서명이 맞지 않아 설치를 중단했습니다",
        "err.archive_bad_path": "압축 파일 경로가 잘못되었습니다",
        "err.archive_bad_entry": "압축 파일에 예상치 못한 항목이 있습니다",
        "err.archive_no_cli": "압축 파일에 adguardvpn-cli가 없습니다",
        "err.install_failed": "설치 실패",
        "err.update_failed": "업데이트 실패",
        "err.login_failed": "로그인 실패",
        "err.login_timeout": "로그인 시간이 초과되었습니다",
        "err.update_check_failed": "업데이트 확인 실패",
        "err.uninstall_failed": "제거 실패",
        "picker.title": "위치 선택",
        "picker.hint": "도시, 나라 이름(한글/영문) 또는 국가 코드",
        "picker.empty": "검색 결과가 없습니다.",
        "fastest": "⚡ 가장 빠른 위치",
        "uninstall.title": "AdGuard VPN CLI를 제거할까요?",
        "uninstall.body": "VPN 연결을 끊고 로그아웃한 뒤 CLI와 로그인 정보, CLI 설정을 지웁니다. 즐겨찾기와 자동 연결 설정은 남습니다. 다시 쓰려면 CLI를 설치하고 로그인해야 합니다.",
        "uninstall.ok": "제거",
        "uninstall.button": "AdGuard VPN CLI 제거",
        "cancel": "취소",
        "loading": "불러오는 중…",
        "close": "닫기",
        "install.title": "설치",
        "install.body": "AdGuard 공식 VPN CLI(adguardvpn-cli)를 GitHub에서 내려받아 플러그인 폴더에 설치합니다.",
        "install.button": "AdGuard VPN CLI 설치",
        "checking": "계정 상태 확인 중…",
        "login.title": "로그인",
        "login.required": "AdGuard 계정으로 로그인해야 합니다. 무료 계정도 사용할 수 있습니다.",
        "login.button": "로그인",
        "login.waiting": "로그인 링크를 받는 중…",
        "login.instructions": "휴대폰으로 QR 코드를 찍거나, 아래 버튼으로 Steam 브라우저에서 열어 로그인하세요. 완료되면 자동으로 넘어갑니다.",
        "login.open": "브라우저에서 열기",
        "status.connected": "연결됨 · {location}",
        "status.disconnected": "연결 안 됨",
        "vpn.toggle": "VPN 연결",
        "location": "위치",
        "favorite.add": "★ 즐겨찾기에 추가",
        "locations.refresh": "위치 목록 새로고침",
        "favorites": "즐겨찾기",
        "settings": "설정",
        "auto.label": "자동 연결",
        "auto.description": "Steam이 시작될 때 마지막 위치로 연결합니다",
        "account": "계정",
        "account.logged_in": "로그인됨",
        "logout": "로그아웃",
        "version.unknown": "알 수 없음",
        "version.installed": "설치된 버전 {version}",
        "version.new": "새 버전 {latest} 있음 (현재 {version})",
        "version.latest": "최신 버전입니다 ({version})",
        "signature.ok": "✓ AdGuard 공식 서명 확인됨",
        "signature.none": "서명 확인 기록 없음 (이전 버전으로 설치됨)",
        "update.to": "{version}로 업데이트",
        "update.latest": "최신 버전",
        "update.reinstall": "서명 확인하고 다시 설치",
        "update.reconnect": " (잠시 끊겼다가 다시 연결)",
        "update.check": "업데이트 확인",
    },
};

// Missing Korean strings fall back to English.
function t(key, vars) {
    const text = STRINGS[LANG][key] ?? STRINGS.en[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => (vars && name in vars ? vars[name] : match));
}

function errorText(error) {
    if (!error) return "";
    const message = t(`err.${error.code}`);
    return error.detail ? `${message}: ${error.detail}` : message;
}

function flag(iso) {
    if (!/^[A-Z]{2}$/.test(iso || "")) return "";
    return String.fromCodePoint(...[...iso].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

function titleCase(text) {
    return (text || "").toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

let regionNames = null;
try {
    regionNames = new Intl.DisplayNames([LANG], { type: "region" });
}
catch {
    /* country names stay in English */
}

function localCountry(loc) {
    try {
        const name = regionNames?.of(loc.iso);
        return name && name !== loc.iso ? name : "";
    }
    catch {
        return "";
    }
}

function locationLabel(loc) {
    const ping = loc.ping != null ? ` · ${loc.ping}ms` : "";
    const country = localCountry(loc) || titleCase(loc.country);
    return `${flag(loc.iso)} ${titleCase(loc.city)}, ${country}${ping}`;
}

// Matches city, English or localized country name, or ISO code, ignoring case and spaces.
function matchesQuery(loc, query) {
    const q = query.toLowerCase().replace(/\s+/g, "");
    if (!q) return true;
    return [loc.city, loc.country, loc.iso, localCountry(loc)]
        .some((text) => (text || "").toLowerCase().replace(/\s+/g, "").includes(q));
}

function openUrl(url) {
    DFL.Navigation.CloseSideMenus();
    DFL.Navigation.NavigateToExternalWeb(url);
}

function ShieldIcon({ on }) {
    return h(
        "svg",
        { width: "1em", height: "1em", viewBox: "0 0 24 24", fill: "currentColor" },
        h("path", {
            d: "M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3z",
            opacity: on ? 1 : 0.85,
        }),
        on ? h("path", { d: "m10.5 15.6-3.2-3.2 1.4-1.4 1.8 1.8 4.8-4.8 1.4 1.4z", fill: "#1a1f24" }) : null,
    );
}

// Rows of "1"/"0" from the backend's QR encoder, drawn as one SVG path.
// Dark on white with a 4-module quiet zone so phone cameras read it reliably.
function QrCode({ rows }) {
    const n = rows.length;
    const quiet = 4;
    let d = "";
    rows.forEach((row, y) => {
        let x = 0;
        while (x < n) {
            if (row[x] !== "1") {
                x++;
                continue;
            }
            const start = x;
            while (x < n && row[x] === "1") x++;
            d += `M${start + quiet} ${y + quiet}h${x - start}v1h${start - x}z`;
        }
    });
    const full = n + quiet * 2;
    return h(
        "div",
        { style: { display: "flex", justifyContent: "center", padding: "6px 0" } },
        h(
            "svg",
            {
                viewBox: `0 0 ${full} ${full}`,
                width: 180,
                height: 180,
                shapeRendering: "crispEdges",
                style: { background: "#fff", borderRadius: "6px" },
            },
            h("path", { d, fill: "#000" }),
        ),
    );
}

function SearchIcon() {
    return h(
        "svg",
        { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" },
        h("circle", { cx: 10.5, cy: 10.5, r: 6.5 }),
        h("path", { d: "m15.5 15.5 5 5" }),
    );
}

// Two lines so long names stay readable in the narrow panel:
// flag and city on top, country and ping underneath.
function LocationText({ loc, city, mark, markColor }) {
    const name = loc ? titleCase(loc.city) : titleCase(city);
    const detail = loc
        ? [localCountry(loc) || titleCase(loc.country), loc.ping != null ? `${loc.ping}ms` : ""].filter(Boolean).join(" · ")
        : "";
    return h(
        "div",
        { style: { display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", lineHeight: "18px", minWidth: 0 } },
        h(
            "div",
            { style: { fontSize: "15px", fontWeight: 600, whiteSpace: "normal", wordBreak: "break-word" } },
            mark ? h("span", { style: { color: markColor || ON_COLOR, marginRight: "6px" } }, mark) : null,
            loc ? `${flag(loc.iso)} ` : "",
            name,
        ),
        detail ? h("div", { style: { fontSize: "12px", color: "#b8bcbf", marginTop: "2px" } }, detail) : null,
    );
}

// Measured on the Deck: Steam's row separators sit 9px under the button.
const SECTION_DIVIDER = { height: "1px", background: "rgba(255, 255, 255, 0.1)", marginTop: "7px" };

const LIST_BUTTON ={ padding: "8px 12px", minWidth: 0, width: "100%" };

// The location picker: search box on top, list underneath. Steam's own dropdown
// menu cannot hold a text field, so this is a modal of its own.
function LocationPicker({ closeModal, locations, favorites, selected, connected, onPick }) {
    const [query, setQuery] = useState("");
    const searching = query.trim() !== "";
    const byCity = (city) => locations.find((loc) => loc.city === city);
    const matches = (city) => {
        const loc = byCity(city);
        return matchesQuery(loc || { city }, query);
    };
    const items = [];
    if (!searching) items.push({ city: FASTEST });
    favorites.filter(matches).forEach((city) => items.push({ city, loc: byCity(city), favorite: true }));
    locations
        .filter((loc) => !favorites.includes(loc.city) && matchesQuery(loc, query))
        .forEach((loc) => items.push({ city: loc.city, loc }));

    const pick = (city) => {
        closeModal();
        onPick(city);
    };

    return h(
        DFL.ModalRoot,
        { closeModal, onCancel: closeModal },
        h("div", { style: { fontSize: "20px", fontWeight: "bold", marginBottom: "8px" } }, t("picker.title")),
        // The hint sits over the empty box like a placeholder and lets clicks through.
        h(
            "div",
            { style: { position: "relative" } },
            h(DFL.TextField, {
                value: query,
                onChange: (e) => setQuery(e.target.value),
            }),
            searching
                ? null
                : h("div", {
                    style: {
                        position: "absolute",
                        left: "14px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "14px",
                        color: "#8b929a",
                    },
                }, h(SearchIcon, null), t("picker.hint")),
        ),
        h(
            DFL.Focusable,
            {
                "flow-children": "vertical",
                style: { display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px", maxHeight: "55vh", overflowY: "auto" },
            },
            items.length
                ? items.map((item, index) => h(DFL.DialogButton, {
                    key: item.city || "fastest",
                    style: LIST_BUTTON,
                    // Open with "fastest" focused instead of the search box.
                    autoFocus: index === 0 && item.city === FASTEST,
                    onClick: () => pick(item.city),
                }, item.city === FASTEST
                    ? h(LocationText, { city: t("fastest"), mark: item.city === selected ? "✓" : "" })
                    : h(LocationText, {
                        loc: item.loc,
                        city: item.city,
                        mark: [item.city === selected ? "✓" : "", item.favorite ? "★" : ""].filter(Boolean).join(" "),
                        markColor: item.city === selected ? ON_COLOR : "#f5c542",
                    })))
                : h(Note, null, t("picker.empty")),
        ),
    );
}

function confirmUninstall(onOK) {
    DFL.showModal(h(DFL.ConfirmModal, {
        strTitle: t("uninstall.title"),
        strDescription: t("uninstall.body"),
        strOKButtonText: t("uninstall.ok"),
        strCancelButtonText: t("cancel"),
        onOK,
        onCancel: () => {},
    }));
}

function Row(...children) {
    return h(DFL.PanelSectionRow, null, ...children);
}

// Steam spaces sections 24px apart; the separator line ends each section, so the
// next title sat 25px below it. 9px makes that 10px. Scoped to this panel only and
// keyed on structure rather than Steam's hashed class names.
const PANEL_CLASS = "adguard-vpn-panel";
const PANEL_CSS = `.${PANEL_CLASS} > div:not(style) { margin-bottom: 9px !important; }`;

function panel(sections) {
    return h("div", { className: PANEL_CLASS }, h("style", null, PANEL_CSS), ...sections);
}

function Note({ children, color }) {
    return h("div", { style: { ...NOTE, color: color || NOTE.color, padding: "4px 0", wordBreak: "break-word" } }, children);
}

// Kept between panel opens so the panel can draw immediately instead of
// waiting for the backend's first answer.
let lastState = null;
let lastLocations = [];

function App() {
    const [s, setS] = useState(lastState);
    const [locations, setLocationsRaw] = useState(lastLocations);
    const [pending, setPending] = useState(false);
    const alive = useRef(true);

    const setLocations = useCallback((list) => {
        lastLocations = list;
        setLocationsRaw(list);
    }, []);

    const apply = useCallback((next) => {
        if (!next) return;
        lastState = next;
        if (alive.current) setS(next);
    }, []);

    const run = useCallback(async (fn) => {
        setPending(true);
        try {
            apply(await fn());
        }
        catch (e) {
            console.error("[AdGuard VPN]", e);
        }
        finally {
            if (alive.current) setPending(false);
        }
    }, [apply]);

    useEffect(() => {
        alive.current = true;
        let timer;
        const tick = async () => {
            let next = null;
            try {
                next = await getState();
                apply(next);
            }
            catch (e) {
                console.error("[AdGuard VPN]", e);
            }
            // Until the first background check lands, look again sooner.
            const delay = next && next.installed && !next.ready ? FAST_POLL_MS : POLL_MS;
            if (alive.current) timer = setTimeout(tick, delay);
        };
        tick();
        return () => {
            alive.current = false;
            clearTimeout(timer);
        };
    }, [apply]);

    const loggedIn = s?.license?.logged_in;
    useEffect(() => {
        if (!loggedIn) return;
        listLocations(false).then((list) => list && list.length && setLocations(list)).catch(() => {});
    }, [loggedIn, setLocations]);

    if (!s) {
        return h(DFL.PanelSection, null, Row(h(Note, null, t("loading"))));
    }

    const busy = pending || !!s.busy;
    const sections = [];

    if (s.error) {
        sections.push(h(
            DFL.PanelSection,
            { key: "error" },
            Row(h(Note, { color: ERROR_COLOR }, errorText(s.error))),
            Row(h(DFL.ButtonItem, { layout: "below", onClick: () => run(clearError) }, t("close"))),
        ));
    }

    if (!s.installed) {
        sections.push(h(
            DFL.PanelSection,
            { key: "install", title: t("install.title") },
            Row(h(Note, null, t("install.body"))),
            Row(h(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: () => run(installCli) },
                s.busy ? t(`busy.${s.busy}`) : t("install.button"))),
        ));
        return panel(sections);
    }

    if (!loggedIn && !s.ready && !s.login?.active) {
        // First check since Decky started has not finished; don't flash the login screen.
        sections.push(h(DFL.PanelSection, { key: "checking" }, Row(h(Note, null, t("checking")))));
        return panel(sections);
    }

    if (!loggedIn) {
        const login = s.login || {};
        const rows = [];
        if (!login.active) {
            rows.push(Row(h(Note, null, t("login.required"))));
            rows.push(Row(h(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: () => run(startLogin) }, t("login.button"))));
        }
        else if (!login.url) {
            rows.push(Row(h(Note, null, t("login.waiting"))));
            if (login.output) rows.push(Row(h(Note, null, login.output.split("\n").slice(-3).join("\n"))));
            rows.push(Row(h(DFL.ButtonItem, { layout: "below", onClick: () => run(cancelLogin) }, t("cancel"))));
        }
        else {
            rows.push(Row(h(Note, null, t("login.instructions"))));
            if (login.qr && login.qr.length) rows.push(Row(h(QrCode, { rows: login.qr })));
            if (login.code) {
                rows.push(Row(h("div", {
                    style: { fontSize: "22px", fontWeight: "bold", letterSpacing: "2px", textAlign: "center", padding: "6px 0" },
                }, login.code)));
            }
            rows.push(Row(h(Note, null, login.url)));
            rows.push(Row(h(DFL.ButtonItem, { layout: "below", onClick: () => openUrl(login.url) }, t("login.open"))));
            rows.push(Row(h(DFL.ButtonItem, { layout: "below", onClick: () => run(cancelLogin) }, t("cancel"))));
        }
        sections.push(h(DFL.PanelSection, { key: "login", title: t("login.title") }, ...rows));
        if (!login.active) {
            sections.push(h(
                DFL.PanelSection,
                { key: "uninstall", title: "AdGuard VPN CLI" },
                Row(h(DFL.ButtonItem, {
                    layout: "below",
                    disabled: busy,
                    onClick: () => confirmUninstall(() => run(uninstallCli)),
                }, t("uninstall.button"))),
            ));
        }
        return panel(sections);
    }

    const connected = s.status.connected;
    const statusText = s.busy
        ? t(`busy.${s.busy}`) + "…"
        : connected
            ? t("status.connected", { location: titleCase(s.status.location) })
            : t("status.disconnected");

    const favorites = s.prefs.favorites || [];
    const isFavorite = (city) => favorites.includes(city);
    const findLocation = (city) => locations.find((loc) => loc.city === city);
    const favoriteLabel = (city) => {
        const loc = findLocation(city);
        return loc ? locationLabel(loc) : titleCase(city);
    };
    const selected = s.prefs.location || FASTEST;
    const selectedLabel = selected === FASTEST ? t("fastest") : favoriteLabel(selected);
    const connectedCity = connected ? (s.status.location || "").toLowerCase() : "";

    // Picking a location only remembers it, unless the VPN is on: then it switches over.
    const chooseLocation = (city) => {
        if (city === selected && (!connected || connectedCity === city.toLowerCase())) return;
        run(() => (connected ? connect(city) : setLocation(city)));
    };

    sections.push(h(
        DFL.PanelSection,
        { key: "vpn", title: "VPN" },
        Row(h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", padding: "4px 0", color: connected ? ON_COLOR : OFF_COLOR } },
            h(ShieldIcon, { on: connected }),
            h("span", null, statusText),
        )),
        Row(h(DFL.ToggleField, {
            label: t("vpn.toggle"),
            checked: connected,
            disabled: busy,
            onChange: (on) => run(() => (on ? connect(null) : disconnect())),
        })),
        // The label sits above so the button can use the panel's full width.
        Row(h(DFL.Field, {
            label: t("location"),
            childrenLayout: "below",
            childrenContainerWidth: "max",
        },
            h(DFL.DialogButton, {
                style: { ...LIST_BUTTON, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" },
                disabled: busy,
                onClick: () => DFL.showModal(h(LocationPicker, {
                    locations,
                    favorites,
                    selected,
                    connected,
                    onPick: chooseLocation,
                })),
            },
                h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 } }, selectedLabel),
                h("span", { style: { flexShrink: 0, opacity: 0.7 } }, "🔍 ▾")))),
        selected !== FASTEST && !isFavorite(selected)
            ? Row(h(DFL.ButtonItem, {
                layout: "below",
                onClick: () => run(() => toggleFavorite(selected)),
            }, t("favorite.add")))
            : null,
        Row(h(DFL.ButtonItem, {
            layout: "below",
            disabled: busy,
            onClick: () => listLocations(true).then((list) => list && list.length && setLocations(list)).catch(() => {}),
        }, t("locations.refresh"))),
    ));

    if (favorites.length) {
        sections.push(h(
            DFL.PanelSection,
            { key: "favorites", title: t("favorites") },
            ...favorites.map((city) => {
                const here = connectedCity && connectedCity === city.toLowerCase();
                const mark = here ? "●" : (!connected && city === selected ? "✓" : "");
                return Row(h(
                    DFL.Focusable,
                    {
                        key: city,
                        "flow-children": "horizontal",
                        style: { display: "flex", gap: "6px", padding: "2px 0", alignItems: "stretch" },
                    },
                    h(DFL.DialogButton, {
                        style: { ...LIST_BUTTON, flex: 1, width: "auto" },
                        disabled: busy || here,
                        onClick: () => chooseLocation(city),
                    }, h(LocationText, { loc: findLocation(city), city, mark })),
                    h(DFL.DialogButton, {
                        style: { width: "44px", minWidth: "44px", padding: 0 },
                        disabled: busy,
                        onClick: () => run(() => toggleFavorite(city)),
                    }, "✕"),
                ));
            }),
            // Steam's own rows end with a separator 9px under the button and the next
            // title follows 25px later; this matches it (the row above adds 2px padding).
            h("div", { key: "divider", style: SECTION_DIVIDER }),
        ));
    }

    sections.push(h(
        DFL.PanelSection,
        { key: "settings", title: t("settings") },
        Row(h(DFL.ToggleField, {
            label: t("auto.label"),
            description: t("auto.description"),
            checked: !!s.prefs.auto_connect,
            onChange: (on) => run(() => setAutoConnect(on)),
        })),
    ));

    const lic = s.license;
    sections.push(h(
        DFL.PanelSection,
        { key: "account", title: t("account") },
        Row(h(DFL.Field, { label: lic.email || t("account.logged_in"), description: [lic.tier, lic.valid_until && `~${lic.valid_until}`].filter(Boolean).join(" · ") || undefined })),
        Row(h(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: () => run(logout) }, t("logout"))),
    ));

    const upd = s.update || {};
    const updateNote = !upd.checked
        ? t("version.installed", { version: s.version || t("version.unknown") })
        : upd.available
            ? t("version.new", { latest: upd.latest, version: s.version || t("version.unknown") })
            : t("version.latest", { version: s.version || upd.latest });
    sections.push(h(
        DFL.PanelSection,
        { key: "update", title: "AdGuard VPN CLI" },
        Row(h(Note, { color: upd.available ? ON_COLOR : undefined }, updateNote)),
        Row(h(Note, null, s.verified
            ? t("signature.ok")
            : t("signature.none"))),
        upd.available || !s.verified
            ? Row(h(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: () => run(updateCli) },
                (upd.available ? t("update.to", { version: upd.latest || t("update.latest") }) : t("update.reinstall"))
                + (connected ? t("update.reconnect") : "")))
            : null,
        Row(h(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: () => run(checkUpdate) }, t("update.check"))),
        Row(h(DFL.ButtonItem, {
            layout: "below",
            disabled: busy,
            onClick: () => confirmUninstall(() => {
                setLocations([]);
                run(uninstallCli);
            }),
        }, t("uninstall.button"))),
    ));

    return panel(sections);
}

var index = DFL.definePlugin(() => ({
    name: manifest.name,
    titleView: h("div", { className: DFL.staticClasses.Title }, "AdGuard VPN"),
    content: h(App, null),
    icon: h(ShieldIcon, { on: true }),
    onDismount() {},
}));

export { index as default };
