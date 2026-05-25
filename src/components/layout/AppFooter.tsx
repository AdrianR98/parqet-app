import Link from "next/link";
import styles from "./AppFooter.module.css";

export default function AppFooter() {
    return (
        <footer className={styles.footer}>
            <div className={styles.inner}>
                <p className={styles.label}>Parqet Integration</p>
                <nav className={styles.nav} aria-label="Rechtliches">
                    <Link className={styles.link} href="/impressum">
                        Impressum
                    </Link>
                    <span className={styles.separator} aria-hidden="true">
                        ·
                    </span>
                    <Link className={styles.link} href="/datenschutz">
                        Datenschutz
                    </Link>
                </nav>
                <a
                    className={`${styles.link} ${styles.attribution}`}
                    href="https://elbstream.com"
                    target="_blank"
                    rel="noreferrer"
                >
                    Logos by Elbstream
                </a>
            </div>
        </footer>
    );
}
