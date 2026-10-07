ALTER TABLE "drafts" ADD COLUMN "run_id" integer;--> statement-breakpoint
ALTER TABLE "scout_runs" ADD COLUMN "job_id" integer;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_run_id_scout_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scout_runs"("id") ON DELETE set null ON UPDATE no action;