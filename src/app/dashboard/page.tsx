import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { users, oauthTokens } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import SyncDashboard from "@/components/SyncDashboard";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const [user, schoolToken] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, session.userId),
    }),
    db.query.oauthTokens.findFirst({
      where: and(
        eq(oauthTokens.userId, session.userId),
        eq(oauthTokens.role, "school")
      ),
    }),
  ]);

  if (!user) {
    redirect("/");
  }

  const userName = user.name;
  const hasCanvasUrl = !!user.canvasIcsUrl;
  const hasSchoolAccount = !!schoolToken;
  const initialEventTypeSettings = {
    syncAssignments: user.syncAssignments ?? true,
    syncQuizzes: user.syncQuizzes ?? true,
    syncDiscussions: user.syncDiscussions ?? true,
    syncEvents: user.syncEvents ?? true,
  };

  return (
    <SyncDashboard
      userName={userName}
      hasCanvasUrl={hasCanvasUrl}
      hasSchoolAccount={hasSchoolAccount}
      initialEventTypeSettings={initialEventTypeSettings}
    />
  );
}
