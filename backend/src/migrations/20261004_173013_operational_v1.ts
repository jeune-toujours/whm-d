import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tariffs_kind" AS ENUM('storage', 'subscription');
  CREATE TYPE "public"."enum_tariffs_item_type" AS ENUM('box', 'item');
  ALTER TYPE "public"."enum_media_purpose" ADD VALUE 'support';
  CREATE TABLE "support_tickets_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" uuid NOT NULL,
    "path" varchar NOT NULL,
    "media_id" uuid
  );

  ALTER TABLE "users" ADD COLUMN "payment_brand" varchar;
  ALTER TABLE "users" ADD COLUMN "payment_last4" varchar;
  ALTER TABLE "orders" ADD COLUMN "request_hash" varchar;
  ALTER TABLE "orders" ADD COLUMN "payment_id" uuid;
  ALTER TABLE "tariffs" ADD COLUMN "kind" "enum_tariffs_kind" DEFAULT 'storage' NOT NULL;
  ALTER TABLE "tariffs" ADD COLUMN "item_type" "enum_tariffs_item_type" DEFAULT 'box' NOT NULL;
  ALTER TABLE "tariffs" ADD COLUMN "test_only" boolean DEFAULT false;
  ALTER TABLE "payments" ADD COLUMN "provider" varchar;
  ALTER TABLE "payments" ADD COLUMN "idempotency_key" varchar;
  ALTER TABLE "payments" ADD COLUMN "order_id" uuid;
  ALTER TABLE "payments" ADD COLUMN "tariff_id" uuid;
  ALTER TABLE "support_tickets_rels" ADD CONSTRAINT "support_tickets_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "support_tickets_rels" ADD CONSTRAINT "support_tickets_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "support_tickets_rels_order_idx" ON "support_tickets_rels" USING btree ("order");
  CREATE INDEX "support_tickets_rels_parent_idx" ON "support_tickets_rels" USING btree ("parent_id");
  CREATE INDEX "support_tickets_rels_path_idx" ON "support_tickets_rels" USING btree ("path");
  CREATE INDEX "support_tickets_rels_media_id_idx" ON "support_tickets_rels" USING btree ("media_id");
  ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "orders_payment_idx" ON "orders" USING btree ("payment_id");
  CREATE UNIQUE INDEX "payments_idempotency_key_idx" ON "payments" USING btree ("idempotency_key");
  CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");
  CREATE INDEX "payments_tariff_idx" ON "payments" USING btree ("tariff_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "support_tickets_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "support_tickets_rels" CASCADE;
  ALTER TABLE "orders" DROP CONSTRAINT "orders_payment_id_payments_id_fk";

  ALTER TABLE "payments" DROP CONSTRAINT "payments_order_id_orders_id_fk";

  ALTER TABLE "payments" DROP CONSTRAINT "payments_tariff_id_tariffs_id_fk";

  ALTER TABLE "media" ALTER COLUMN "purpose" SET DATA TYPE text;
  DROP TYPE "public"."enum_media_purpose";
  CREATE TYPE "public"."enum_media_purpose" AS ENUM('intake', 'return', 'signature', 'document');
  ALTER TABLE "media" ALTER COLUMN "purpose" SET DATA TYPE "public"."enum_media_purpose" USING "purpose"::"public"."enum_media_purpose";
  DROP INDEX "orders_payment_idx";
  DROP INDEX "payments_idempotency_key_idx";
  DROP INDEX "payments_order_idx";
  DROP INDEX "payments_tariff_idx";
  ALTER TABLE "users" DROP COLUMN "payment_brand";
  ALTER TABLE "users" DROP COLUMN "payment_last4";
  ALTER TABLE "orders" DROP COLUMN "request_hash";
  ALTER TABLE "orders" DROP COLUMN "payment_id";
  ALTER TABLE "tariffs" DROP COLUMN "kind";
  ALTER TABLE "tariffs" DROP COLUMN "item_type";
  ALTER TABLE "tariffs" DROP COLUMN "test_only";
  ALTER TABLE "payments" DROP COLUMN "provider";
  ALTER TABLE "payments" DROP COLUMN "idempotency_key";
  ALTER TABLE "payments" DROP COLUMN "order_id";
  ALTER TABLE "payments" DROP COLUMN "tariff_id";
  DROP TYPE "public"."enum_tariffs_kind";
  DROP TYPE "public"."enum_tariffs_item_type";`)
}
