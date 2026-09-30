export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (res.status === 401) {
    const signInUrl = new URL("/auth/signin", window.location.href);
    signInUrl.searchParams.set("callbackUrl", window.location.pathname);
    window.location.href = signInUrl.toString();
  }

  return res;
}
