export const fetchApi = async (url, options = {}) => {
  options.credentials = 'include';
  
  let response = await fetch(url, options);

  if (response.status === 401) {
    // Try to refresh token
    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });

    if (refreshRes.ok) {
      // Retry original request
      response = await fetch(url, options);
    } else {
      // Refresh failed, clear user state
      window.dispatchEvent(new Event('auth-failed'));
    }
  }

  return response;
};
