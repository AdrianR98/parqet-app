import styles from "./AppFooter.module.css";

export default function AppFooter() {
    return (
        <footer className={styles.footer}>
            <a
                className={styles.link}
                href="https://elbstream.com"
                target="_blank"
                rel="noreferrer"
            >
                Logos by Elbstream
            </a>
        </footer>
    );
}
