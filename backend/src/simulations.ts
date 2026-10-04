export const simulationsEnabled = () => process.env.APP_ENV === 'staging' && process.env.SIMULATE_INTEGRATIONS === 'true'
