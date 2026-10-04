import * as migration_20261004_151036_initial from './20261004_151036_initial';
import * as migration_20261004_173013_operational_v1 from './20261004_173013_operational_v1';
import * as migration_20261004_185503_20261004_archive_alignment from './20261004_185503_20261004_archive_alignment';
import * as migration_20261004_191637_20261004_support_alignment from './20261004_191637_20261004_support_alignment';

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
    name: '20261004_191637_20261004_support_alignment'
  },
];
