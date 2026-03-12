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

      // Returning user with completed setup — go straight to dashboard
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

      // Determine which step to show
      if (personalConnected) {
        // Personal connected but canvasIcsUrl not set
        // Check if school is connected (then skip to step 3, otherwise step 2)
        const schoolConnected = tokenRows.some((r) => r.role === "school");
        currentStep = schoolConnected ? 3 : 2;
      } else {
        currentStep = 1;
      }
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-8 bg-zinc-950 overflow-hidden font-sans">
      {/* Dynamic Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full mix-blend-screen filter blur-[128px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-emerald-500/20 rounded-full mix-blend-screen filter blur-[128px] pointer-events-none" />

      {/* Content Container */}
      <main className="z-10 w-full max-w-2xl flex flex-col items-center gap-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-teal-300 tracking-tight">
            Canvas to GCal
          </h1>
          <p className="text-base text-white/50 max-w-xl mx-auto font-light">
            Sync your Canvas assignments and school calendar to Google Calendar.
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
