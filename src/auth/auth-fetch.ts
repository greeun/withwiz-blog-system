export interface AuthFetchConfig {
  refreshEndpoint: string;
  loginPath: string;
}

export function createAuthFetch(config: AuthFetchConfig): typeof fetch {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const response = await fetch(input, {
      ...init,
      credentials: 'same-origin',
    });

    if (response.status !== 401) {
      return response;
    }

    const refreshResponse = await fetch(config.refreshEndpoint, {
      method: 'POST',
      credentials: 'same-origin',
    });

    if (refreshResponse.ok) {
      return fetch(input, {
        ...init,
        credentials: 'same-origin',
      });
    }

    if (typeof window !== 'undefined') {
      window.location.href = config.loginPath;
    }

    return response;
  };
}
