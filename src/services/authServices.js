import { default as axios } from 'axios';

const authApiServer = import.meta.env.VITE_AUTH_API_BASE_URL || '/api/auth';

export async function authLogin(username, password) {
  try {
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      throw new Error('username is required');
    }
    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      throw new Error('password is required');
    }

    const result = await axios({
      method: 'post',
      url: `${authApiServer}/login`,
      data: {
        username: username.trim(),
        password,
      },
      withCredentials: true,
    });

    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('authLogin: ' + error.message);
  }
}

export async function authSession() {
  try {
    const result = await axios({
      method: 'get',
      url: `${authApiServer}/session`,
      withCredentials: true,
    });

    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('authSession: ' + error.message);
  }
}

export async function authLogout(csrfToken = null) {
  try {
    const result = await axios({
      method: 'post',
      url: `${authApiServer}/logout`,
      headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
      withCredentials: true,
    });

    return { data: result.data, status: result.status };
  } catch (error) {
    const failure = new Error('authLogout: ' + error.message);
    // Callers need the HTTP status: a CSRF mismatch (403) means the server kept
    // the session, which must not be treated like a dead session.
    failure.status = error?.response?.status;
    throw failure;
  }
}

export async function authSetLocale(locale, csrfToken = null) {
  try {
    const result = await axios({
      method: 'post',
      url: `${authApiServer}/locale`,
      data: { locale },
      headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
      withCredentials: true,
    });

    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('authSetLocale: ' + error.message);
  }
}

export async function authTicket(csrfToken) {
  try {
    if (!csrfToken) {
      throw new Error('csrfToken is required');
    }

    const result = await axios({
      method: 'get',
      url: `${authApiServer}/ticket`,
      headers: { 'x-csrf-token': csrfToken },
      withCredentials: true,
    });

    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('authTicket: ' + error.message);
  }
}
