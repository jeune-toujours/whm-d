import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "storage_items" ADD COLUMN "seal_photo_id" uuid;
  ALTER TABLE "storage_items" ADD CONSTRAINT "storage_items_seal_photo_id_media_id_fk" FOREIGN KEY ("seal_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "storage_items_seal_photo_idx" ON "storage_items" USING btree ("seal_photo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "storage_items" DROP CONSTRAINT "storage_items_seal_photo_id_media_id_fk";

  DROP INDEX "storage_items_seal_photo_idx";
  ALTER TABLE "storage_items" DROP COLUMN "seal_photo_id";`)
}
