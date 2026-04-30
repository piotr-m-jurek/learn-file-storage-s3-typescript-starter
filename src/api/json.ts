export function respondWithJSON(status: number, payload: any) {
  const body = JSON.stringify(payload, null, 2);
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
