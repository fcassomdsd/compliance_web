import { describe, it, expect, vi, beforeEach } from 'vitest';
import { default as axios } from 'axios';

import { authLogin, authLogout, authSession } from '@/services/authServices';

vi.mock('axios', () => ({
  default: vi.fn(),
}));

describe('authServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authLogin validates username and password', async () => {
    await expect(authLogin('', 'secret')).rejects.toThrow('authLogin: username is required');
    await expect(authLogin('user', '')).rejects.toThrow('authLogin: password is required');
  });

  it('authLogin posts credentials with cookies enabled', async () => {
    vi.mocked(axios).mockResolvedValueOnce({ data: { authenticated: true }, status: 200 });

    const result = await authLogin(' alice ', 'secret');

    expect(axios).toHaveBeenCalledWith({
      method: 'post',
      url: '/api/auth/login',
      data: {
        username: 'alice',
        password: 'secret',
      },
      withCredentials: true,
    });
    expect(result).toEqual({ data: { authenticated: true }, status: 200 });
  });

  it('authSession gets session with cookies enabled', async () => {
    vi.mocked(axios).mockResolvedValueOnce({ data: { authenticated: true }, status: 200 });

    const result = await authSession();

    expect(axios).toHaveBeenCalledWith({
      method: 'get',
      url: '/api/auth/session',
      withCredentials: true,
    });
    expect(result.status).toBe(200);
  });

  it('authLogout posts logout with cookies enabled', async () => {
    vi.mocked(axios).mockResolvedValueOnce({ data: { ok: true }, status: 200 });

    const result = await authLogout();

    expect(axios).toHaveBeenCalledWith({
      method: 'post',
      url: '/api/auth/logout',
      headers: {},
      withCredentials: true,
    });
    expect(result).toEqual({ data: { ok: true }, status: 200 });
  });

  it('wraps axios failures', async () => {
    vi.mocked(axios).mockRejectedValueOnce(new Error('boom'));
    await expect(authSession()).rejects.toThrow('authSession: boom');
  });
});