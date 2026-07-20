export async function fetchWithRefresh(input: RequestInfo | URL, init?: RequestInit) {
  let response = await fetch(input, init);

  if (response.status !== 401) {
    return response;
  }

  const refreshResponse = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
  });

  if (!refreshResponse.ok) {
    return response;
  }

  response = await fetch(input, init);
  return response;
}
