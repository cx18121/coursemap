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
    <div className="min-h-screen p-6">
      {/* Background glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-amber-500/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="max-w-2xl mx-auto pt-12 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[--color-text-primary] tracking-tight">
            Welcome, {user.name}
          </h1>
          <p className="text-sm text-[--color-text-secondary]">
            Your accounts are connected. Sync features coming soon.
          </p>
        </div>

        {user.canvasIcsUrl && (
          <div className="bg-[--color-surface] border border-[--color-border] rounded-xl p-4 flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-[--color-text-primary] font-medium">
                Canvas feed connected
              </p>
              <p className="text-xs text-[--color-text-tertiary] mt-0.5">
                Ready to sync assignments to your calendar.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
