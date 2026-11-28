import * as migration_20261004_151036_initial from './20261004_151036_initial';
import * as migration_20261004_173013_operational_v1 from './20261004_173013_operational_v1';
import * as migration_20261004_185503_20261004_archive_alignment from './20261004_185503_20261004_archive_alignment';
import * as migration_20261004_191637_20261004_support_alignment from './20261004_191637_20261004_support_alignment';
import * as migration_20261101_143058_manual_inventory from './20261101_143058_manual_inventory';
import * as migration_20261119_135242_problem_orders from './20261119_135242_problem_orders';
import * as migration_20261119_145318_problem_confirmation from './20261119_145318_problem_confirmation';
import * as migration_20261122_133233_seal_photo from './20261122_133233_seal_photo';
import * as migration_20261128_012210_faq_and_intake_archive from './20261128_012210_faq_and_intake_archive';
import * as archiveCancelledIntakeItems from './20261128_012211_archive_cancelled_intake_items';

export const migrations = [
  {
    up: migration_20261004_151036_initial.up,
    down: migration_20261004_151036_initial.down,
    name: '20261004_151036_initial',
  },
  {
    up: migration_20261004_173013_operational_v1.up,
    down: migration_20261004_173013_operational_v1.down,
    name: '20261004_173013_operational_v1',
  },
  {
    up: migration_20261004_185503_20261004_archive_alignment.up,
    down: migration_20261004_185503_20261004_archive_alignment.down,
    name: '20261004_185503_20261004_archive_alignment',
  },
  {
    up: migration_20261004_191637_20261004_support_alignment.up,
    down: migration_20261004_191637_20261004_support_alignment.down,
    name: '20261004_191637_20261004_support_alignment',
  },
  {
    up: migration_20261101_143058_manual_inventory.up,
    down: migration_20261101_143058_manual_inventory.down,
    name: '20261101_143058_manual_inventory',
  },
  {
    up: migration_20261119_135242_problem_orders.up,
    down: migration_20261119_135242_problem_orders.down,
    name: '20261119_135242_problem_orders',
  },
  {
    up: migration_20261119_145318_problem_confirmation.up,
    down: migration_20261119_145318_problem_confirmation.down,
    name: '20261119_145318_problem_confirmation',
  },
  {
    up: migration_20261122_133233_seal_photo.up,
    down: migration_20261122_133233_seal_photo.down,
    name: '20261122_133233_seal_photo',
  },
  {
    up: migration_20261128_012210_faq_and_intake_archive.up,
    down: migration_20261128_012210_faq_and_intake_archive.down,
    name: '20261128_012210_faq_and_intake_archive',
  },
  {
    ...archiveCancelledIntakeItems,
    name: '20261128_012211_archive_cancelled_intake_items',
  },
];
