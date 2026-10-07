import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * OAuth 2.0 (PKCE) login with the owner's X account, needed to read their bookmarks.
 * Scopes are read-only; offline.access gives a refresh token.
 */
const SCOPES = ["tweet.read", "users.read", "bookmark.read", "offline.access"];
const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";

export const redirectUri = () => process.env.X_REDIRECT_URI || "http://127.0.0.1:3000/api/x/callback";

export function xLoginConfigured(): boolean {
  return Boolean(process.env.X_CLIENT_ID);
}

function clientId(): string {
  const id = process.env.X_CLIENT_ID;
  if (!id) throw new Error("X_CLIENT_ID is not set in .env.local");
  return id;
}

async function getRow() {
  await db.insert(schema.xAuth).values({ id: 1 }).onConflictDoNothing();
  const [row] = await db.select().from(schema.xAuth).where(eq(schema.xAuth.id, 1));
  return row;
}

async function saveRow(values: Partial<typeof schema.xAuth.$inferInsert>) {
  await getRow();
  await db.update(schema.xAuth).set(values).where(eq(schema.xAuth.id, 1));
}

export async function xAccount(): Promise<{ username: string } | null> {
  const row = await getRow();
  return row.refreshToken && row.username ? { username: row.username } : null;
}

export async function disconnectX() {
  await saveRow({ userId: null, username: null, accessToken: null, refreshToken: null, expiresAt: null });
}

const base64url = (buf: Buffer) => buf.toString("base64url");

/** Start login: remember state + PKCE verifier, return X's authorize URL. */
export async function buildAuthorizeUrl(): Promise<string> {
  const state = base64url(crypto.randomBytes(16));
  const codeVerifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  await saveRow({ oauthState: state, codeVerifier });

  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId(),
    redirect_uri: redirectUri(),
    scope: SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  // "Web App" (confidential) clients authenticate with the secret; "Native App" clients don't have one
  const secret = process.env.X_CLIENT_SECRET;
  if (secret) headers.Authorization = `Basic ${Buffer.from(`${clientId()}:${secret}`).toString("base64")}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers,
    body: new URLSearchParams({ client_id: clientId(), ...params }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`X token request failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  return body as TokenResponse;
}

async function saveTokens(t: TokenResponse) {
  await saveRow({
    accessToken: t.access_token,
    // X rotates refresh tokens: always keep the newest one
    ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}),
    expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000),
  });
}

/** Finish login: exchange the code, then look up who logged in. */
export async function completeLogin(code: string, state: string) {
  const row = await getRow();
  if (!row.oauthState || state !== row.oauthState || !row.codeVerifier) {
    throw new Error("Login expired or state mismatch. Try connecting again.");
  }
  const tokens = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: row.codeVerifier,
  });
  await saveTokens(tokens);
  await saveRow({ oauthState: null, codeVerifier: null });

  const res = await fetch("https://api.x.com/2/users/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const me = (await res.json().catch(() => ({}))) as { data?: { id: string; username: string } };
  if (!res.ok || !me.data) throw new Error(`Could not read your X account (${res.status})`);
  await saveRow({ userId: me.data.id, username: me.data.username });
}

/** A valid access token + user id, refreshing the token when it has expired. */
export async function getXSession(): Promise<{ accessToken: string; userId: string }> {
  const row = await getRow();
  if (!row.refreshToken || !row.userId) throw new Error("X account not connected (Settings → Connect X)");
  if (row.accessToken && row.expiresAt && row.expiresAt.getTime() > Date.now()) {
    return { accessToken: row.accessToken, userId: row.userId };
  }
  const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: row.refreshToken });
  await saveTokens(tokens);
  return { accessToken: tokens.access_token, userId: row.userId };
}
