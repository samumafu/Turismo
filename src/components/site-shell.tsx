import Link from "next/link";

export function BrandMark() {
  return (
    <svg viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <path
        d="m5 32 12-21 7 12 5-8 11 17H5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m11 32 7-11 7 11M17 11v-6m-6 9-4-3m16 3 4-3M15 37h19"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function SiteHeader() {
  return (
    <>
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <header className="site-header">
        <div className="shell header-inner">
          <Link
            href="/planificar"
            className="brand"
            aria-label="Turismo Nariño, planificador"
          >
            <BrandMark />
            <span>
              turismo<strong>Nariño</strong>
            </span>
          </Link>
        </div>
      </header>
    </>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <Link href="/planificar" className="brand">
          <BrandMark />
          <span>
            turismo<strong>Nariño</strong>
          </span>
        </Link>
        <p>Turismo Inteligente Pasto</p>
        <div>
          <Link href="/fuentes">Información, fuentes y privacidad</Link>
          <span>Prototipo universitario · Nariño, Colombia</span>
        </div>
      </div>
    </footer>
  );
}
