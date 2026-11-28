import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_storage_items_status" ADD VALUE 'archived';
  CREATE TABLE "faqs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "question" varchar NOT NULL,
    "answer" varchar NOT NULL,
    "published" boolean DEFAULT false,
    "position" numeric DEFAULT 100 NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "storage_items" ADD COLUMN "archived_at" timestamp(3) with time zone;
  ALTER TABLE "storage_items" ADD COLUMN "archive_reason" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "faqs_id" uuid;
  CREATE INDEX "faqs_updated_at_idx" ON "faqs" USING btree ("updated_at");
  CREATE INDEX "faqs_created_at_idx" ON "faqs" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_faqs_fk" FOREIGN KEY ("faqs_id") REFERENCES "public"."faqs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_faqs_id_idx" ON "payload_locked_documents_rels" USING btree ("faqs_id");
  INSERT INTO faqs (question, answer, published, position) VALUES
    ('Как сдать вещи на хранение?', 'Откройте «Мои вещи» → «Сдать вещи» и выберите способ упаковки и передачи на склад.', true, 10),
    ('Как вернуть вещи?', 'Откройте «Мои вещи» → «Вернуть вещи», отметьте нужные позиции и выберите способ получения.', true, 20),
    ('Где посмотреть статус заказа?', 'Текущие заявки видны на экране «Мои вещи». Завершённые и отменённые заявки доступны в истории заказов.', true, 30);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "faqs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_faqs_fk";
  DROP TABLE "faqs";

  ALTER TABLE "storage_items" ALTER COLUMN "status" DROP DEFAULT;
  ALTER TABLE "storage_items" ALTER COLUMN "status" SET DATA TYPE text;
  UPDATE "storage_items" SET "status" = 'returned' WHERE "status" = 'archived';
  DROP TYPE "public"."enum_storage_items_status";
  CREATE TYPE "public"."enum_storage_items_status" AS ENUM('expected', 'received', 'stored', 'reserved', 'picked', 'returned');
  ALTER TABLE "storage_items" ALTER COLUMN "status" SET DATA TYPE "public"."enum_storage_items_status" USING "status"::"public"."enum_storage_items_status";
  ALTER TABLE "storage_items" ALTER COLUMN "status" SET DEFAULT 'expected'::"public"."enum_storage_items_status";
  DROP INDEX "payload_locked_documents_rels_faqs_id_idx";
  ALTER TABLE "storage_items" DROP COLUMN "archived_at";
  ALTER TABLE "storage_items" DROP COLUMN "archive_reason";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "faqs_id";`)
}
