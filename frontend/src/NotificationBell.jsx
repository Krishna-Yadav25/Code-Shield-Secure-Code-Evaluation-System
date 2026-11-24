import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, Check, Megaphone, Send, Trash2, X } from "lucide-react";
import "./NotificationBell.css";

const API_BASE = "http://localhost:5000";
const POLL_MS = 30000;
const MAX_TITLE = 150;
const MAX_MESSAGE = 2000;


async function apiCall(path, options = {}) {
    const token = localStorage.getItem("codeshield_token");

    let response;

    try {
        response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });
    } catch {
        throw new Error("Could not connect to backend.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
}

function timeAgo(value) {
    if (!value) return "";

    const then = new Date(value).getTime();

    if (Number.isNaN(then)) return "";

    const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

    if (seconds < 60) return "just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

    return new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}


/* Ek notification ka card (panel aur dashboard card dono mein) */
function NotificationItem({ item, isTeacher, onDelete, confirming, onAskDelete, onCancelDelete }) {
    const unread = !isTeacher && !item.is_read;

    return (
        <article className={`nb-item ${unread ? "nb-unread" : ""}`}>
            <div className="nb-item-top">
                {unread && <span className="nb-dot" aria-hidden="true" />}

                <strong>{item.title}</strong>

                {unread && <span className="nb-new">New</span>}

                {isTeacher && !confirming && (
                    <button
                        type="button"
                        className="nb-delete"
                        title="Delete"
                        aria-label={`Delete ${item.title}`}
                        onClick={() => onAskDelete(item.notification_id)}
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>

            <p>{item.message}</p>

            {isTeacher && confirming ? (
                <div className="nb-confirm">
                    <span>Delete this for all students?</span>

                    <button
                        type="button"
                        className="nb-confirm-no"
                        onClick={onCancelDelete}
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        className="nb-confirm-yes"
                        onClick={() => onDelete(item.notification_id)}
                    >
                        Delete
                    </button>
                </div>
            ) : (
                <span className="nb-time">
                    {!isTeacher && item.teacher ? `${item.teacher} · ` : ""}
                    {timeAgo(item.created_at)}
                </span>
            )}
        </article>
    );
}


function NotificationBell({ role = "student" }) {
    const isTeacher = role === "teacher";

    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [info, setInfo] = useState("");
    const [confirmId, setConfirmId] = useState(null);

    const wrapperRef = useRef(null);

    const basePath = isTeacher
        ? "/api/teacher/notifications"
        : "/api/student/notifications";


    const load = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);

        try {
            const data = await apiCall(basePath);

            setItems(data.notifications || []);

            if (!isTeacher) {
                setUnread(data.unread_count || 0);
            }

            setError("");
        } catch (e) {
            if (showLoader) setError(e.message);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [basePath, isTeacher]);

    useEffect(() => {
        load();

        const timer = setInterval(() => load(), POLL_MS);

        return () => clearInterval(timer);
    }, [load]);

    /* ---------- OUTSIDE CLICK / ESC ---------- */

    useEffect(() => {
        if (!open) return undefined;

        const close = () => {
            setOpen(false);
            setConfirmId(null);

            // Panel band hone ke baad "New" tag hata do
            if (!isTeacher) {
                setItems((current) =>
                    current.map((item) => ({ ...item, is_read: true }))
                );
            }
        };

        const onClick = (event) => {
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(event.target)
            ) {
                close();
            }
        };

        const onKey = (event) => {
            if (event.key === "Escape") close();
        };

        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);

        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, isTeacher]);


    const openPanel = async () => {
        setOpen(true);
        setInfo("");
        setError("");

        await load(true);

        if (!isTeacher) {
            try {
                await apiCall("/api/student/notifications/read", {
                    method: "POST"
                });
                setUnread(0);
            } catch {
                /* read-mark fail ho to bhi panel chalta rahe */
            }
        }
    };

    const closePanel = () => {
        setOpen(false);
        setConfirmId(null);

        if (!isTeacher) {
            setItems((current) =>
                current.map((item) => ({ ...item, is_read: true }))
            );
        }
    };


    const sendNotification = async (event) => {
        if (event) event.preventDefault();

        if (!title.trim() || !message.trim()) {
            setInfo("");
            setError("Write both a title and a message.");
            return;
        }

        setSending(true);
        setError("");
        setInfo("");

        try {
            const data = await apiCall(basePath, {
                method: "POST",
                body: JSON.stringify({
                    title: title.trim(),
                    message: message.trim()
                })
            });

            setItems((current) => [data.notification, ...current]);
            setTitle("");
            setMessage("");
            setInfo("Sent to all students.");
        } catch (e) {
            setError(e.message);
        } finally {
            setSending(false);
        }
    };

    const removeNotification = async (id) => {
        try {
            await apiCall(`${basePath}/${id}`, { method: "DELETE" });

            setItems((current) =>
                current.filter((item) => item.notification_id !== id)
            );
            setConfirmId(null);
        } catch (e) {
            setConfirmId(null);
            setError(e.message);
        }
    };

    const onMessageKey = (event) => {
        // Ctrl/Cmd + Enter se send
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            sendNotification();
        }
    };

    const canSend = title.trim() && message.trim() && !sending;


    return (
        <div className="nb-wrapper" ref={wrapperRef}>

            <button
                type="button"
                className="dl-icon-button"
                title="Notifications"
                aria-label="Notifications"
                aria-expanded={open}
                onClick={() => (open ? closePanel() : openPanel())}
            >
                <Bell size={19} />

                {!isTeacher && unread > 0 && (
                    <span className="nb-count">
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="nb-panel" role="dialog" aria-label="Notifications">

                    <div className="nb-panel-header">
                        <span className="nb-head-icon" aria-hidden="true">
                            {isTeacher ? <Megaphone size={16} /> : <Bell size={16} />}
                        </span>

                        <div className="nb-head-text">
                            <strong>
                                {isTeacher ? "Notify students" : "Notifications"}
                            </strong>
                            <span>
                                {isTeacher
                                    ? "Visible to every student"
                                    : "Updates from your teachers"}
                            </span>
                        </div>

                        <button
                            type="button"
                            className="nb-close"
                            onClick={closePanel}
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {isTeacher && (
                        <form className="nb-form" onSubmit={sendNotification}>
                            <div className="nb-field">
                                <input
                                    type="text"
                                    placeholder="Title (e.g. Test starts at 10 AM)"
                                    aria-label="Title"
                                    value={title}
                                    maxLength={MAX_TITLE}
                                    onChange={(e) => setTitle(e.target.value)}
                                    disabled={sending}
                                />
                            </div>

                            <div className="nb-field">
                                <textarea
                                    placeholder="Write your message…"
                                    aria-label="Message"
                                    value={message}
                                    maxLength={MAX_MESSAGE}
                                    onChange={(e) => setMessage(e.target.value)}
                                    onKeyDown={onMessageKey}
                                    disabled={sending}
                                />
                                <span className="nb-counter">
                                    {message.length}/{MAX_MESSAGE}
                                </span>
                            </div>

                            <button
                                type="submit"
                                className="nb-send"
                                disabled={!canSend}
                            >
                                <Send size={14} />
                                {sending ? "Sending…" : "Send to all students"}
                            </button>
                        </form>
                    )}

                    {error && (
                        <div className="nb-error" role="alert">{error}</div>
                    )}

                    {info && (
                        <div className="nb-info" role="status">
                            <Check size={13} />
                            {info}
                        </div>
                    )}

                    {isTeacher && items.length > 0 && (
                        <div className="nb-subhead">
                            Sent notifications
                            <span>{items.length}</span>
                        </div>
                    )}

                    <div className="nb-list">
                        {loading ? (
                            <p className="nb-empty">Loading…</p>
                        ) : items.length === 0 ? (
                            <div className="nb-empty">
                                <BellOff size={22} />
                                <p>
                                    {isTeacher
                                        ? "Nothing sent yet."
                                        : "You're all caught up."}
                                </p>
                            </div>
                        ) : (
                            items.map((item) => (
                                <NotificationItem
                                    key={item.notification_id}
                                    item={item}
                                    isTeacher={isTeacher}
                                    confirming={confirmId === item.notification_id}
                                    onAskDelete={setConfirmId}
                                    onCancelDelete={() => setConfirmId(null)}
                                    onDelete={removeNotification}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


export function NotificationsCard() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        const load = async () => {
            try {
                const data = await apiCall("/api/student/notifications");

                if (active) {
                    setItems((data.notifications || []).slice(0, 5));
                    setError("");
                }
            } catch (e) {
                if (active) setError(e.message);
            } finally {
                if (active) setLoading(false);
            }
        };

        load();

        const timer = setInterval(load, POLL_MS);

        return () => {
            active = false;
            clearInterval(timer);
        };
    }, []);

    return (
        <section>
            <div className="sec-head">
                <h2>Notifications</h2>
            </div>

            <div className="nb-card">
                {loading ? (
                    <p className="nb-empty">Loading…</p>
                ) : error ? (
                    <p className="nb-empty">{error}</p>
                ) : items.length === 0 ? (
                    <div className="nb-empty">
                        <BellOff size={22} />
                        <p>No notifications yet.</p>
                    </div>
                ) : (
                    items.map((item) => (
                        <NotificationItem
                            key={item.notification_id}
                            item={item}
                            isTeacher={false}
                        />
                    ))
                )}
            </div>
        </section>
    );
}

export default NotificationBell;