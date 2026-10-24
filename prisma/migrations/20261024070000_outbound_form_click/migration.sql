-- Extend the dedicated event vocabulary only. Existing rows and retention are unchanged.
BEGIN;
ALTER TABLE "web_activity_events_v2" DROP CONSTRAINT "web_activity_events_v2_event_type_check";
ALTER TABLE "web_activity_events_v2" ADD CONSTRAINT "web_activity_events_v2_event_type_check"
CHECK (event_type IN ('page_request','page_view','link_click','download_click','download_response','redirect_response','outbound_form_click'));
COMMIT;
