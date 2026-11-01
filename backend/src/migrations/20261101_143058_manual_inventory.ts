import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_inventory_sessions_status" AS ENUM('in_progress', 'completed', 'completed_with_discrepancies');
  CREATE TYPE "public"."enum_inventory_session_cells_status" AS ENUM('pending', 'matched', 'discrepancy');
  CREATE TABLE "inventory_sessions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"number" varchar NOT NULL,
  	"status" "enum_inventory_sessions_status" DEFAULT 'in_progress' NOT NULL,
  	"initiator_id" uuid NOT NULL,
  	"initiator_name" varchar NOT NULL,
  	"warehouse_names" varchar NOT NULL,
  	"cell_count" numeric NOT NULL,
  	"checked_count" numeric DEFAULT 0 NOT NULL,
  	"discrepancy_count" numeric DEFAULT 0 NOT NULL,
  	"started_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone,
  	"idempotency_key" varchar NOT NULL,
  	"request_hash" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inventory_session_cells" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"session_id" uuid NOT NULL,
  	"cell_id" uuid NOT NULL,
  	"cell_label" varchar NOT NULL,
  	"cell_barcode" varchar NOT NULL,
  	"warehouse_i_d" varchar NOT NULL,
  	"warehouse_name" varchar NOT NULL,
  	"zone" varchar,
  	"active" boolean DEFAULT true NOT NULL,
  	"status" "enum_inventory_session_cells_status" DEFAULT 'pending' NOT NULL,
  	"expected_items" jsonb NOT NULL,
  	"observed_codes" jsonb,
  	"observed_items" jsonb,
  	"discrepancies" jsonb,
  	"accounting_at_check" jsonb,
  	"accounting_changed" boolean DEFAULT false,
  	"comment" varchar,
  	"checked_by_id" uuid,
  	"checked_by_name" varchar,
  	"checked_at" timestamp(3) with time zone,
  	"check_key" varchar,
  	"check_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inventory_sessions_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inventory_session_cells_id" uuid;
  ALTER TABLE "inventory_sessions" ADD CONSTRAINT "inventory_sessions_initiator_id_users_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_session_cells" ADD CONSTRAINT "inventory_session_cells_session_id_inventory_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."inventory_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_session_cells" ADD CONSTRAINT "inventory_session_cells_cell_id_cells_id_fk" FOREIGN KEY ("cell_id") REFERENCES "public"."cells"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_session_cells" ADD CONSTRAINT "inventory_session_cells_checked_by_id_users_id_fk" FOREIGN KEY ("checked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "inventory_sessions_number_idx" ON "inventory_sessions" USING btree ("number");
  CREATE INDEX "inventory_sessions_status_idx" ON "inventory_sessions" USING btree ("status");
  CREATE INDEX "inventory_sessions_initiator_idx" ON "inventory_sessions" USING btree ("initiator_id");
  CREATE UNIQUE INDEX "inventory_sessions_idempotency_key_idx" ON "inventory_sessions" USING btree ("idempotency_key");
  CREATE INDEX "inventory_sessions_updated_at_idx" ON "inventory_sessions" USING btree ("updated_at");
  CREATE INDEX "inventory_sessions_created_at_idx" ON "inventory_sessions" USING btree ("created_at");
  CREATE INDEX "inventory_session_cells_session_idx" ON "inventory_session_cells" USING btree ("session_id");
  CREATE INDEX "inventory_session_cells_cell_idx" ON "inventory_session_cells" USING btree ("cell_id");
  CREATE INDEX "inventory_session_cells_active_idx" ON "inventory_session_cells" USING btree ("active");
  CREATE INDEX "inventory_session_cells_checked_by_idx" ON "inventory_session_cells" USING btree ("checked_by_id");
  CREATE UNIQUE INDEX "inventory_session_cells_check_key_idx" ON "inventory_session_cells" USING btree ("check_key");
  CREATE INDEX "inventory_session_cells_updated_at_idx" ON "inventory_session_cells" USING btree ("updated_at");
  CREATE INDEX "inventory_session_cells_created_at_idx" ON "inventory_session_cells" USING btree ("created_at");
  CREATE UNIQUE INDEX "session_cell_idx" ON "inventory_session_cells" USING btree ("session_id","cell_id");
  CREATE UNIQUE INDEX "inventory_session_cells_active_cell_unique" ON "inventory_session_cells" ("cell_id") WHERE "active" = true;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inventory_sessions_fk" FOREIGN KEY ("inventory_sessions_id") REFERENCES "public"."inventory_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inventory_session_cells_fk" FOREIGN KEY ("inventory_session_cells_id") REFERENCES "public"."inventory_session_cells"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_inventory_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("inventory_sessions_id");
  CREATE INDEX "payload_locked_documents_rels_inventory_session_cells_id_idx" ON "payload_locked_documents_rels" USING btree ("inventory_session_cells_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_inventory_sessions_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_inventory_session_cells_fk";
  ALTER TABLE "inventory_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "inventory_session_cells" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "inventory_sessions" CASCADE;
  DROP TABLE "inventory_session_cells" CASCADE;
  DROP INDEX "payload_locked_documents_rels_inventory_sessions_id_idx";
  DROP INDEX "payload_locked_documents_rels_inventory_session_cells_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "inventory_sessions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "inventory_session_cells_id";
  DROP TYPE "public"."enum_inventory_sessions_status";
  DROP TYPE "public"."enum_inventory_session_cells_status";`)
}
