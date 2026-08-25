const completedAtFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatCompletedAt(createdAt: string): string {
  return completedAtFormatter.format(new Date(createdAt));
}
