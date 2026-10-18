import {
    LayoutDashboard,
    Plus,
    FileText,
    Shield,
    LogOut,
    Bell,
    ChevronDown,
    Menu,
    X
} from "lucide-react";

import { useState } from "react";

import "./DashboardLayout.css";

function DashboardLayout({
    role = "teacher",
    username = "Teacher",
    active = "home",
    onNavigate,
    onLogout,
    children
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [testsOpen, setTestsOpen] = useState(true);

    const isTeacher = role === "teacher";

    const navigate = (page) => {
        if (onNavigate) {
            onNavigate(page);
        }

        setSidebarOpen(false);
    };

    const teacherMenu = [
        {
            id: "home",
            label: "Dashboard",
            icon: LayoutDashboard
        },
        {
            id: "create",
            label: "Create test",
            icon: Plus
        }
    ];

    const studentMenu = [
        {
            id: "home",
            label: "Dashboard",
            icon: LayoutDashboard
        },
        {
            id: "tests",
            label: "Available tests",
            icon: FileText
        }
    ];

    const menuItems = isTeacher ? teacherMenu : studentMenu;

    return (
        <div className="dl-root">

            {/* MOBILE OVERLAY */}
            {sidebarOpen && (
                <div
                    className="dl-overlay"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* SIDEBAR */}
            <aside className={`dl-sidebar ${sidebarOpen ? "open" : ""}`}>

                {/* LOGO */}
                <div className="dl-brand">

                    <div className="dl-logo">
                        <Shield size={22} strokeWidth={2.2} />
                    </div>

                    <div className="dl-brand-text">
                        <h2>Code<span>Shield</span></h2>
                        <p>
                            {isTeacher
                                ? "Teacher workspace"
                                : "Student workspace"}
                        </p>
                    </div>

                    <button
                        className="dl-mobile-close"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X size={20} />
                    </button>

                </div>

                {/* NAVIGATION */}
                <nav className="dl-nav">

                    <div className="dl-nav-section">

                        <span className="dl-nav-label">
                            WORKSPACE
                        </span>

                        {menuItems.map((item) => {

                            const Icon = item.icon;

                            return (
                                <button
                                    key={item.id}
                                    className={`dl-nav-item ${
                                        active === item.id
                                            ? "active"
                                            : ""
                                    }`}
                                    onClick={() => navigate(item.id)}
                                >
                                    <Icon size={18} />

                                    <span>{item.label}</span>
                                </button>
                            );
                        })}

                    </div>

                    {/* TESTS SECTION */}
                    <div className="dl-nav-section">

                        <button
                            className="dl-nav-label-button"
                            onClick={() => setTestsOpen(!testsOpen)}
                        >
                            <span className="dl-nav-label">
                                {isTeacher ? "TESTS" : "ASSESSMENTS"}
                            </span>

                            <ChevronDown
                                size={15}
                                className={
                                    testsOpen
                                        ? "rotate"
                                        : ""
                                }
                            />
                        </button>

                        {testsOpen && (
                            <>

                                <button
                                    className={`dl-nav-item ${
                                        active === "tests"
                                            ? "active"
                                            : ""
                                    }`}
                                    onClick={() => navigate("tests")}
                                >
                                    <FileText size={18} />

                                    <span>
                                        {isTeacher
                                            ? "My tests"
                                            : "Available tests"}
                                    </span>
                                </button>

                            </>
                        )}

                    </div>

                </nav>

                {/* USER SECTION */}
                <div className="dl-sidebar-bottom">

                    <div className="dl-user-card">

                        <div className="dl-avatar">
                            {username
                                .charAt(0)
                                .toUpperCase()}
                        </div>

                        <div className="dl-user-info">

                            <strong>
                                {username}
                            </strong>

                            <span>
                                {isTeacher
                                    ? "Teacher"
                                    : "Student"}
                            </span>

                        </div>

                        <button
                            className="dl-logout-icon"
                            onClick={onLogout}
                            title="Logout"
                        >
                            <LogOut size={17} />
                        </button>

                    </div>

                </div>

            </aside>

            {/* MAIN AREA */}
            <div className="dl-main">

                {/* TOPBAR */}
                <header className="dl-topbar">

                    <div className="dl-topbar-left">

                        <button
                            className="dl-menu-button"
                            onClick={() =>
                                setSidebarOpen(true)
                            }
                        >
                            <Menu size={21} />
                        </button>

                        <div className="dl-page-title">

                            <span>
                                {active === "home"
                                    ? "Dashboard"
                                    : active === "create"
                                    ? "Create test"
                                    : active === "tests"
                                    ? isTeacher
                                        ? "My tests"
                                        : "Available tests"
                                    : "CodeShield"}
                            </span>

                        </div>

                    </div>

                    <div className="dl-topbar-right">

                        <button
                            className="dl-icon-button"
                            title="Notifications"
                        >
                            <Bell size={19} />

                            <span className="dl-notification-dot" />
                        </button>

                        <div className="dl-top-user">

                            <div className="dl-top-avatar">
                                {username
                                    .charAt(0)
                                    .toUpperCase()}
                            </div>

                            <div className="dl-top-user-info">

                                <strong>
                                    {username}
                                </strong>

                                <span>
                                    {isTeacher
                                        ? "Teacher"
                                        : "Student"}
                                </span>

                            </div>

                        </div>

                    </div>

                </header>

                {/* CONTENT */}
                <main className="dl-content">
                    {children}
                </main>

            </div>

        </div>
    );
}

export default DashboardLayout;