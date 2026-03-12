import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { users, oauthTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import SetupWizard from "@/components/SetupWizard";

interface SearchParams {
  error?: string;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await getSession();

  let currentStep = 1;
  let userData: { name: string; email: string; canvasIcsUrl: string | null } | undefined;
  let accountsData: { role: string; email: string | null; connected: boolean }[] | undefined;

  if (session) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    if (user) {
      const tokenRows = await db.query.oauthTokens.findMany({
        where: eq(oauthTokens.userId, session.userId),
      });

      const personalConnected = tokenRows.some((r) => r.role === "personal");
      const setupComplete = personalConnected && user.canvasIcsUrl !== null;

      if (setupComplete) {
        redirect("/dashboard");
      }

      userData = {
        name: user.name,
        email: user.email,
        canvasIcsUrl: user.canvasIcsUrl,
      };
      accountsData = tokenRows.map((r) => ({
        role: r.role,
        email: r.email,
        connected: true,
      }));

      if (personalConnected) {
        const schoolConnected = tokenRows.some((r) => r.role === "school");
        currentStep = schoolConnected ? 3 : 2;
      } else {
        currentStep = 1;
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {/* Subtle background glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-amber-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-orange-500/[0.03] rounded-full blur-[120px]" />
      </div>

      <main className="w-full max-w-md flex flex-col items-center gap-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[--color-accent]" />
            <span className="text-[--color-text-tertiary] text-xs uppercase tracking-[0.2em] font-medium">
              Setup
            </span>
          </div>
          <h1 className="text-3xl font-semibold text-[--color-text-primary] tracking-tight">
            Canvas to GCal
          </h1>
          <p className="text-sm text-[--color-text-secondary] max-w-sm mx-auto leading-relaxed">
            Connect your accounts to sync Canvas assignments to Google Calendar.
          </p>
        </div>

        <SetupWizard
          currentStep={currentStep}
          user={userData}
          accounts={accountsData}
          error={params.error}
        />
      </main>
    </div>
  );
}
