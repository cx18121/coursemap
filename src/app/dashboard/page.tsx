import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-8 bg-zinc-950 overflow-hidden font-sans">
      {/* Dynamic Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full mix-blend-screen filter blur-[128px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-emerald-500/20 rounded-full mix-blend-screen filter blur-[128px] pointer-events-none" />

      <main className="z-10 w-full max-w-2xl">
        <div className="bg-white/10 p-8 rounded-2xl backdrop-blur-lg border border-white/20 shadow-xl space-y-4">
          <h1 className="text-3xl font-bold text-white">
            Welcome, {user.name}!
          </h1>
          <p className="text-white/60">
            Your accounts are connected. Sync features coming in Phase 2.
          </p>
          {user.canvasIcsUrl && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <p className="text-emerald-200 text-sm">
                Canvas feed connected and ready to sync.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
