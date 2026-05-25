import Link from "next/link";

export default function ImpressumPage() {
    return (
        <main className="app-content">
            <section className="ui-surface" style={{ padding: "20px" }}>
                <h1>Impressum</h1>
                <p>Inhalt wird ergänzt.</p>
                <p>Finale rechtliche Inhalte müssen noch bereitgestellt und geprüft werden.</p>
                <p>
                    <Link href="/dashboard">Zurück zum Dashboard</Link>
                </p>
            </section>
        </main>
    );
}
