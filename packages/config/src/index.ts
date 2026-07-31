export type RuntimeEnvironment = 'development' | 'test' | 'staging' | 'production';

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function requireConfigValue(
  values: Readonly<Record<string, string | undefined>>,
  key: string,
): string {
  const value = values[key]?.trim();
  if (!value) {
    throw new ConfigurationError(`Missing required configuration: ${key}`);
  }
  return value;
}

export function parseCommaSeparated(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function validateEnvironment(value: string | undefined): RuntimeEnvironment {
  const environment = value ?? 'development';
  if (!['development', 'test', 'staging', 'production'].includes(environment)) {
    throw new ConfigurationError(`Unsupported runtime environment: ${environment}`);
  }
  return environment as RuntimeEnvironment;
}

export function redactConnectionUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) {
      url.password = '***';
    }
    if (url.username) {
      url.username = '***';
    }
    return url.toString();
  } catch {
    return '[invalid-url]';
  }
}
