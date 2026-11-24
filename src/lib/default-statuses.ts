import { StatusCategory } from "@prisma/client";

export const DEFAULT_WORKFLOW_STATUSES = [
  { name: "Backlog", slug: "backlog", category: StatusCategory.BACKLOG, color: "#71717a", position: 0 },
  { name: "Select For Sprint", slug: "select-for-sprint", category: StatusCategory.UNSTARTED, color: "#94a3b8", position: 1 },
  { name: "In Development", slug: "in-development", category: StatusCategory.STARTED, color: "#3b82f6", position: 2 },
  { name: "QC Demo Standby", slug: "qc-demo-standby", category: StatusCategory.STARTED, color: "#f59e0b", position: 3 },
  { name: "QC Demo", slug: "qc-demo", category: StatusCategory.STARTED, color: "#a855f7", position: 4 },
  { name: "Request Deploy", slug: "request-deploy", category: StatusCategory.STARTED, color: "#06b6d4", position: 5 },
  { name: "Done", slug: "done", category: StatusCategory.COMPLETED, color: "#22c55e", position: 6 },
  { name: "Delivered", slug: "delivered", category: StatusCategory.COMPLETED, color: "#10b981", position: 7 },
];
