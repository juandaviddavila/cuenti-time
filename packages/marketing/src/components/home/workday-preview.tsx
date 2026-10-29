import { Check, MapPin, ScanFace, TriangleAlert } from "lucide-react";
import styles from "@/app/page.module.css";

interface PreviewEvent {
  time: string;
  initials: string;
  name: string;
  action: string;
  branch: string;
  ok: boolean;
}

const previewEvents: PreviewEvent[] = [
  {
    time: "07:58",
    initials: "AM",
    name: "Ana M.",
    action: "Entrada",
    branch: "Sede Norte",
    ok: true,
  },
  {
    time: "08:04",
    initials: "JC",
    name: "Juan C.",
    action: "Entrada",
    branch: "Sede Norte",
    ok: true,
  },
  {
    time: "12:31",
    initials: "LV",
    name: "Laura V.",
    action: "Salida",
    branch: "Sede Norte",
    ok: true,
  },
  {
    time: "17:02",
    initials: "JC",
    name: "Juan C.",
    action: "Salida",
    branch: "Sede Norte",
    ok: true,
  },
  {
    time: "17:59",
    initials: "AP",
    name: "Andrés P.",
    action: "Entrada",
    branch: "Sede Norte",
    ok: false,
  },
];

export function WorkdayPreview() {
  return (
    <div className={styles.previewWrap}>
      <figure className={styles.preview} aria-label="Ejemplo ilustrativo de un día de asistencia">
        <span className={styles.previewBadge}>
          <ScanFace className="h-3.5 w-3.5" aria-hidden="true" />
          Vista ilustrativa
        </span>
        <div className={styles.previewHead}>
          <h2>Sede Norte · martes</h2>
          <p>Marcaciones del día con validación facial y ubicación</p>
        </div>
        <ul className={styles.previewList}>
          {previewEvents.map((event) => (
            <li key={`${event.time}-${event.name}`} className={styles.previewEvent}>
              <span className={styles.eventTime}>{event.time}</span>
              <span className={styles.eventAvatar} aria-hidden="true">
                {event.initials}
              </span>
              <div className={styles.eventBody}>
                <p className={styles.eventName}>
                  {event.name} · {event.action}
                </p>
                <p className={styles.eventMeta}>
                  {event.branch} · reconocimiento facial
                </p>
              </div>
              {event.ok ? (
                <span className={styles.statusOk}>
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Dentro de la sucursal
                </span>
              ) : (
                <span className={styles.statusWarn}>
                  <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                  Fuera del radio
                </span>
              )}
            </li>
          ))}
        </ul>
        <figcaption className={styles.previewFoot}>
          Datos de ejemplo con fines ilustrativos; no corresponden a personas reales.
        </figcaption>
      </figure>
      <div className={styles.previewRail} aria-hidden="true">
        <span>
          <MapPin className="h-3.5 w-3.5" />
          Geocerca por sucursal en dispositivos móviles
        </span>
        <span>
          <ScanFace className="h-3.5 w-3.5" />
          Descriptor facial, no fotografías almacenadas
        </span>
      </div>
    </div>
  );
}
