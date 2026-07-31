import { describe, expect, it } from 'vitest';

import {
  ConfigurationError,
  parseCommaSeparated,
  redactConnectionUrl,
  requireConfigValue,
  validateEnvironment,
} from './index.js';

describe('@nexora/config', () => {
  it('requires non-empty values', () => {
    expect(requireConfigValue({ API_URL: ' https://api.example.test ' }, 'API_URL')).toBe(
      'https://api.example.test',
    );
    expect(() => requireConfigValue({}, 'API_URL')).toThrow(ConfigurationError);
  });

  it('normalizes and de-duplicates comma-separated values', () => {
    expect(parseCommaSeparated('one, two,one, ,three')).toEqual(['one', 'two', 'three']);
    expect(parseCommaSeparated(undefined)).toEqual([]);
  });

  it('validates supported environments', () => {
    expect(validateEnvironment(undefined)).toBe('development');
    expect(validateEnvironment('production')).toBe('production');
    expect(() => validateEnvironment('preview')).toThrow(ConfigurationError);
  });

  it('redacts credentials in connection URLs', () => {
    const redacted = redactConnectionUrl('postgresql://user:secret@db.example.test/nexora');
    expect(redacted).not.toContain('secret');
    expect(redacted).not.toContain('user');
    expect(redacted).toContain('***');
    expect(redactConnectionUrl('not a url')).toBe('[invalid-url]');
  });
});
