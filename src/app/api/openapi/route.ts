import { NextResponse } from "next/server";

const ATTACHMENT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", example: "annual-report.pdf" },
    path: { type: "string", example: "/uploads/docs/2026/annual-report.pdf" },
    mimeType: { type: "string", example: "application/pdf" },
  },
  required: ["name", "path", "mimeType"],
};

const spec = {
  openapi: "3.0.3",
  info: {
    title: "RTRDA Website API",
    version: "1.0.0",
    description:
      "REST API for the Rail Technology Research and Development Agency (สทร.) website. " +
      "All list endpoints support `language` (`th`/`en`) and `limit`/`offset` pagination. " +
      "Single-item endpoints return 404 when not found.",
  },
  servers: [{ url: "/api", description: "Local dev" }],
  tags: [
    { name: "News", description: "ข่าวสาร-กิจกรรม" },
    { name: "Procurement", description: "จัดซื้อจัดจ้าง" },
    { name: "Publications", description: "เอกสารเผยแพร่" },
    { name: "Featured Projects", description: "ผลงานและโครงการเด่น" },
    { name: "Flipbooks", description: "คลังความรู้" },
    { name: "Pages", description: "Static pages" },
    { name: "Jobs", description: "สมัครงาน" },
    { name: "FAQ", description: "ถาม-ตอบ" },
    { name: "Events", description: "ปฏิทินกิจกรรม" },
    { name: "Partners", description: "พันธมิตรทางยุทธศาสตร์" },
    { name: "Hero Slides", description: "Homepage banner" },
    { name: "Media", description: "Media file registry" },
    { name: "Legacy", description: "Legacy wp_content endpoints (read-only)" },
  ],
  paths: {
    // ─── News ───────────────────────────────────────────────────────────────
    "/news": {
      get: {
        tags: ["News"],
        summary: "List news items",
        parameters: [
          { $ref: "#/components/parameters/language" },
          {
            name: "category",
            in: "query",
            schema: {
              type: "string",
              enum: ["ข่าว-กิจกรรม", "ความร่วมมือ", "ทันข่าวเทคโนโลยีระบบราง", "อบรม-สัมมนา"],
            },
          },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/offset" },
        ],
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/NewsItem" } } } },
          },
        },
      },
    },
    "/news/{slug}": {
      get: {
        tags: ["News"],
        summary: "Get news item by slug",
        parameters: [{ $ref: "#/components/parameters/slug" }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/NewsItem" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── Procurement ────────────────────────────────────────────────────────
    "/procurement": {
      get: {
        tags: ["Procurement"],
        summary: "List procurement announcements",
        parameters: [
          { $ref: "#/components/parameters/language" },
          {
            name: "category",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "ประกาศเชิญชวน", "ประกาศราคากลาง", "ประกาศผลผู้เสนอราคา",
                "ประกาศผลผู้ชนะ", "ร่างTOR", "ยกเลิก", "แผนการจัดซื้อ", "สขร.",
              ],
            },
          },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/offset" },
        ],
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/ProcurementItem" } } } },
          },
        },
      },
    },
    "/procurement/{slug}": {
      get: {
        tags: ["Procurement"],
        summary: "Get procurement item by slug",
        parameters: [{ $ref: "#/components/parameters/slug" }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/ProcurementItem" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── Publications ────────────────────────────────────────────────────────
    "/publications": {
      get: {
        tags: ["Publications"],
        summary: "List publications (เอกสารเผยแพร่)",
        parameters: [
          { $ref: "#/components/parameters/language" },
          { name: "category", in: "query", schema: { type: "string", enum: ["หลักธรรมาภิบาล", "รายงานผล"] } },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/offset" },
        ],
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/PublicationItem" } } } },
          },
        },
      },
    },
    "/publications/{slug}": {
      get: {
        tags: ["Publications"],
        summary: "Get publication by slug",
        parameters: [{ $ref: "#/components/parameters/slug" }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/PublicationItem" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── Featured Projects ───────────────────────────────────────────────────
    "/featured-projects": {
      get: {
        tags: ["Featured Projects"],
        summary: "List featured projects (ผลงานและโครงการเด่น)",
        parameters: [
          { $ref: "#/components/parameters/language" },
          {
            name: "category",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "วิจัย-นวัตกรรม", "มาตรฐาน-ระบบทดสอบ", "การถ่ายทอดเทคโนโลยี",
                "ฐานข้อมูลเทคโนโลยี", "ยุทธศาสตร์-เทคโนโลยี", "พัฒนา-บุคลากร",
              ],
            },
          },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/offset" },
        ],
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/FeaturedProjectItem" } } } },
          },
        },
      },
    },
    "/featured-projects/{slug}": {
      get: {
        tags: ["Featured Projects"],
        summary: "Get featured project by slug",
        parameters: [{ $ref: "#/components/parameters/slug" }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/FeaturedProjectItem" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── Flipbooks ───────────────────────────────────────────────────────────
    "/flipbooks": {
      get: {
        tags: ["Flipbooks"],
        summary: "List flipbooks (คลังความรู้)",
        parameters: [
          { $ref: "#/components/parameters/language" },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/offset" },
        ],
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/FlipbookItem" } } } },
          },
        },
      },
    },
    "/flipbooks/{slug}": {
      get: {
        tags: ["Flipbooks"],
        summary: "Get flipbook by slug",
        parameters: [{ $ref: "#/components/parameters/slug" }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/FlipbookItem" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── Pages ───────────────────────────────────────────────────────────────
    "/pages": {
      get: {
        tags: ["Pages"],
        summary: "List static pages",
        parameters: [
          { $ref: "#/components/parameters/language" },
          {
            name: "parent_slug",
            in: "query",
            description: "Filter by parent page slug. Use `__root__` to get top-level pages only.",
            schema: { type: "string", example: "__root__" },
          },
          { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 500 } },
        ],
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/PageItem" } } } },
          },
        },
      },
    },
    "/pages/{slug}": {
      get: {
        tags: ["Pages"],
        summary: "Get page by full slug path (e.g. /เกี่ยวกับ-สทร/mission)",
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            description: "Full URL path of the page, URL-encoded. Supports nested paths.",
            schema: { type: "string", example: "เกี่ยวกับ-สทร" },
          },
        ],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/PageItem" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── Jobs ────────────────────────────────────────────────────────────────
    "/jobs": {
      get: {
        tags: ["Jobs"],
        summary: "List job listings (สมัครงาน)",
        parameters: [
          { $ref: "#/components/parameters/language" },
          {
            name: "is_open",
            in: "query",
            description: "Filter by open status. Omit for all.",
            schema: { type: "boolean", default: true },
          },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/offset" },
        ],
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/JobItem" } } } },
          },
        },
      },
    },
    "/jobs/{slug}": {
      get: {
        tags: ["Jobs"],
        summary: "Get job listing by slug",
        parameters: [{ $ref: "#/components/parameters/slug" }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/JobItem" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── FAQ ─────────────────────────────────────────────────────────────────
    "/faq": {
      get: {
        tags: ["FAQ"],
        summary: "List FAQ items (ถาม-ตอบ)",
        parameters: [
          { $ref: "#/components/parameters/language" },
          { name: "category", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/FaqItem" } } } },
          },
        },
      },
    },

    // ─── Events ──────────────────────────────────────────────────────────────
    "/events": {
      get: {
        tags: ["Events"],
        summary: "List calendar events (ปฏิทินกิจกรรม)",
        parameters: [
          { $ref: "#/components/parameters/language" },
          {
            name: "from",
            in: "query",
            description: "Start date filter (ISO 8601 date, e.g. 2026-06-01)",
            schema: { type: "string", format: "date", example: "2026-06-01" },
          },
          {
            name: "to",
            in: "query",
            description: "End date filter (ISO 8601 date, e.g. 2026-06-30)",
            schema: { type: "string", format: "date", example: "2026-06-30" },
          },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
        ],
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/EventItem" } } } },
          },
        },
      },
    },

    // ─── Partners ────────────────────────────────────────────────────────────
    "/partners": {
      get: {
        tags: ["Partners"],
        summary: "List strategic partners (พันธมิตรทางยุทธศาสตร์)",
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/PartnerItem" } } } },
          },
        },
      },
    },

    // ─── Hero Slides ─────────────────────────────────────────────────────────
    "/hero-slides": {
      get: {
        tags: ["Hero Slides"],
        summary: "List homepage banner slides",
        parameters: [
          { $ref: "#/components/parameters/language" },
          {
            name: "active_only",
            in: "query",
            description: "Return only active slides (default: true)",
            schema: { type: "boolean", default: true },
          },
        ],
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/HeroSlideItem" } } } },
          },
        },
      },
    },

    // ─── Media ───────────────────────────────────────────────────────────────
    "/media/{id}": {
      get: {
        tags: ["Media"],
        summary: "Get media record by ID",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
        ],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/MediaItem" } } } },
          400: { description: "Invalid id" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── Legacy ──────────────────────────────────────────────────────────────
    "/content": {
      get: {
        tags: ["Legacy"],
        summary: "[Legacy] List wp_content records",
        parameters: [
          { $ref: "#/components/parameters/language" },
          { name: "kind", in: "query", schema: { type: "string", enum: ["page", "post", "flipbook", "category", "fallback"] } },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/offset" },
        ],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WpContentRecord" } } } } },
        },
      },
    },
    "/content/{path}": {
      get: {
        tags: ["Legacy"],
        summary: "[Legacy] Get wp_content record by path",
        parameters: [
          { name: "path", in: "path", required: true, schema: { type: "string", example: "ข่าวสาร-กิจกรรม/my-post" } },
        ],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/WpContentRecord" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/posts": {
      get: {
        tags: ["Legacy"],
        summary: "[Legacy] Get latest posts from wp_content",
        parameters: [
          { $ref: "#/components/parameters/language" },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
        ],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WpContentRecord" } } } } },
        },
      },
    },
    "/search": {
      get: {
        tags: ["Legacy"],
        summary: "[Legacy] Full-text search on wp_content",
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 80, maximum: 200 } },
        ],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WpContentRecord" } } } } },
        },
      },
    },
    "/downloads": {
      get: {
        tags: ["Legacy"],
        summary: "[Legacy] List downloadable files",
        parameters: [
          { name: "group", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WpDownloadAsset" } } } } },
        },
      },
    },
    "/downloads/{id}": {
      get: {
        tags: ["Legacy"],
        summary: "[Legacy] Get download by ID",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/WpDownloadAsset" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/navigation/{language}": {
      get: {
        tags: ["Legacy"],
        summary: "[Legacy] Get site navigation tree",
        parameters: [
          { name: "language", in: "path", required: true, schema: { type: "string", enum: ["th", "en"] } },
        ],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WpNavigationItem" } } } } },
        },
      },
    },
    "/meta": {
      get: {
        tags: ["Legacy"],
        summary: "[Legacy] Get content generation metadata",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { type: "object", properties: { generatedAt: { type: "string", format: "date-time" } } },
              },
            },
          },
        },
      },
    },
  },
  components: {
    parameters: {
      language: {
        name: "language",
        in: "query",
        description: "Content language",
        schema: { type: "string", enum: ["th", "en"], default: "th" },
      },
      limit: {
        name: "limit",
        in: "query",
        schema: { type: "integer", default: 20, maximum: 200 },
      },
      offset: {
        name: "offset",
        in: "query",
        schema: { type: "integer", default: 0, minimum: 0 },
      },
      slug: {
        name: "slug",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
    },
    responses: {
      NotFound: {
        description: "Not found",
        content: { "application/json": { schema: { type: "object", properties: { error: { type: "string", example: "Not found" } } } } },
      },
    },
    schemas: {
      Attachment: ATTACHMENT_SCHEMA,

      NewsItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          language: { type: "string", enum: ["th", "en"] },
          slug: { type: "string" },
          title: { type: "string" },
          excerpt: { type: "string" },
          body: { type: "string" },
          category: { type: "string", example: "ข่าว-กิจกรรม" },
          featuredImageId: { type: "integer", nullable: true },
          attachments: { type: "array", items: { $ref: "#/components/schemas/Attachment" } },
          publishedAt: { type: "string", format: "date-time", nullable: true },
          updatedAt: { type: "string", format: "date-time", nullable: true },
        },
      },

      ProcurementItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          language: { type: "string", enum: ["th", "en"] },
          slug: { type: "string" },
          title: { type: "string" },
          excerpt: { type: "string" },
          category: { type: "string", example: "ประกาศเชิญชวน" },
          attachments: { type: "array", items: { $ref: "#/components/schemas/Attachment" } },
          publishedAt: { type: "string", format: "date-time", nullable: true },
          updatedAt: { type: "string", format: "date-time", nullable: true },
        },
      },

      PublicationItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          language: { type: "string", enum: ["th", "en"] },
          slug: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          category: { type: "string", example: "หลักธรรมาภิบาล" },
          featuredImageId: { type: "integer", nullable: true },
          attachments: { type: "array", items: { $ref: "#/components/schemas/Attachment" } },
          publishedAt: { type: "string", format: "date-time", nullable: true },
          updatedAt: { type: "string", format: "date-time", nullable: true },
        },
      },

      FeaturedProjectItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          language: { type: "string", enum: ["th", "en"] },
          slug: { type: "string" },
          title: { type: "string" },
          excerpt: { type: "string" },
          body: { type: "string" },
          category: { type: "string", example: "วิจัย-นวัตกรรม" },
          featuredImageId: { type: "integer", nullable: true },
          attachments: { type: "array", items: { $ref: "#/components/schemas/Attachment" } },
          publishedAt: { type: "string", format: "date-time", nullable: true },
          updatedAt: { type: "string", format: "date-time", nullable: true },
        },
      },

      FlipbookItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          language: { type: "string", enum: ["th", "en"] },
          slug: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          coverImageId: { type: "integer", nullable: true },
          pdfPath: { type: "string", nullable: true, example: "/uploads/flipbooks/2026/guide.pdf" },
          publishedAt: { type: "string", format: "date-time", nullable: true },
          updatedAt: { type: "string", format: "date-time", nullable: true },
        },
      },

      PageItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          language: { type: "string", enum: ["th", "en"] },
          slug: { type: "string", example: "/เกี่ยวกับ-สทร" },
          title: { type: "string" },
          body: { type: "string" },
          parentSlug: { type: "string", nullable: true },
          featuredImageId: { type: "integer", nullable: true },
          attachments: { type: "array", items: { $ref: "#/components/schemas/Attachment" } },
          sortOrder: { type: "integer" },
          updatedAt: { type: "string", format: "date-time", nullable: true },
        },
      },

      JobItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          language: { type: "string", enum: ["th", "en"] },
          slug: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          deadline: { type: "string", format: "date-time", nullable: true },
          attachments: { type: "array", items: { $ref: "#/components/schemas/Attachment" } },
          isOpen: { type: "boolean" },
          publishedAt: { type: "string", format: "date-time", nullable: true },
          updatedAt: { type: "string", format: "date-time", nullable: true },
        },
      },

      FaqItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          language: { type: "string", enum: ["th", "en"] },
          question: { type: "string" },
          answer: { type: "string" },
          category: { type: "string" },
          sortOrder: { type: "integer" },
          updatedAt: { type: "string", format: "date-time", nullable: true },
        },
      },

      EventItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          language: { type: "string", enum: ["th", "en"] },
          title: { type: "string" },
          description: { type: "string" },
          eventDate: { type: "string", format: "date", example: "2026-07-14" },
          startTime: { type: "string", nullable: true, example: "09:00" },
          endTime: { type: "string", nullable: true, example: "17:00" },
          location: { type: "string" },
          registrationUrl: { type: "string" },
          colorHex: { type: "string", example: "#0055c7" },
          attachments: { type: "array", items: { $ref: "#/components/schemas/Attachment" } },
          createdAt: { type: "string", format: "date-time", nullable: true },
        },
      },

      PartnerItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          logoImageId: { type: "integer", nullable: true },
          logoPath: { type: "string", nullable: true },
          websiteUrl: { type: "string" },
          sortOrder: { type: "integer" },
        },
      },

      HeroSlideItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          language: { type: "string", enum: ["th", "en"] },
          imageId: { type: "integer", nullable: true },
          imagePath: { type: "string", nullable: true, example: "/uploads/hero/2026/slide1.jpg" },
          altText: { type: "string" },
          linkUrl: { type: "string" },
          caption: { type: "string" },
          sortOrder: { type: "integer" },
          isActive: { type: "boolean" },
        },
      },

      MediaItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          filename: { type: "string", example: "photo.jpg" },
          filePath: { type: "string", example: "/uploads/images/2026/06/photo.jpg" },
          mimeType: { type: "string", example: "image/jpeg" },
          sizeBytes: { type: "integer", nullable: true },
          width: { type: "integer", nullable: true },
          height: { type: "integer", nullable: true },
          altText: { type: "string" },
          uploadedAt: { type: "string", format: "date-time", nullable: true },
        },
      },

      WpContentRecord: {
        type: "object",
        properties: {
          id: { type: "string" },
          wpId: { type: "string" },
          language: { type: "string", enum: ["th", "en"] },
          kind: { type: "string", enum: ["page", "post", "flipbook", "category", "fallback"] },
          path: { type: "string" },
          title: { type: "string" },
          excerpt: { type: "string" },
          date: { type: "string" },
          parentPath: { type: "string", nullable: true },
          featuredMediaId: { type: "string", nullable: true },
          featuredMediaPath: { type: "string", nullable: true },
        },
      },

      WpDownloadAsset: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          fileName: { type: "string" },
          mimeType: { type: "string" },
          sizeBytes: { type: "integer" },
          group: { type: "string" },
          localPath: { type: "string" },
        },
      },

      WpNavigationItem: {
        type: "object",
        properties: {
          label: { type: "string" },
          href: { type: "string" },
          path: { type: "string", nullable: true },
          external: { type: "boolean" },
          children: {
            type: "array",
            items: { $ref: "#/components/schemas/WpNavigationItem" },
          },
        },
      },
    },
  },
};

export function GET() {
  return NextResponse.json(spec, {
    headers: { "Cache-Control": "no-store" },
  });
}
