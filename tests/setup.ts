import { vi } from 'vitest';

process.env.JWT_SECRET = 'test-jwt-secret-key-for-unit-testing-minimum-32-chars';
process.env.NODE_ENV = 'test';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
