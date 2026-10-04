import * as migration_20261004_151036_initial from './20261004_151036_initial';
import * as migration_20261004_173013_operational_v1 from './20261004_173013_operational_v1';

export const migrations = [
  {
    up: migration_20261004_151036_initial.up,
    down: migration_20261004_151036_initial.down,
    name: '20261004_151036_initial',
  },
  {
    up: migration_20261004_173013_operational_v1.up,
    down: migration_20261004_173013_operational_v1.down,
    name: '20261004_173013_operational_v1'
  },
];
