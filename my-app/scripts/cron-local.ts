import { cleanupExpiredInvites, generateDueReminders } from "@/lib/jobs/scheduled";
import { drainJobs } from "@/lib/queue";

async function main() {
  const firstDrain = await drainJobs();
  const dueReminders = await generateDueReminders();
  const cleanupInvites = await cleanupExpiredInvites();
  const secondDrain = await drainJobs();

  console.log(
    JSON.stringify(
      {
        firstDrain,
        dueReminders,
        cleanupInvites,
        secondDrain,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
