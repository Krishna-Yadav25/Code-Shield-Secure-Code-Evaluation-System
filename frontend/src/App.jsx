import { useEffect, useState } from "react";

import Login from "./Login.jsx";
import Register from "./Register.jsx";

import StudentDashboard from "./StudentDashboard.jsx";
import TeacherDashboard from "./TeacherDashboard.jsx";


function App() {

    const [role, setRole] =
        useState(
            localStorage.getItem(
                "codeshield_role"
            )
        );

    const [token, setToken] =
        useState(
            localStorage.getItem(
                "codeshield_token"
            )
        );

    const [authView, setAuthView] =
        useState("login");


    /* ==========================================================
       OAUTH TOKEN
       ========================================================== */

    useEffect(() => {

        const hash =
            window.location.hash;

        if (!hash) {
            return;
        }

        const params =
            new URLSearchParams(
                hash.substring(1)
            );

        const oauthToken =
            params.get("token");

        const oauthRole =
            params.get("role");


        if (
            oauthToken &&
            oauthRole
        ) {

            localStorage.setItem(
                "codeshield_token",
                oauthToken
            );

            localStorage.setItem(
                "codeshield_role",
                oauthRole
            );

            setToken(oauthToken);
            setRole(oauthRole);

            window.history.replaceState(
                null,
                "",
                window.location.pathname
            );

        }

    }, []);


    /* ==========================================================
       LOGIN
       ========================================================== */

    const handleLoginSuccess = (
        newToken,
        newRole
    ) => {

        localStorage.setItem(
            "codeshield_token",
            newToken
        );

        localStorage.setItem(
            "codeshield_role",
            newRole
        );

        setToken(newToken);
        setRole(newRole);

    };


    /* ==========================================================
       LOGOUT
       ========================================================== */

    const handleLogout = () => {

        localStorage.removeItem(
            "codeshield_token"
        );

        localStorage.removeItem(
            "codeshield_role"
        );

        setToken(null);
        setRole(null);

        setAuthView("login");

    };


    /* ==========================================================
       AUTH
       ========================================================== */

    if (!token || !role) {

        if (authView === "register") {

            return (
                <Register
                    switchToLogin={() =>
                        setAuthView(
                            "login"
                        )
                    }
                />
            );

        }

        return (
            <Login
                onLoginSuccess={
                    handleLoginSuccess
                }
                switchToRegister={() =>
                    setAuthView(
                        "register"
                    )
                }
            />
        );

    }


    /* ==========================================================
       TEACHER
       ========================================================== */

    if (role === "teacher") {

        return (
            <TeacherDashboard
                onLogout={
                    handleLogout
                }
            />
        );

    }


    /* ==========================================================
       STUDENT
       ========================================================== */

    if (role === "student") {

        return (
            <StudentDashboard
                onLogout={
                    handleLogout
                }
            />
        );

    }


    handleLogout();

    return null;
}


export default App;