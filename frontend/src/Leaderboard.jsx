import { useCallback, useEffect, useState } from "react";
import "./Leaderboard.css";

const API_BASE = "http://localhost:5000";

async function apiCall(path) {
    const token = localStorage.getItem("codeshield_token");

    let response;

    try {
        response = await fetch(`${API_BASE}${path}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
    } catch {
        throw new Error("Unable to connect with backend.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
}

function formatTime(ms) {
    const value = Number(ms) || 0;

    if (value < 1000) return `${value} ms`;

    const seconds = value / 1000;

    return seconds < 60
        ? `${seconds.toFixed(1)} s`
        : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };

function Leaderboard() {
    const [contests, setContests] = useState([]);
    const [selected, setSelected] = useState("");
    const [board, setBoard] = useState(null);
    const [loadingList, setLoadingList] = useState(true);
    const [loadingBoard, setLoadingBoard] = useState(false);
    const [error, setError] = useState("");

 

    useEffect(() => {
        let active = true;

        (async () => {
            try {
                const data = await apiCall("/api/leaderboard/contests");

                if (!active) return;

                const list = data.contests || [];

                setContests(list);

                if (list.length > 0) {
                    setSelected(String(list[0].contest_id));
                }
            } catch (e) {
                if (active) setError(e.message);
            } finally {
                if (active) setLoadingList(false);
            }
        })();

        return () => {
            active = false;
        };
    }, []);


    const loadBoard = useCallback(async (contestId) => {
        if (!contestId) return;

        setLoadingBoard(true);
        setError("");

        try {
            const data = await apiCall(`/api/leaderboard/${contestId}`);
            setBoard(data);
        } catch (e) {
            setBoard(null);
            setError(e.message);
        } finally {
            setLoadingBoard(false);
        }
    }, []);

    useEffect(() => {
        loadBoard(selected);
    }, [selected, loadBoard]);

   

    if (loadingList) {
        return <div className="empty-card">Loading leaderboard...</div>;
    }

    if (contests.length === 0) {
        return (
            <div className="empty-card">
                {error || "Leaderboard is visible only when you attempt any test."}
            </div>
        );
    }

    const entries = board?.entries || [];

    return (
        <div className="lb-wrapper">

            <div className="lb-toolbar">
                <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                >
                    {contests.map((c) => (
                        <option key={c.contest_id} value={c.contest_id}>
                            {c.title}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    className="lb-refresh"
                    onClick={() => loadBoard(selected)}
                    disabled={loadingBoard}
                >
                    {loadingBoard ? "Loading..." : "Refresh"}
                </button>
            </div>

            {error && <div className="lb-error">{error}</div>}

            {board && board.my_rank != null && (
                <div className="lb-me">
                    <span>Your rank</span>
                    <strong>#{board.my_rank}</strong>
                    <small>of {entries.length}</small>
                </div>
            )}

            {board && entries.length === 0 && !loadingBoard && (
                <div className="empty-card">No submission in this test yet.</div>
            )}

            {entries.length > 0 && (
                <div className="lb-table-wrapper">
                    <table className="lb-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Student</th>
                                <th>Marks</th>
                                <th>Solved</th>
                                <th>Time</th>
                            </tr>
                        </thead>

                        <tbody>
                            {entries.map((e) => (
                                <tr
                                    key={e.user_id}
                                    className={e.is_me ? "lb-row-me" : ""}
                                >
                                    <td className="lb-rank">
                                        {MEDALS[e.rank] || `#${e.rank}`}
                                    </td>

                                    <td>
                                        {e.username}
                                        {e.is_me && <span className="lb-you">You</span>}
                                    </td>

                                    <td>
                                        <strong>{e.total_marks}</strong>
                                        <span className="lb-muted"> / {e.max_marks}</span>
                                    </td>

                                    <td>
                                        {e.problems_solved} / {board.total_problems}
                                    </td>

                                    <td>{formatTime(e.total_time_ms)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            
        </div>
    );
}

export default Leaderboard;