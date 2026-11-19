import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_damage_reports_status" AS ENUM('pending', 'published');
  ALTER TABLE "damage_reports" ALTER COLUMN "ticket_id" DROP NOT NULL;
  ALTER TABLE "damage_reports" ADD COLUMN "status" "enum_damage_reports_status" DEFAULT 'pending' NOT NULL;
  ALTER TABLE "damage_reports" ADD COLUMN "published_at" timestamp(3) with time zone;
  ALTER TABLE "damage_reports" ADD COLUMN "published_by_id" uuid;
  ALTER TABLE "damage_reports" ADD COLUMN "published_by_name" varchar;
  ALTER TABLE "media" ADD COLUMN "internal_only" boolean DEFAULT false;
  -- Previously notified cases stay public. Do not invent a confirmation actor.
  UPDATE "damage_reports" AS report SET "status" = 'published', "published_at" = ticket."created_at"
    FROM "support_tickets" AS ticket WHERE report."ticket_id" = ticket."id";
  ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "damage_reports_status_idx" ON "damage_reports" USING btree ("status");
  CREATE INDEX "damage_reports_published_by_idx" ON "damage_reports" USING btree ("published_by_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "damage_reports" DROP CONSTRAINT "damage_reports_published_by_id_users_id_fk";

  DROP INDEX "damage_reports_status_idx";
  DROP INDEX "damage_reports_published_by_idx";
  ALTER TABLE "damage_reports" ALTER COLUMN "ticket_id" SET NOT NULL;
  ALTER TABLE "damage_reports" DROP COLUMN "status";
  ALTER TABLE "damage_reports" DROP COLUMN "published_at";
  ALTER TABLE "damage_reports" DROP COLUMN "published_by_id";
  ALTER TABLE "damage_reports" DROP COLUMN "published_by_name";
  ALTER TABLE "media" DROP COLUMN "internal_only";
  DROP TYPE "public"."enum_damage_reports_status";`)
}
