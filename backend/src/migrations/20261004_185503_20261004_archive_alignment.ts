import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'developer-email';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'developer-email';
  ALTER TABLE "storage_items" ADD COLUMN "returned_at" timestamp(3) with time zone;
  ALTER TABLE "storage_items" ADD COLUMN "block_reason" varchar;
  ALTER TABLE "orders" ADD COLUMN "details" jsonb;
  ALTER TABLE "orders" ADD COLUMN "closed_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "history_search" varchar;
  ALTER TABLE "orders" ADD COLUMN "has_services" boolean DEFAULT false;
  ALTER TABLE "payments" ADD COLUMN "checkout" jsonb;
  ALTER TABLE "support_tickets" ADD COLUMN "details" jsonb;
  ALTER TABLE "support_tickets" ADD COLUMN "idempotency_key" varchar;
  CREATE INDEX "orders_closed_at_idx" ON "orders" USING btree ("closed_at");
  CREATE UNIQUE INDEX "support_tickets_idempotency_key_idx" ON "support_tickets" USING btree ("idempotency_key");`)
  // Older test releases did not keep immutable snapshots. Preserve that limitation
  // explicitly; recovered current values must never appear as original order facts.
  await db.execute(sql`
    UPDATE orders o SET closed_at = COALESCE(
      (SELECT MAX(e.created_at) FROM order_events e WHERE e.order_id = o.id AND e.status IN ('completed','cancelled')), o.updated_at)
    WHERE o.status IN ('completed','cancelled');
    UPDATE orders o SET history_search = LOWER(COALESCE((
      SELECT STRING_AGG(CONCAT_WS(' ',i.title,i.description,i.internal_i_d),' ')
      FROM orders_rels r JOIN storage_items i ON i.id = r.storage_items_id
      WHERE r.parent_id = o.id AND r.path = 'items'), '')),
      details = jsonb_build_object('legacySnapshot', true)
    WHERE o.details IS NULL;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'send-otp');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'send-otp');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "orders_closed_at_idx";
  DROP INDEX "support_tickets_idempotency_key_idx";
  ALTER TABLE "storage_items" DROP COLUMN "returned_at";
  ALTER TABLE "storage_items" DROP COLUMN "block_reason";
  ALTER TABLE "orders" DROP COLUMN "details";
  ALTER TABLE "orders" DROP COLUMN "closed_at";
  ALTER TABLE "orders" DROP COLUMN "history_search";
  ALTER TABLE "orders" DROP COLUMN "has_services";
  ALTER TABLE "payments" DROP COLUMN "checkout";
  ALTER TABLE "support_tickets" DROP COLUMN "details";
  ALTER TABLE "support_tickets" DROP COLUMN "idempotency_key";`)
}
