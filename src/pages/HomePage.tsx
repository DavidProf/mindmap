import AppHeader from "../components/layout/AppHeader";
import "./HomePage.css";

export default function HomePage() {
    return (
        <>
            <AppHeader variant="home" />
            <main className="home-wrap">
                <div className="home-title-row">
                    <div>
                        <h1>Your projects</h1>
                        <p>Local to this browser · sorted newest first</p>
                    </div>
                </div>
                <p style={{ color: "var(--muted)", fontSize: "13px" }}>
                    Home placeholder — project list lands in feature 2.
                </p>
            </main>
        </>
    );
}
