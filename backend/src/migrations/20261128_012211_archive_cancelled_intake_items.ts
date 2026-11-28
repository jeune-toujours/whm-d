import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    UPDATE storage_items AS item
    SET status = 'archived', archived_at = COALESCE(orders.closed_at, orders.updated_at),
        archive_reason = 'Заявка отменена до приёмки'
    FROM orders_rels AS rel
    JOIN orders ON orders.id = rel.parent_id
    WHERE rel.path = 'items' AND item.id = rel.storage_items_id
      AND orders.type = 'intake' AND orders.status = 'cancelled'
      AND item.status IN ('expected', 'returned') AND item.started_at IS NULL
      AND item.returned_at IS NULL AND item.cell_id IS NULL AND item.barcode IS NULL
  `)
}

// The schema rollback maps all archived records back to the prior returned state.
export async function down(_args: MigrateDownArgs) {}
