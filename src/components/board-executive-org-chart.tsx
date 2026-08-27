import Image from "next/image";
import type {
  BoardExecutiveOrgChart as BoardExecutiveOrgChartData,
  BoardExecutivePerson,
  BoardExecutivePresentation,
} from "@/lib/wp/board-executives";
import type { WpLanguage } from "@/lib/wp/types";
import {
  BoardExecutiveDetailButton,
  BoardExecutiveLegacyDetailsHydrator,
} from "./board-executive-details";
import { ManagerSubUnitsButton } from "./manager-sub-units-button";
import styles from "./board-executive-org-chart.module.css";

function labels(language: WpLanguage) {
  return language === "th"
    ? {
        vacant: "รอการแต่งตั้ง",
        empty: "(ว่าง)",
        email: "Email",
        noEmail: "-",
      }
    : {
        vacant: "Vacant",
        empty: "(Vacant)",
        email: "Email",
        noEmail: "-",
      };
}

function PersonCard({
  person,
  language,
  hideVacantLabel = false,
  showSubUnitsButton = false,
}: {
  person: BoardExecutivePerson;
  language: WpLanguage;
  hideVacantLabel?: boolean;
  showSubUnitsButton?: boolean;
}) {
  const text = labels(language);
  const displayName = person.vacant ? (hideVacantLabel ? "" : text.empty) : person.name;
  const showImage = !person.vacant && Boolean(person.imageSrc);
  const showContact = !hideVacantLabel;

  return (
    <article className={`${styles.card} ${person.vacant ? styles.vacant : ""}`}>
      <div className={styles.portrait}>
        {showImage ? (
          <Image
            src={person.imageSrc as string}
            alt={person.imageAlt || displayName}
            className={styles.image}
            fill
            sizes="(max-width: 720px) 170px, 180px"
            unoptimized
          />
        ) : (
          <span aria-hidden="true" className={styles.placeholder}>
            {text.empty}
          </span>
        )}
      </div>
      <div className={styles.copy}>
        {displayName ? <h3>{displayName}</h3> : null}
        <p className={styles.role}>{person.role}</p>
      </div>
      {showContact ? (
        <dl className={styles.contact}>
          <div>
            <dt>{text.email}</dt>
            <dd>
              {person.email ? (
                <a href={`mailto:${person.email}`}>{person.email}</a>
              ) : (
                text.noEmail
              )}
            </dd>
          </div>
        </dl>
      ) : null}
      {!person.vacant ? (
        <div className={styles.detailButtonWrap}>
          <BoardExecutiveDetailButton language={language} name={person.name} />
        </div>
      ) : null}
      {showSubUnitsButton && !person.vacant ? (
        <div className={styles.subUnitsButtonWrap}>
          <ManagerSubUnitsButton role={person.role} language={language} />
        </div>
      ) : null}
    </article>
  );
}

function BranchRow({
  people,
  className,
  hideVacantLabels = false,
  language,
  showSubUnitsButton = false,
}: {
  people: BoardExecutivePerson[];
  className: string;
  hideVacantLabels?: boolean;
  language: WpLanguage;
  showSubUnitsButton?: boolean;
}) {
  return (
    <div className={`${styles.branch} ${className}`}>
      <div className={styles.row}>
        {people.map((person, index) => (
          <div className={styles.node} key={`${person.role}-${person.name}-${index}`}>
            <PersonCard
              person={person}
              language={language}
              hideVacantLabel={hideVacantLabels}
              showSubUnitsButton={showSubUnitsButton}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BoardExecutiveOrgChart({
  chart,
  language,
  open,
}: {
  chart: BoardExecutiveOrgChartData;
  language: WpLanguage;
  open: boolean;
}) {
  return (
    <section className={`lightweight-accordion ${styles.root}`}>
      <details open={open}>
        <summary className="lightweight-accordion-title">
          <span>{chart.title}</span>
        </summary>
        <div className="lightweight-accordion-body">
          <div className={styles.chart}>
            <div className={styles.director}>
              <PersonCard person={chart.director} language={language} />
            </div>
            <BranchRow
              people={chart.deputies}
              className={styles.deputies}
              hideVacantLabels
              language={language}
            />
            <BranchRow
              people={chart.generalManagers}
              className={styles.generalManagers}
              language={language}
              showSubUnitsButton
            />
          </div>
        </div>
      </details>
    </section>
  );
}

export function BoardExecutiveContent({
  presentation,
}: {
  presentation: BoardExecutivePresentation;
}) {
  return (
    <div className="wp-content">
      {presentation.segments.map((segment, index) =>
        segment.kind === "html" ? (
          <div key={`html-${index}`} dangerouslySetInnerHTML={{ __html: segment.html }} />
        ) : (
          <BoardExecutiveOrgChart
            key={`chart-${index}`}
            chart={presentation.chart}
            language={presentation.language}
            open={presentation.open}
          />
        ),
      )}
      <BoardExecutiveLegacyDetailsHydrator language={presentation.language} />
    </div>
  );
}
