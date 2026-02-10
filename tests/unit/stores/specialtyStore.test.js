import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSpecialtyStore } from '@/stores/specialtyStore';

describe('specialtyStore', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  it('provides a predefined list of specialties', () => {
    const store = useSpecialtyStore();
    expect(store.specialties).toBeDefined();
    expect(store.specialties.length).toBeGreaterThanOrEqual(7);
    expect(store.specialties.find(s => s.code === 'ATS')).toBeTruthy();
    expect(store.specialties.find(s => s.code === 'WLD')).toBeTruthy();
  });
});
