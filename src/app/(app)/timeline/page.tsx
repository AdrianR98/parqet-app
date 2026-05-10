export default function TimelinePage() {
    return (
        <main className="app-content">
            <section className="ui-surface page-placeholder">
                <p className="page-placeholder__eyebrow">AssetTrace · Timeline</p>
                <h1>Timeline</h1>
                <p>
                    Die globale Asset-Timeline ist als Hauptbereich vorbereitet. Dieser Batch baut noch keine chartbasierte Timeline und löst beim Öffnen keine Parqet-Anfrage aus.
                </p>
                <div className="ui-banner ui-banner-info">
                    Nächster Schritt: Datenumfang und Scope explizit definieren, bevor Timeline-Daten geladen oder visualisiert werden.
                </div>
            </section>
        </main>
    );
}
