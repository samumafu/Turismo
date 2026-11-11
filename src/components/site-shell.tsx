import Link from "next/link";
import type { ReactNode } from "react";
import { ExploreLink } from "./discovery/explore-link";

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
export function SiteHeader({
  children,
  planner = false,
}: {
  children?: ReactNode;
  planner?: boolean;
}) {
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
          {planner ? (
            <div className="header-title">
              <h1>Planifica tu viaje por Nariño</h1>
              <p>Tus lugares, tu recorrido, a tu ritmo.</p>
            </div>
          ) : null}
          {children ? (
            <div className="header-account">{children}</div>
          ) : (
            <Link className="header-back" href="/planificar">
              Ir al planificador
            </Link>
          )}
        </div>
      </header>
    </>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div className="footer-about">
          <Link href="/planificar" className="brand">
            <BrandMark />
            <span>
              turismo<strong>Nariño</strong>
            </span>
          </Link>
          <p>
            Descubre lugares, conecta tus visitas y recorre Nariño a tu ritmo.
          </p>
          <span>Pasto, Nariño · Colombia</span>
        </div>
        <nav aria-label="Explorar Nariño">
          <h2>Explora</h2>
          <ExploreLink zone="pasto" category="cafeterias">
            Cafeterías en Pasto
          </ExploreLink>
          <ExploreLink zone="pasto" category="museos">
            Museos y cultura
          </ExploreLink>
          <ExploreLink zone="cocha" category="naturaleza">
            La Cocha y naturaleza
          </ExploreLink>
        </nav>
        <nav aria-label="Ayuda e información">
          <h2>Tu viaje</h2>
          <Link href="/planificar#chat-viaje">Conversar y descubrir</Link>
          <Link href="/planificar#mi-itinerario">Mi itinerario</Link>
          <Link href="/fuentes">Información y privacidad</Link>
        </nav>
        <div className="footer-contact">
          <h2>Hecho para descubrir</h2>
          <p>
            Un proyecto universitario que conecta la tecnología con los lugares
            de nuestra región.
          </p>
          <span>Contacto de ejemplo</span>
          <a href="mailto:hola@turismonarino.example">
            hola@turismonarino.example
          </a>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© 2026 Turismo Nariño</span>
        <span>Lugares y rutas con Google Maps</span>
        <Link href="/fuentes">Fuentes y condiciones de uso</Link>
      </div>
    </footer>
  );
}
