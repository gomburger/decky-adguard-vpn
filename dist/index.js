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
const setFavorites = callable("set_favorites");
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
        "picker.fav_add": "Add to Favorites",
        "picker.fav_remove": "Remove from Favorites",
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
        "reorder.start": "Reorder",
        "reorder.save": "Save Order",
        "reorder.hint": "Move with ↑↓, save with X or A, cancel with B",
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
        "signature.none": "AdGuard official signature not verified",
        "update.to": "Update to {version}",
        "update.notice": "AdGuard VPN CLI {latest} is available. You can update it at the bottom of this panel.",
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
        "picker.fav_add": "즐겨찾기 추가",
        "picker.fav_remove": "즐겨찾기 해제",
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
        "reorder.start": "순서 바꾸기",
        "reorder.save": "순서 저장",
        "reorder.hint": "↑↓로 옮기고 X나 A로 저장, B로 취소",
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
        "signature.none": "AdGuard 공식 서명 확인 안 됨",
        "update.to": "{version}로 업데이트",
        "update.notice": "AdGuard VPN CLI 새 버전 {latest}이 나왔습니다. 패널 맨 아래에서 업데이트할 수 있습니다.",
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
const GRAB_COLOR = "#1a9fff";
const GRABBED = { boxShadow: `0 0 0 2px ${GRAB_COLOR}` };
// Steam's EGamepadButton codes for the D-pad.
const GAMEPAD_UP = 9;
const GAMEPAD_DOWN = 10;

// Same chevron as the screen recorder plugin's fold button.
function Chevron({ up }) {
    return h("svg", { viewBox: "0 0 24 24", width: 18, height: 18, style: { display: "block" } },
        h("path", { d: up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6", fill: "none", stroke: "currentColor",
            strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" }));
}

const PICKER_LIST = "adguard-vpn-picker-list";
const PICKER_WIDTH = "480px";

// The location picker: search box on top, list underneath. Steam's own dropdown
// menu cannot hold a text field, so this is a modal of its own.
function LocationPicker({ closeModal, locations, favorites, selected, onPick, onToggleFavorite }) {
    const [query, setQuery] = useState("");
    // X adds or removes a favorite right here. Only the ★ changes; the list keeps the
    // order it opened with so the cursor stays put.
    const [favs, setFavs] = useState(favorites);
    const toggleFav = (city) => {
        setFavs((list) => (list.includes(city) ? list.filter((c) => c !== city) : [...list, city]));
        onToggleFavorite(city);
    };
    const searching = query.trim() !== "";
    const byCity = (city) => locations.find((loc) => loc.city === city);
    const matches = (city) => {
        const loc = byCity(city);
        return matchesQuery(loc || { city }, query);
    };
    const items = [];
    if (!searching) items.push({ city: FASTEST });
    favorites.filter(matches).forEach((city) => items.push({ city, loc: byCity(city) }));
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
        // Steam's dialog is 660px wide; the two-line rows read fine in less. Its spacing
        // above and below is trimmed too (24px around it, 11px outside and 24px inside it)
        // so the list gets that height.
        h("style", null, `
            *:has(> .DialogContent .${PICKER_LIST}) { padding-top: 8px !important; padding-bottom: 8px !important; }
            .DialogContent:has(.${PICKER_LIST}) {
                width: ${PICKER_WIDTH} !important; min-width: 0 !important; max-width: ${PICKER_WIDTH} !important;
                margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 20px !important; padding-bottom: 20px !important;
            }`),
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
                className: PICKER_LIST,
                // Short enough that the whole dialog fits on screen. Otherwise Steam also
                // scrolls the dialog itself while the cursor moves down the list.
                style: { display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px", maxHeight: "calc(100vh - 230px)", overflowY: "auto" },
            },
            items.length
                ? items.map((item, index) => h(DFL.DialogButton, {
                    key: item.city || "fastest",
                    style: LIST_BUTTON,
                    // Open with "fastest" focused instead of the search box.
                    autoFocus: index === 0 && item.city === FASTEST,
                    onClick: () => pick(item.city),
                    onSecondaryButton: item.city === FASTEST ? undefined : () => toggleFav(item.city),
                    onSecondaryActionDescription: item.city === FASTEST ? undefined
                        : t(favs.includes(item.city) ? "picker.fav_remove" : "picker.fav_add"),
                }, item.city === FASTEST
                    ? h(LocationText, { city: t("fastest"), mark: item.city === selected ? "✓" : "" })
                    : h(LocationText, {
                        loc: item.loc,
                        city: item.city,
                        mark: [item.city === selected ? "✓" : "", favs.includes(item.city) ? "★" : ""].filter(Boolean).join(" "),
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

function findScroller(element) {
    const view = element?.ownerDocument?.defaultView;
    if (!view) return null;
    for (let el = element.parentElement; el; el = el.parentElement) {
        if (/(auto|scroll)/.test(view.getComputedStyle(el).overflowY)) return el;
    }
    return null;
}

// Rows that bring the panel back to its top when they get focus. Steam would
// scroll only as far as the row, and when focus comes from far below it jumps
// there at once, cancelling a smooth scroll started from onFocus. With "force"
// Steam leaves the scrolling to fnScrollIntoViewHandler, so one smooth scroll
// to the top is all that runs (same as Screen Recorder 0.10.1).
function TopGroup(...children) {
    let element = null;
    return h("div", { ref: (node) => { element = node; } }, h(DFL.Focusable, {
        "flow-children": "column",
        scrollIntoViewWhenChildFocused: "force",
        fnScrollIntoViewHandler: () => {
            findScroller(element)?.scrollTo({ top: 0, behavior: "smooth" });
            return true;
        },
    }, ...children));
}

// The first solid background behind the panel, for the pinned status line.
function panelBackground(element) {
    const view = element?.ownerDocument?.defaultView;
    for (let el = element; el && view; el = el.parentElement) {
        const color = view.getComputedStyle(el).backgroundColor;
        if (color && color !== "transparent" && !/rgba\(.*,\s*0\)$/.test(color)) return color;
    }
    return "#0e141b";
}

// Height of the sticky title Steam keeps at the top of the Quick Access page,
// found as the sticky element (outside the panel) under the scroller's top edge.
function stickyHeaderHeight(scroller, panelEl) {
    const doc = scroller.ownerDocument;
    const view = doc.defaultView;
    const box = scroller.getBoundingClientRect();
    for (const el of doc.elementsFromPoint(box.left + box.width / 2, box.top + 2)) {
        if (panelEl.contains(el) || !scroller.contains(el)) continue;
        if (view.getComputedStyle(el).position === "sticky") return Math.max(0, Math.round(el.getBoundingClientRect().bottom - box.top));
    }
    return 0;
}

function StatusLine({ connected, text }) {
    return h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", padding: "4px 0", color: connected ? ON_COLOR : OFF_COLOR } },
        h(ShieldIcon, { on: connected }),
        h("span", null, text),
    );
}

function panel(sections) {
    return h("div", { className: PANEL_CLASS }, h("style", null, PANEL_CSS), ...sections);
}

function Note({ children, color }) {
    return h("div", { style: { ...NOTE, color: color || NOTE.color, padding: "4px 0",
        // Korean wraps between words, not inside them; long links still wrap anywhere.
        wordBreak: "keep-all", overflowWrap: "anywhere" } }, children);
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
        notifyListIcon(next);
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

    // Reordering favorites: X starts it on the focused row, ↑↓ move that row, X or A
    // saves and B cancels. `order` holds the unsaved order while it runs.
    const [order, setOrder] = useState(null);
    const [grabbed, setGrabbed] = useState(null);
    const navRefs = useRef({});
    const refocus = useRef(null);
    const navRef = (city) => navRefs.current[city] || (navRefs.current[city] = SP_REACT.createRef());
    useEffect(() => {
        // Moving a row moves its button in the DOM, which drops gamepad focus; put it back.
        const city = refocus.current;
        if (!city) return;
        refocus.current = null;
        try {
            navRefs.current[city]?.current?.TakeFocus(true);
        }
        catch (e) {
            console.error("[AdGuard VPN]", e);
        }
    });

    // While connected, the status line stays at the top once its row scrolls away.
    // A sticky row would only stick inside its own row, so a zero-height sticky
    // holder at the start of the panel shows a copy instead.
    const statusRef = useRef(null);
    const [pin, setPin] = useState(null); // { background, top, left, right } while shown, else null
    const pinWanted = !!(s && s.status && s.status.connected);
    useEffect(() => {
        const row = statusRef.current;
        const scroller = pinWanted && row ? findScroller(row) : null;
        if (!scroller) {
            setPin(null);
            return undefined;
        }
        const background = panelBackground(scroller);
        const panelEl = row.closest(`.${PANEL_CLASS}`) || scroller;
        const update = () => {
            const rowBox = row.getBoundingClientRect();
            const scrollerBox = scroller.getBoundingClientRect();
            // Sit under the page's own sticky title ("← AdGuard VPN"), whose shadow
            // would otherwise fade the rows just below the copy.
            const top = stickyHeaderHeight(scroller, panelEl);
            if (rowBox.bottom > scrollerBox.top + top + 1) {
                setPin(null);
                return;
            }
            // Indent the copy like the rows so the icon and the line sit where theirs do.
            const panelBox = panelEl.getBoundingClientRect();
            const left = Math.round(rowBox.left - panelBox.left);
            const right = Math.round(panelBox.right - rowBox.right);
            setPin((old) => (old && old.top === top && old.left === left && old.right === right ? old : { background, top, left, right }));
        };
        update();
        scroller.addEventListener("scroll", update, { passive: true });
        return () => scroller.removeEventListener("scroll", update);
    }, [pinWanted]);

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
    const selected = s.prefs.location || FASTEST;
    const connectedCity = connected ? (s.status.location || "").toLowerCase() : "";

    // Picking a location only remembers it, unless the VPN is on: then it switches over.
    const chooseLocation = (city) => {
        if (city === selected && (!connected || connectedCity === city.toLowerCase())) return;
        run(() => (connected ? connect(city) : setLocation(city)));
    };

    // A span, not a div: the panel's spacing rule applies to its divs.
    sections.unshift(h("span", { key: "pin", style: { display: "block", position: "sticky", top: pin ? pin.top : 0, height: 0, zIndex: 20 } },
        connected && pin ? h("div", {
            // The background spans the panel to hide what scrolls under it; the line
            // below matches Steam's row separators, with a little room under it.
            style: { position: "absolute", top: 0, left: 0, right: 0, background: pin.background, padding: `6px ${pin.right}px 6px ${pin.left}px` },
        }, h("div", { style: { paddingBottom: "4px", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" } },
            h(StatusLine, { connected, text: statusText }))) : null));

    sections.push(h(
        DFL.PanelSection,
        { key: "vpn", title: "VPN" },
        Row(h("div", { ref: statusRef }, h(StatusLine, { connected, text: statusText }))),
        // Focusing the switch brings the panel back to its top, status line included.
        Row(TopGroup(h(DFL.ToggleField, {
            label: t("vpn.toggle"),
            checked: connected,
            disabled: busy,
            onChange: (on) => run(() => (on ? connect(null) : disconnect())),
        }))),
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
                    onPick: chooseLocation,
                    onToggleFavorite: (city) => run(() => toggleFavorite(city)),
                })),
            },
                // Same two lines as the favorites, so long country names stay readable.
                selected === FASTEST
                    ? h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 } }, t("fastest"))
                    : h(LocationText, { loc: findLocation(selected), city: selected }),
                h("span", { style: { flexShrink: 0, opacity: 0.7, display: "flex", alignItems: "center", gap: "4px" } },
                    "🔍", h(Chevron, null))))),
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

    const reordering = order !== null;
    const startReorder = (city) => {
        refocus.current = city;
        setOrder([...favorites]);
        setGrabbed(city);
    };
    const stopReorder = () => {
        refocus.current = grabbed;
        setOrder(null);
        setGrabbed(null);
    };
    const saveOrder = () => {
        const next = order;
        stopReorder();
        // Show the new order right away instead of flashing the old one until the save returns.
        apply({ ...s, prefs: { ...s.prefs, favorites: next } });
        run(() => setFavorites(next));
    };
    const moveGrabbed = (step) => {
        const i = order.indexOf(grabbed);
        const j = i + step;
        if (i < 0 || j < 0 || j >= order.length) return;
        const next = [...order];
        [next[i], next[j]] = [next[j], next[i]];
        refocus.current = grabbed;
        setOrder(next);
    };

    if (favorites.length) {
        const shown = reordering ? order.filter((city) => favorites.includes(city)) : favorites;
        sections.push(h(
            DFL.PanelSection,
            { key: "favorites", title: t("favorites") },
            reordering ? Row(h(Note, null, t("reorder.hint"))) : null,
            ...shown.map((city) => {
                const here = connectedCity && connectedCity === city.toLowerCase();
                const isGrabbed = reordering && city === grabbed;
                const mark = isGrabbed ? "↕" : here ? "●" : (!connected && city === selected ? "✓" : "");
                return Row(h(
                    DFL.Focusable,
                    {
                        key: city,
                        "flow-children": "horizontal",
                        style: { display: "flex", gap: "6px", padding: "2px 0", alignItems: "stretch" },
                        onSecondaryButton: () => (reordering ? saveOrder() : startReorder(city)),
                        onSecondaryActionDescription: reordering ? t("reorder.save") : t("reorder.start"),
                        onCancelButton: reordering ? stopReorder : undefined,
                        onCancelActionDescription: reordering ? t("cancel") : undefined,
                        // While reordering the cursor stays on the grabbed row; ↑↓ move the row instead.
                        onGamepadDirection: reordering
                            ? (e) => {
                                const button = e?.detail?.button;
                                if (button === GAMEPAD_UP) moveGrabbed(-1);
                                else if (button === GAMEPAD_DOWN) moveGrabbed(1);
                                return true;
                            }
                            : undefined,
                    },
                    h(DFL.DialogButton, {
                        navRef: navRef(city),
                        style: { ...LIST_BUTTON, flex: 1, width: "auto", ...(isGrabbed ? GRABBED : null) },
                        disabled: reordering ? false : busy || here,
                        onOKActionDescription: reordering ? t("reorder.save") : undefined,
                        onClick: () => (reordering ? saveOrder() : chooseLocation(city)),
                    }, h(LocationText, { loc: findLocation(city), city, mark, markColor: isGrabbed ? GRAB_COLOR : undefined })),
                    h(DFL.DialogButton, {
                        style: { width: "44px", minWidth: "44px", padding: 0, opacity: reordering ? 0.35 : undefined },
                        disabled: busy,
                        onClick: () => (reordering ? saveOrder() : run(() => toggleFavorite(city))),
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
    // The update button lives at the bottom; say so at the top where it is seen.
    if (upd.available && s.busy !== "updating") {
        sections.unshift(h(
            DFL.PanelSection,
            { key: "update-notice" },
            Row(h(Note, { color: ON_COLOR }, t("update.notice", { latest: upd.latest || t("update.latest") }))),
        ));
    }
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

// The icon in Decky's plugin list turns green while the VPN is connected. Each
// time the list appears it asks for the state (catching auto-connect at startup
// or a drop while the panel was closed), and the panel tells it right away when
// the state changes. get_state answers with what the backend last knew and then
// checks again in the background, so the icon asks once more after that check.
const LIST_ICON_RECHECK_MS = 2500;
const listIconListeners = new Set();

function isConnected(state) {
    return !!(state && state.installed && state.status && state.status.connected);
}

function notifyListIcon(state) {
    const connected = isConnected(state);
    listIconListeners.forEach((listener) => listener(connected));
}

function PluginListIcon() {
    const [connected, setConnected] = useState(isConnected(lastState));
    useEffect(() => {
        listIconListeners.add(setConnected);
        const check = () => getState()
            .then((next) => {
                if (!next) return;
                lastState = next;
                notifyListIcon(next);
            })
            .catch((e) => console.error("[AdGuard VPN]", e));
        check();
        const recheck = setTimeout(check, LIST_ICON_RECHECK_MS);
        return () => {
            clearTimeout(recheck);
            listIconListeners.delete(setConnected);
        };
    }, []);
    return h("span", { style: { display: "flex", color: connected ? ON_COLOR : undefined } }, h(ShieldIcon, { on: true }));
}

var index = DFL.definePlugin(() => ({
    name: manifest.name,
    content: h(App, null),
    icon: h(PluginListIcon, null),
    onDismount() {},
}));

export { index as default };
