-- New dedicated event store only. No historical data import, update, or deletion.
CREATE TABLE "web_activity_events_v2" (
  "event_id" UUID NOT NULL,
  "environment" TEXT NOT NULL CHECK (environment IN ('test','production')),
  "event_type" TEXT NOT NULL CHECK (event_type IN ('page_request','page_view','link_click','download_click','download_response','redirect_response')),
  "path" TEXT NOT NULL,
  "target_path" TEXT,
  "source" TEXT NOT NULL CHECK (source IN ('direct','internal','external')),
  "channel" TEXT NOT NULL CHECK (channel IN ('client','server')),
  "method" TEXT,
  "status" INTEGER,
  "outcome" TEXT NOT NULL,
  "response_bytes" BIGINT,
  "device_type" TEXT NOT NULL,
  "is_bot" BOOLEAN NOT NULL DEFAULT false,
  "visitor_key" TEXT,
  "session_key" TEXT,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "web_activity_events_v2_pkey" PRIMARY KEY ("event_id")
);
CREATE INDEX "web_activity_events_v2_environment_occurred_at_idx" ON "web_activity_events_v2"("environment", "occurred_at");
CREATE INDEX "web_activity_events_v2_environment_event_type_occurred_at_idx" ON "web_activity_events_v2"("environment", "event_type", "occurred_at");
CREATE INDEX "web_activity_events_v2_environment_path_occurred_at_idx" ON "web_activity_events_v2"("environment", "path", "occurred_at");
