import * as migration_20261004_151036_initial from './20261004_151036_initial';
import * as migration_20261004_173013_operational_v1 from './20261004_173013_operational_v1';
import * as migration_20261004_185503_20261004_archive_alignment from './20261004_185503_20261004_archive_alignment';
import * as migration_20261004_191637_20261004_support_alignment from './20261004_191637_20261004_support_alignment';
import * as migration_20261101_143058_manual_inventory from './20261101_143058_manual_inventory';
import * as migration_20261119_135242_problem_orders from './20261119_135242_problem_orders';
import * as migration_20261119_145318_problem_confirmation from './20261119_145318_problem_confirmation';

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
    name: '20261119_145318_problem_confirmation'
  },
];
