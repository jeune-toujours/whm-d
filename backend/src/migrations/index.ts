import * as migration_20261004_151036_initial from './20261004_151036_initial';

export const migrations = [
  {
    up: migration_20261004_151036_initial.up,
    down: migration_20261004_151036_initial.down,
    name: '20261004_151036_initial'
  },
];
