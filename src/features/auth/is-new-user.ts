export function isNewAuthUser(user: {
  created_at: string;
  last_sign_in_at?: string;
}) {
  const createdAt = Date.parse(user.created_at);
  const lastSignInAt = Date.parse(user.last_sign_in_at ?? user.created_at);
  return (
    Number.isFinite(createdAt) &&
    Number.isFinite(lastSignInAt) &&
    Math.abs(lastSignInAt - createdAt) <= 60_000
  );
}
