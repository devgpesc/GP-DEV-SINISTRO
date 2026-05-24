export const getAuthRedirectUrl = (path = '/auth/callback') => {
  const baseUrl = (() => {
    try {
      return window.location.origin;
    } catch {
      return '';
    }
  })();

  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};
