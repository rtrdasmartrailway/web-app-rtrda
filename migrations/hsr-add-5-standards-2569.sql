-- ============================================================
-- Add 5 construction work standards (HSR-CT series) to rail standards page
-- ============================================================
-- This migration adds 5 new HSR standard cards to the
-- "มาตรฐานโครงการรถไฟความเร็วสูง" accordion section of
-- /มาตรฐานระบบราง-สทร (TH only). Each card has:
--   - Cover image (reused from card #1: 2025-05-30-164836.jpg)
--   - Title (มาตรฐานงานสำรวจ, เจาะและระเบิด, ค้ำยัน, ตรวจวัด, ป้องกันน้ำ)
--   - อ่านเพิ่มเติม button (links to PDF)
--   - ดาวน์โหลดไฟล์ link (links to PDF)
--   - 2 empty placeholders
--
-- Each card links to a newly-mirrored PDF in
-- /public/sdc-downloads/8001.pdf - 8005.pdf.
--
-- The cards are inserted at the end of the HSR section body
-- (before the closing </div></details></div> tag of that section).
-- TH only — EN page is left unchanged per the request.
--
-- NOTE: In CI, the `db:seed` step runs and overwrites the DB with
-- src/data/wp-content.json. This migration is for local dev only.
-- The wp-content.json file is the source of truth.

BEGIN;

-- 1. Insert 5 new Download rows for the PDF files
INSERT INTO "Download" (id, "sourceUrl", "localPath", "fileName", "mimeType", "sizeBytes", title, "group", "sourcePages")
VALUES
  ('8001', 'https://www.rtrda.or.th/sdc_download/8001/', '/sdc-downloads/8001.pdf', 'สทร.-HSR-CT-1001-2568-มาตรฐานงานสำรวจ.pdf', 'application/pdf', 8116354, '0 downloads', 'มาตรฐานโครงการรถไฟความเร็วสูง', ARRAY['/มาตรฐานระบบราง-สทร']::text[]),
  ('8002', 'https://www.rtrda.or.th/sdc_download/8002/', '/sdc-downloads/8002.pdf', 'สทร.-HSR-CT-3001-2568-มาตรฐานงานเจาะและระเบิด.pdf', 'application/pdf', 8653347, '0 downloads', 'มาตรฐานโครงการรถไฟความเร็วสูง', ARRAY['/มาตรฐานระบบราง-สทร']::text[]),
  ('8003', 'https://www.rtrda.or.th/sdc_download/8003/', '/sdc-downloads/8003.pdf', 'สทร.-HSR-CT-5001-2568-มาตรฐานงานค้ำยัน.pdf', 'application/pdf', 6077656, '0 downloads', 'มาตรฐานโครงการรถไฟความเร็วสูง', ARRAY['/มาตรฐานระบบราง-สทร']::text[]),
  ('8004', 'https://www.rtrda.or.th/sdc_download/8004/', '/sdc-downloads/8004.pdf', 'สทร.-HSR-CT-4012-2568-มาตรฐานงานตรวจวัด.pdf', 'application/pdf', 7404855, '0 downloads', 'มาตรฐานโครงการรถไฟความเร็วสูง', ARRAY['/มาตรฐานระบบราง-สทร']::text[]),
  ('8005', 'https://www.rtrda.or.th/sdc_download/8005/', '/sdc-downloads/8005.pdf', 'สทร.-HSR-CT-1002-2568-มาตรฐานงานป้องกันน้ำ.pdf', 'application/pdf', 6289005, '0 downloads', 'มาตรฐานโครงการรถไฟความเร็วสูง', ARRAY['/มาตรฐานระบบราง-สทร']::text[])
ON CONFLICT (id) DO NOTHING;

-- 2. Update the HSR section of /มาตรฐานระบบราง-สทร to include 5 new cards
-- (TH page only, per request)
--
-- The new cards use the same image as card #1
-- (wp-content/uploads/2025/05/2025-05-30-164836.jpg) and follow the
-- same card structure: image + h6 title + อ่านเพิ่มเติม button + nested
-- download row + nested placeholder row.
--
-- The anchor below marks the end of the last existing card (7159)
-- placeholder row. The replacement inserts 5 new cards with full
-- structure right after the HSR section's last existing card.
UPDATE "ContentRecord"
SET "contentHtml" = REPLACE(
  "contentHtml",
  $hsr2569_anchor$id="simple-download-counter-7159" class="simple-download-counter"><a class="simple-download-counter-link" href="/sdc_download/7159" title="172 downloads">ดาวน์โหลดไฟล์</a></p><p></p>
</div>
</div>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"></div>



<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"></div>
</div>
</div>
</div>

</div></details></div>$hsr2569_anchor$,
  $hsr2569_replacement$id="simple-download-counter-7159" class="simple-download-counter"><a class="simple-download-counter-link" href="/sdc_download/7159" title="172 downloads">ดาวน์โหลดไฟล์</a></p><p></p>
</div>
</div>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"></div>



<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"></div>
</div>
</div>
</div>

<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow">
<div class="wp-block-image is-style-vk-image-shadow">
<figure class="aligncenter size-full is-resized"><img loading="lazy" decoding="async" width="600" height="852" src="/wp-content/uploads/2025/05/2025-05-30-164836.jpg" alt="" class="wp-image-6052" style="aspect-ratio:0.6790123456790124;object-fit:cover;width:165px;height:auto" srcset="/wp-content/uploads/2025/05/2025-05-30-164836.jpg 600w, /wp-content/uploads/2025/05/2025-05-30-164836-211x300.jpg 211w, /wp-content/uploads/2025/05/2025-05-30-164836-8x12.jpg 8w" sizes="auto, (max-width: 600px) 100vw, 600px"></figure>
</div>


<h6 class="wp-block-heading has-text-align-center is-style-vk-heading-default"><strong>มาตรฐานงานสำรวจ</strong></h6>


<div class="wp-block-buttons is-content-justification-center is-layout-flex wp-container-core-buttons-is-layout-16018d1d wp-block-buttons-is-layout-flex">
<div class="wp-block-button detail-btn rtr"><a class="wp-block-button__link wp-element-button" href="/sdc_download/8001" target="_blank" rel="noopener noreferrer">อ่านเพิ่มเติม</a></div>
</div>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"><p></p><p id="simple-download-counter-8001" class="simple-download-counter"><a class="simple-download-counter-link" href="/sdc_download/8001" title="0 downloads">ดาวน์โหลดไฟล์</a></p><p></p>
</div>
</div>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"></div>


<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"></div>
</div>
</div>

<div class="wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow">
<div class="wp-block-image is-style-vk-image-shadow">
<figure class="aligncenter size-full is-resized"><img loading="lazy" decoding="async" width="600" height="852" src="/wp-content/uploads/2025/05/2025-05-30-164836.jpg" alt="" class="wp-image-6052" style="aspect-ratio:0.6790123456790124;object-fit:cover;width:165px;height:auto" srcset="/wp-content/uploads/2025/05/2025-05-30-164836.jpg 600w, /wp-content/uploads/2025/05/2025-05-30-164836-211x300.jpg 211w, /wp-content/uploads/2025/05/2025-05-30-164836-8x12.jpg 8w" sizes="auto, (max-width: 600px) 100vw, 600px"></figure>
</div>


<h6 class="wp-block-heading has-text-align-center is-style-vk-heading-default"><strong>มาตรฐานงานเจาะและระเบิด</strong></h6>


<div class="wp-block-buttons is-content-justification-center is-layout-flex wp-container-core-buttons-is-layout-16018d1d wp-block-buttons-is-layout-flex">
<div class="wp-block-button detail-btn rtr"><a class="wp-block-button__link wp-element-button" href="/sdc_download/8002" target="_blank" rel="noopener noreferrer">อ่านเพิ่มเติม</a></div>
</div>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"><p></p><p id="simple-download-counter-8002" class="simple-download-counter"><a class="simple-download-counter-link" href="/sdc_download/8002" title="0 downloads">ดาวน์โหลดไฟล์</a></p><p></p>
</div>
</div>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"></div>


<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"></div>
</div>
</div>

<div class="wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow">
<div class="wp-block-image is-style-vk-image-shadow">
<figure class="aligncenter size-full is-resized"><img loading="lazy" decoding="async" width="600" height="852" src="/wp-content/uploads/2025/05/2025-05-30-164836.jpg" alt="" class="wp-image-6052" style="aspect-ratio:0.6790123456790124;object-fit:cover;width:165px;height:auto" srcset="/wp-content/uploads/2025/05/2025-05-30-164836.jpg 600w, /wp-content/uploads/2025/05/2025-05-30-164836-211x300.jpg 211w, /wp-content/uploads/2025/05/2025-05-30-164836-8x12.jpg 8w" sizes="auto, (max-width: 600px) 100vw, 600px"></figure>
</div>


<h6 class="wp-block-heading has-text-align-center is-style-vk-heading-default"><strong>มาตรฐานงานค้ำยัน</strong></h6>


<div class="wp-block-buttons is-content-justification-center is-layout-flex wp-container-core-buttons-is-layout-16018d1d wp-block-buttons-is-layout-flex">
<div class="wp-block-button detail-btn rtr"><a class="wp-block-button__link wp-element-button" href="/sdc_download/8003" target="_blank" rel="noopener noreferrer">อ่านเพิ่มเติม</a></div>
</div>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"><p></p><p id="simple-download-counter-8003" class="simple-download-counter"><a class="simple-download-counter-link" href="/sdc_download/8003" title="0 downloads">ดาวน์โหลดไฟล์</a></p><p></p>
</div>
</div>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"></div>


<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"></div>
</div>
</div>

<div class="wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow">
<div class="wp-block-image is-style-vk-image-shadow">
<figure class="aligncenter size-full is-resized"><img loading="lazy" decoding="async" width="600" height="852" src="/wp-content/uploads/2025/05/2025-05-30-164836.jpg" alt="" class="wp-image-6052" style="aspect-ratio:0.6790123456790124;object-fit:cover;width:165px;height:auto" srcset="/wp-content/uploads/2025/05/2025-05-30-164836.jpg 600w, /wp-content/uploads/2025/05/2025-05-30-164836-211x300.jpg 211w, /wp-content/uploads/2025/05/2025-05-30-164836-8x12.jpg 8w" sizes="auto, (max-width: 600px) 100vw, 600px"></figure>
</div>


<h6 class="wp-block-heading has-text-align-center is-style-vk-heading-default"><strong>มาตรฐานงานตรวจวัด</strong></h6>


<div class="wp-block-buttons is-content-justification-center is-layout-flex wp-container-core-buttons-is-layout-16018d1d wp-block-buttons-is-layout-flex">
<div class="wp-block-button detail-btn rtr"><a class="wp-block-button__link wp-element-button" href="/sdc_download/8004" target="_blank" rel="noopener noreferrer">อ่านเพิ่มเติม</a></div>
</div>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"><p></p><p id="simple-download-counter-8004" class="simple-download-counter"><a class="simple-download-counter-link" href="/sdc_download/8004" title="0 downloads">ดาวน์โหลดไฟล์</a></p><p></p>
</div>
</div>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"></div>


<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"></div>
</div>
</div>

<div class="wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow">
<div class="wp-block-image is-style-vk-image-shadow">
<figure class="aligncenter size-full is-resized"><img loading="lazy" decoding="async" width="600" height="852" src="/wp-content/uploads/2025/05/2025-05-30-164836.jpg" alt="" class="wp-image-6052" style="aspect-ratio:0.6790123456790124;object-fit:cover;width:165px;height:auto" srcset="/wp-content/uploads/2025/05/2025-05-30-164836.jpg 600w, /wp-content/uploads/2025/05/2025-05-30-164836-211x300.jpg 211w, /wp-content/uploads/2025/05/2025-05-30-164836-8w" sizes="auto, (max-width: 600px) 100vw, 600px"></figure>
</div>


<h6 class="wp-block-heading has-text-align-center is-style-vk-heading-default"><strong>มาตรฐานงานป้องกันน้ำ</strong></h6>


<div class="wp-block-buttons is-content-justification-center is-layout-flex wp-container-core-buttons-is-layout-16018d1d wp-block-buttons-is-layout-flex">
<div class="wp-block-button detail-btn rtr"><a class="wp-block-button__link wp-element-button" href="/sdc_download/8005" target="_blank" rel="noopener noreferrer">อ่านเพิ่มเติม</a></div>
</div>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"><p></p><p id="simple-download-counter-8005" class="simple-download-counter"><a class="simple-download-counter-link" href="/sdc_download/8005" title="0 downloads">ดาวน์โหลดไฟล์</a></p><p></p>
</div>
</div>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"></div>


<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow"></div>
</div>
</div>
</div>
</div></details></div>$hsr2569_replacement$
)
WHERE path = '/มาตรฐานระบบราง-สทร';

COMMIT;
