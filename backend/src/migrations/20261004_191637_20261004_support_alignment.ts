import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_support_type" AS ENUM('incident', 'technical');
  ALTER TYPE "public"."enum_support_tickets_status" ADD VALUE 'rejected';
  ALTER TYPE "public"."enum_support_tickets_status" ADD VALUE 'answered';
  ALTER TABLE "support_tickets" ADD COLUMN "close_reason" varchar;
  ALTER TABLE "support_messages" ADD COLUMN "idempotency_key" varchar;
  ALTER TABLE "media" ADD COLUMN "support_type" "enum_media_support_type" DEFAULT 'incident';
  CREATE UNIQUE INDEX "support_messages_idempotency_key_idx" ON "support_messages" USING btree ("idempotency_key");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "support_tickets" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "support_tickets" ALTER COLUMN "status" SET DEFAULT 'submitted'::text;
  DROP TYPE "public"."enum_support_tickets_status";
  CREATE TYPE "public"."enum_support_tickets_status" AS ENUM('submitted', 'in_progress', 'resolved');
  ALTER TABLE "support_tickets" ALTER COLUMN "status" SET DEFAULT 'submitted'::"public"."enum_support_tickets_status";
  ALTER TABLE "support_tickets" ALTER COLUMN "status" SET DATA TYPE "public"."enum_support_tickets_status" USING "status"::"public"."enum_support_tickets_status";
  DROP INDEX "support_messages_idempotency_key_idx";
  ALTER TABLE "support_tickets" DROP COLUMN "close_reason";
  ALTER TABLE "support_messages" DROP COLUMN "idempotency_key";
  ALTER TABLE "media" DROP COLUMN "support_type";
  DROP TYPE "public"."enum_media_support_type";`)
}
