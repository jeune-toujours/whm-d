import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "damage_reports" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"number" varchar NOT NULL,
  	"owner_id" uuid NOT NULL,
  	"order_id" uuid NOT NULL,
  	"item_id" uuid NOT NULL,
  	"order_number" varchar NOT NULL,
  	"item_label" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"discovered_at_intake" boolean DEFAULT true NOT NULL,
  	"created_by_id" uuid NOT NULL,
  	"created_by_name" varchar NOT NULL,
  	"ticket_id" uuid NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"request_hash" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "damage_reports_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" uuid
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "damage_reports_id" uuid;
  ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_item_id_storage_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."storage_items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "damage_reports_rels" ADD CONSTRAINT "damage_reports_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."damage_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "damage_reports_rels" ADD CONSTRAINT "damage_reports_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "damage_reports_number_idx" ON "damage_reports" USING btree ("number");
  CREATE INDEX "damage_reports_owner_idx" ON "damage_reports" USING btree ("owner_id");
  CREATE INDEX "damage_reports_order_idx" ON "damage_reports" USING btree ("order_id");
  CREATE INDEX "damage_reports_item_idx" ON "damage_reports" USING btree ("item_id");
  CREATE INDEX "damage_reports_created_by_idx" ON "damage_reports" USING btree ("created_by_id");
  CREATE INDEX "damage_reports_ticket_idx" ON "damage_reports" USING btree ("ticket_id");
  CREATE UNIQUE INDEX "damage_reports_idempotency_key_idx" ON "damage_reports" USING btree ("idempotency_key");
  CREATE INDEX "damage_reports_updated_at_idx" ON "damage_reports" USING btree ("updated_at");
  CREATE INDEX "damage_reports_created_at_idx" ON "damage_reports" USING btree ("created_at");
  CREATE UNIQUE INDEX "order_item_idx" ON "damage_reports" USING btree ("order_id","item_id");
  CREATE INDEX "damage_reports_rels_order_idx" ON "damage_reports_rels" USING btree ("order");
  CREATE INDEX "damage_reports_rels_parent_idx" ON "damage_reports_rels" USING btree ("parent_id");
  CREATE INDEX "damage_reports_rels_path_idx" ON "damage_reports_rels" USING btree ("path");
  CREATE INDEX "damage_reports_rels_media_id_idx" ON "damage_reports_rels" USING btree ("media_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_damage_reports_fk" FOREIGN KEY ("damage_reports_id") REFERENCES "public"."damage_reports"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_damage_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("damage_reports_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_damage_reports_fk";
  ALTER TABLE "damage_reports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "damage_reports_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "damage_reports" CASCADE;
  DROP TABLE "damage_reports_rels" CASCADE;
  
  DROP INDEX "payload_locked_documents_rels_damage_reports_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "damage_reports_id";`)
}
