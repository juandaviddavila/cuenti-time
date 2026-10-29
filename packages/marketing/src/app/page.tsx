import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { RoiCalculator } from "@/components/roi-calculator";
import { HomeCta, HomeFaq, HomeSections } from "@/components/home/home-sections";
import { WorkdayPreview } from "@/components/home/workday-preview";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { fetchBillingConfig, formatCop, formatUsd } from "@/lib/billing";
import styles from "@/app/page.module.css";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7578").replace(
  /\/$/,
  "",
);

const staticFaqs = [
  {
    question: "¿La geocerca rastrea al trabajador todo el día?",
    answer:
      "No. La ubicación se solicita al marcar desde un dispositivo móvil y se usa para calcular la distancia a la sucursal. No es un sistema de seguimiento continuo y en equipos de escritorio no se exige GPS.",
  },
  {
    question: "¿cuenti time reemplaza un software de nómina?",
    answer:
      "No. Organiza la evidencia de asistencia para facilitar la revisión previa a nómina. Puede integrarse con otros sistemas mediante API y webhooks.",
  },
  {
    question: "¿Qué información facial almacena el sistema?",
    answer:
      "El producto trabaja con un descriptor numérico del rostro para comparar similitud. La implementación requiere consentimiento biométrico y no necesita conservar la fotografía original.",
  },
] as const;

export default async function HomePage() {
  const billing = await fetchBillingConfig();
  const faqs = [
    {
      question: "¿El plan gratis requiere tarjeta?",
      answer: `No. Puedes crear una cuenta en plan gratis con hasta ${billing.freeEmployeeLimit} empleados, sin ingresar una tarjeta. API y MCP requieren plan de pago.`,
    },
    ...staticFaqs,
  ];
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: siteConfig.name,
              url: siteConfig.siteUrl,
              logo: absoluteUrl("/logo-simbolo.svg"),
            },
            {
              "@type": "SoftwareApplication",
              name: siteConfig.name,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description: siteConfig.description,
              url: siteConfig.siteUrl,
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "COP",
                description: `Plan gratis hasta ${billing.freeEmployeeLimit} empleados; plan de pago desde ${formatCop(billing.priceCopPerEmployeeMonthly)} o ${formatUsd(billing.priceUsdPerEmployeeMonthly)} USD por empleado al mes, con cobro mensual`,
              },
            },
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: faq.answer,
                },
              })),
            },
          ],
        }}
      />

      <div className={styles.home}>
        <section className={styles.hero}>
          <div className={styles.shell}>
            <div className={styles.heroGrid}>
              <div>
                <h1 className={styles.heroTitle}>
                  La asistencia de tu equipo, clara y verificable.
                </h1>
                <p className={styles.heroLead}>
                  Marcación facial, validación por sucursal y reportes listos para revisar: quién
                  marcó, desde dónde y qué necesita tu atención.
                </p>
                <div className={styles.heroActions}>
                  <a href={`${appUrl}/register`} className={styles.buttonPrimary}>
                    Empezar gratis <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                  <Link href="/producto" className={styles.buttonGhost}>
                    Conocer el producto
                  </Link>
                </div>
                <ul className={styles.heroNote}>
                  <li>
                    <Check className="h-4 w-4" aria-hidden="true" /> Sin tarjeta
                  </li>
                  <li>
                    <Check className="h-4 w-4" aria-hidden="true" /> Hasta{" "}
                    {billing.freeEmployeeLimit} empleados gratis
                  </li>
                  <li>
                    <Check className="h-4 w-4" aria-hidden="true" /> Reportes incluidos
                  </li>
                </ul>
              </div>
              <WorkdayPreview />
            </div>
          </div>
        </section>

        <HomeSections />

        <RoiCalculator />

        <HomeFaq faqs={faqs} />

        <HomeCta
          appUrl={appUrl}
          freeEmployeeLimit={billing.freeEmployeeLimit}
          priceCop={billing.priceCopPerEmployeeMonthly}
          priceUsd={billing.priceUsdPerEmployeeMonthly}
        />
      </div>
    </>
  );
}
