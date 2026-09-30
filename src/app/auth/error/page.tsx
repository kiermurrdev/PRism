import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ErrorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const error = params.error;

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "Access denied.",
    Verification: "Unable to verify your account.",
    Default: "Unable to sign in. Please try again.",
    OAuthSignin: "Unable to sign in with GitHub.",
    OAuthCallback: "OAuth callback failed.",
    Callback: "Sign-in callback failed.",
    OAuthCreateAccount: "Unable to create account.",
    CreateAccount: "Unable to create account.",
    CallbackOAuth: "OAuth callback failed.",
    OAuthAccountNotLinked: "To confirm your identity, sign in with the same account you used originally.",
    EmailSignin: "Unable to send email.",
    SessionRequired: "Please sign in to access this page.",
  };

  const message = error ? (errorMessages[error] || errorMessages.Default) : errorMessages.Default;

  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Sign-in error</h1>
      <p className="text-[#94A3B8] text-sm max-w-[360px]">{message}</p>
      <Link href="/auth/signin" className="text-[#8B5CF6] text-sm hover:underline">
        Try again
      </Link>
      <Link href="/" className="text-[#94A3B8] text-sm hover:text-[#F8FAFC]">
        Back to home
      </Link>
    </div>
  );
}
