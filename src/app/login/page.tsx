import { LogoMark } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

// Reads the "next" search param on every request
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <LogoMark size={56} />
      <div className="space-y-1 text-center">
        <h1 className="t-h3">Content Machine</h1>
        <p className="t-small text-muted">Enter your password to continue.</p>
      </div>
      <LoginForm next={next} />
    </div>
  );
}
