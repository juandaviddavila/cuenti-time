import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Braces,
  Check,
  ChevronRight,
  Clock3,
  FileCheck2,
  LockKeyhole,
  MapPin,
  ScanFace,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "@/app/page.module.css";
import { formatCop, formatUsd } from "@/lib/billing";

interface FeatureRow {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: FeatureRow[] = [
  {
    icon: ScanFace,
    title: "Registro facial",
    description:
      "Cada marcación se valida con un descriptor numérico del rostro y búsqueda de similitud, sin conservar la fotografía original.",
  },
  {
    icon: MapPin,
    title: "Geocerca por sucursal",
    description:
      "Cuando la marcación llega desde un dispositivo móvil, se verifica la distancia a la sucursal configurada. En equipos de escritorio no se exige GPS.",
  },
  {
    icon: BarChart3,
    title: "Reportes listos para revisar",
    description:
      "Historial de asistencia y reportes con exportación a Excel y PDF, para revisar el día sin reconstruirlo en una hoja de cálculo.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-sucursal con aislamiento de datos",
    description:
      "Cada empresa gestiona sus propias sucursales, equipos y registros. La información de un cliente nunca se mezcla con la de otro.",
  },
];

const steps = [
  ["Configura", "Crea la empresa, las sucursales y sus reglas de ubicación."],
  ["Registra", "Agrega a tu equipo y habilita sus registros faciales con consentimiento."],
  ["Marca", "Cada persona registra su entrada o salida desde el flujo asignado."],
  ["Revisa", "Consulta asistencia y reportes desde un solo lugar."],
] as const;

const integrations: FeatureRow[] = [
  {
    icon: Braces,
    title: "API pública",
    description: "Consulta y escritura mediante tokens aislados por empresa.",
  },
  {
    icon: Webhook,
    title: "Webhooks",
    description: "Eventos de asistencia y equipo firmados para tus automatizaciones.",
  },
  {
    icon: Clock3,
    title: "MCP para RR. HH.",
    description: "Herramientas de consulta para clientes compatibles con MCP.",
  },
];

interface PrivacyLink {
  icon: LucideIcon;
  tag: string;
  title: string;
  description: string;
  href: string;
}

const privacyLinks: PrivacyLink[] = [
  {
    icon: LockKeyhole,
    tag: "Datos sensibles",
    title: "Biometría con consentimiento y propósito.",
    description:
      "cuenti time trabaja con el descriptor numérico y permite documentar el consentimiento bajo la Ley 1581.",
    href: "/recursos/biometria-laboral-ley-1581",
  },
  {
    icon: FileCheck2,
    tag: "Jornada y horas extra",
    title: "Registros preparados para explicar la jornada.",
    description:
      "La Ley 2466 de 2025 exige detallar el trabajo suplementario. El software organiza evidencia; la empresa conserva la responsabilidad de revisar y liquidar.",
    href: "/recursos/ley-2466-2025-horas-extra-colombia",
  },
];

export function HomeSections() {
  return (
    <>
      <section id="funciones" className={styles.section}>
        <div className={styles.shell}>
          <h2 className={styles.sectionTitle}>Lo esencial del control de asistencia, bien hecho.</h2>
          <p className={styles.sectionLead}>
            Sin módulos que nunca usarás: las cuatro capacidades que sostienen el día a día de la
            asistencia.
          </p>
          <div className={styles.rows}>
            {features.map((feature) => (
              <div key={feature.title} className={styles.row}>
                <span className={styles.rowIcon}>
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className={styles.rowTitle}>{feature.title}</h3>
                <p className={styles.rowDesc}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.mist}`}>
        <div className={styles.shell}>
          <h2 className={styles.sectionTitle}>De la configuración al reporte en cuatro pasos.</h2>
          <ol className={styles.steps}>
            {steps.map(([title, description], index) => (
              <li key={title}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}.
                </span>
                <h3 className={styles.stepTitle}>{title}</h3>
                <p className={styles.stepDesc}>{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <h2 className={styles.sectionTitle}>Control útil, sin convertirlo en vigilancia.</h2>
          <p className={styles.sectionLead}>
            Finalidad definida, acceso limitado, consentimiento documentado y revisión humana para
            tratar la evidencia con criterio.
          </p>
          <div className={styles.rows}>
            {privacyLinks.map((item) => (
              <Link key={item.href} href={item.href} className={`${styles.row} ${styles.rowLink}`}>
                <span className={styles.rowIcon}>
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className={styles.rowTitle}>{item.title}</h3>
                <div>
                  <p className={styles.rowDesc}>{item.description}</p>
                  <span className={styles.rowCta}>
                    Leer la guía <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="integraciones" className={`${styles.section} ${styles.mist}`}>
        <div className={styles.shell}>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className={styles.sectionTitle}>La información lista para seguir su camino.</h2>
              <p className={styles.sectionLead}>
                API, webhooks y MCP disponibles en el plan de pago, para integrar los datos de
                asistencia con otros flujos.
              </p>
            </div>
            <Link
              href="/producto#integraciones"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#365caa] hover:text-[#2c4c8f]"
            >
              Ver capacidades técnicas <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.rows}>
            {integrations.map((integration) => (
              <div key={integration.title} className={styles.row}>
                <span className={styles.rowIcon}>
                  <integration.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className={styles.rowTitle}>{integration.title}</h3>
                <p className={styles.rowDesc}>{integration.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

interface HomeFaq {
  question: string;
  answer: string;
}

export function HomeFaq({ faqs }: { faqs: HomeFaq[] }) {
  return (
    <section className={styles.section}>
      <div className={styles.shell}>
        <h2 className={styles.sectionTitle}>Lo importante, sin letra pequeña.</h2>
        <div className={styles.faqWrap}>
          {faqs.map((faq) => (
            <details key={faq.question} className={styles.faqItem}>
              <summary>
                {faq.question}
                <span className={styles.faqIcon} aria-hidden="true">
                  +
                </span>
              </summary>
              <p className={styles.faqAnswer}>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

interface HomeCtaProps {
  appUrl: string;
  freeEmployeeLimit: number;
  priceCop: number;
  priceUsd: number;
}

export function HomeCta({ appUrl, freeEmployeeLimit, priceCop, priceUsd }: HomeCtaProps) {
  return (
    <section className={`${styles.section} ${styles.mist}`}>
      <div className={styles.shell}>
        <div className={styles.ctaPanel}>
          <h2 className={styles.ctaTitle}>Empieza a registrar asistencia con evidencia.</h2>
          <p className={styles.ctaLead}>
            Plan gratis con hasta {freeEmployeeLimit} empleados, sin tarjeta. El plan de pago cuesta{" "}
            {formatCop(priceCop)} o {formatUsd(priceUsd)} USD por empleado al mes, con cobro mensual,
            e incluye API y MCP.
          </p>
          <div className={styles.ctaActions}>
            <a href={`${appUrl}/register`} className={styles.buttonPrimary}>
              Empezar gratis <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <a href={`${appUrl}/pricing`} className={styles.buttonGhost}>
              Revisar planes
            </a>
          </div>
          <ul className={`${styles.heroNote} mt-6 justify-center`}>
            <li>
              <Check className="h-4 w-4" aria-hidden="true" /> Sin tarjeta
            </li>
            <li>
              <Check className="h-4 w-4" aria-hidden="true" /> Reportes incluidos
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
