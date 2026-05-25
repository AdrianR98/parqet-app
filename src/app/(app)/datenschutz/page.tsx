import Link from "next/link";

export default function DatenschutzPage() {
    return (
        <main className="app-content">
            <section className="ui-surface" style={{ padding: "20px" }}>
                <h1>Datenschutz</h1>
                <p>Inhalt wird ergänzt.</p>
                <p>Finale rechtliche Inhalte müssen noch bereitgestellt und geprüft werden.</p>
                <p>
                    <Link href="/dashboard">Zurück zum Dashboard</Link>
                </p>
            </section>
        </main>
    );
}
