import Image from "next/image";
import {
  highSpeedRailStandardDocuments,
  stripImportedHighSpeedRailSection,
} from "@/lib/wp/high-speed-rail-standards";

function HighSpeedRailStandardsSection() {
  return (
    <div className="lightweight-accordion has-text-color">
      <details open>
        <summary className="lightweight-accordion-title" style={{ color: "#003471" }}>
          <span>
            <strong>มาตรฐานโครงการรถไฟความเร็วสูง</strong>
          </span>
        </summary>
        <div className="lightweight-accordion-body">
          <div className="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
            {highSpeedRailStandardDocuments.map((document) => (
              <div
                className="wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow"
                key={document.code}
              >
                <div className="wp-block-image is-style-vk-image-shadow">
                  <figure className="aligncenter size-full is-resized">
                    <Image
                      alt={`สทร. ${document.code} 2568 ${document.title}`}
                      src={document.coverImage}
                      width={600}
                      height={852}
                      unoptimized
                    />
                  </figure>
                </div>

                <h6 className="wp-block-heading has-text-align-center is-style-vk-heading-default">
                  {document.code ? (
                    <>
                      <strong>สทร. {document.code} 2568</strong>
                      <br />
                    </>
                  ) : null}
                  <strong>{document.title}</strong>
                </h6>

                <div className="wp-block-buttons is-content-justification-center is-layout-flex wp-container-core-buttons-is-layout-16018d1d wp-block-buttons-is-layout-flex">
                  <div className="wp-block-button detail-btn">
                    <a
                      className="wp-block-button__link wp-element-button"
                      href={document.previewHref}
                    >
                      อ่านเพิ่มเติม
                    </a>
                  </div>
                </div>

                <p className="simple-download-counter">
                  <a
                    className="simple-download-counter-link"
                    data-pdf-reader-ignore="true"
                    download
                    href={document.downloadHref}
                  >
                    ดาวน์โหลดไฟล์
                  </a>
                </p>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

export function HighSpeedRailStandardsContent({ html }: { html: string }) {
  const restHtml = stripImportedHighSpeedRailSection(html);

  return (
    <div className="wp-content">
      <HighSpeedRailStandardsSection />
      <div dangerouslySetInnerHTML={{ __html: restHtml }} />
    </div>
  );
}
