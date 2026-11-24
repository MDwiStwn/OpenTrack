import { PrismaClient, Priority, StatusCategory, CycleStatus, WorkspaceRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

export const DEFAULT_STATUSES = [
  { name: "Backlog", slug: "backlog", category: StatusCategory.BACKLOG, color: "#71717a", position: 0 },
  { name: "Select For Sprint", slug: "select-for-sprint", category: StatusCategory.UNSTARTED, color: "#94a3b8", position: 1 },
  { name: "In Development", slug: "in-development", category: StatusCategory.STARTED, color: "#3b82f6", position: 2 },
  { name: "QC Demo Standby", slug: "qc-demo-standby", category: StatusCategory.STARTED, color: "#f59e0b", position: 3 },
  { name: "QC Demo", slug: "qc-demo", category: StatusCategory.STARTED, color: "#a855f7", position: 4 },
  { name: "Request Deploy", slug: "request-deploy", category: StatusCategory.STARTED, color: "#06b6d4", position: 5 },
  { name: "Done", slug: "done", category: StatusCategory.COMPLETED, color: "#22c55e", position: 6 },
  { name: "Delivered", slug: "delivered", category: StatusCategory.COMPLETED, color: "#10b981", position: 7 },
];

async function main() {
  const existingWorkspace = await prisma.workspace.findUnique({
    where: { slug: "opentrack-eng" },
  });

  if (existingWorkspace) {
    console.log("Database already seeded. Skipping...");
    return;
  }

  console.log("Seeding OpenTrack database...");

  const passwordHash = await bcrypt.hash("password123", 10);

  const [admin, dev1, dev2, qc1] = await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@opentrack.local",
        name: "Raka Pratama (Tech Lead)",
        passwordHash,
        avatarColor: "#6366f1",
      },
    }),
    prisma.user.create({
      data: {
        email: "dev.budi@opentrack.local",
        name: "Budi Santoso",
        passwordHash,
        avatarColor: "#3b82f6",
      },
    }),
    prisma.user.create({
      data: {
        email: "dev.siti@opentrack.local",
        name: "Siti Rahma",
        passwordHash,
        avatarColor: "#10b981",
      },
    }),
    prisma.user.create({
      data: {
        email: "qc.dina@opentrack.local",
        name: "Dina Kartika (QC)",
        passwordHash,
        avatarColor: "#f59e0b",
      },
    }),
  ]);

  const workspace = await prisma.workspace.create({
    data: {
      name: "OpenTrack Engineering",
      slug: "opentrack-eng",
      members: {
        create: [
          { userId: admin.id, role: WorkspaceRole.OWNER },
          { userId: dev1.id, role: WorkspaceRole.ADMIN },
          { userId: dev2.id, role: WorkspaceRole.MEMBER },
          { userId: qc1.id, role: WorkspaceRole.MEMBER },
        ],
      },
    },
  });

  // Create default 8-stage workflow statuses
  const statuses: Record<string, string> = {};
  for (const s of DEFAULT_STATUSES) {
    const created = await prisma.workflowStatus.create({
      data: { ...s, workspaceId: workspace.id },
    });
    statuses[s.slug] = created.id;
  }

  // Create Projects
  const [projSdg, projMob, projApi] = await Promise.all([
    prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: "Siakad Digital Core",
        key: "SDG",
        description: "Platform core web & akademik",
        color: "#6366f1",
        issueCounter: 6,
      },
    }),
    prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: "Mobile App",
        key: "MOB",
        description: "Aplikasi mobile Android & iOS",
        color: "#10b981",
        issueCounter: 4,
      },
    }),
    prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: "Platform API",
        key: "API",
        description: "Gateway & microservice API",
        color: "#f59e0b",
        issueCounter: 2,
      },
    }),
  ]);

  // Create Labels
  const [lblCore, lblAcademic, lblCbt, lblBug, lblMobile] = await Promise.all([
    prisma.label.create({ data: { workspaceId: workspace.id, name: "Platform Core", color: "#6366f1" } }),
    prisma.label.create({ data: { workspaceId: workspace.id, name: "Academic", color: "#3b82f6" } }),
    prisma.label.create({ data: { workspaceId: workspace.id, name: "Exam/CBT", color: "#a855f7" } }),
    prisma.label.create({ data: { workspaceId: workspace.id, name: "Bug", color: "#ef4444" } }),
    prisma.label.create({ data: { workspaceId: workspace.id, name: "Mobile", color: "#10b981" } }),
  ]);

  // Create Cycles
  const now = new Date();
  const sprintStart = new Date(now.getTime() - 5 * 86400000);
  const sprintEnd = new Date(now.getTime() + 9 * 86400000);
  const nextStart = new Date(now.getTime() + 10 * 86400000);
  const nextEnd = new Date(now.getTime() + 24 * 86400000);

  const activeCycle = await prisma.cycle.create({
    data: {
      workspaceId: workspace.id,
      name: "Sprint 24 — Q4 Core & CBT",
      description: "Fokus stabilisasi modul Exam/CBT, antrean QC Mobile, dan integrasi Nexora.",
      startDate: sprintStart,
      endDate: sprintEnd,
      status: CycleStatus.ACTIVE,
    },
  });

  await prisma.cycle.create({
    data: {
      workspaceId: workspace.id,
      name: "Sprint 25 — Reporting & Scale",
      description: "Optimasi query akademik dan peningkatan performa API.",
      startDate: nextStart,
      endDate: nextEnd,
      status: CycleStatus.UPCOMING,
    },
  });

  // Sample Issues
  const issueSpecs = [
    {
      projectId: projSdg.id,
      number: 1,
      identifier: "SDG-1",
      title: "Sinkronisasi nilai ujian CBT ke transkrip akademik",
      description: "## Konteks\nNilai dari modul **Exam/CBT** perlu otomatis tersinkronisasi ke tabel transkrip setelah ujian ditutup.\n\n### Acceptance Criteria\n- [x] Validasi bobot nilai\n- [ ] Retry otomatis jika timeout",
      statusId: statuses["in-development"],
      priority: Priority.URGENT,
      estimate: 5,
      assigneeId: dev1.id,
      cycleId: activeCycle.id,
      labelIds: [lblCbt.id, lblAcademic.id],
    },
    {
      projectId: projSdg.id,
      number: 2,
      identifier: "SDG-2",
      title: "Fix race condition saat submit jawaban CBT bersamaan",
      description: "Terjadi duplikasi record jawaban ketika >500 siswa submit pada detik terakhir.",
      statusId: statuses["qc-demo-standby"],
      priority: Priority.URGENT,
      estimate: 3,
      assigneeId: dev2.id,
      cycleId: activeCycle.id,
      labelIds: [lblCbt.id, lblBug.id],
    },
    {
      projectId: projSdg.id,
      number: 3,
      identifier: "SDG-3",
      title: "Implementasi Role Permission Matrix untuk Admin Fakultas",
      description: "Memisahkan hak akses admin universitas dan admin fakultas.",
      statusId: statuses["select-for-sprint"],
      priority: Priority.HIGH,
      estimate: 5,
      assigneeId: dev1.id,
      cycleId: activeCycle.id,
      labelIds: [lblCore.id],
    },
    {
      projectId: projSdg.id,
      number: 4,
      identifier: "SDG-4",
      title: "Export rekap absensi dosen ke format XLSX",
      description: "Menambahkan tombol export XLSX pada halaman monitoring kehadiran.",
      statusId: statuses["done"],
      priority: Priority.MEDIUM,
      estimate: 2,
      assigneeId: dev2.id,
      cycleId: activeCycle.id,
      labelIds: [lblAcademic.id],
    },
    {
      projectId: projSdg.id,
      number: 5,
      identifier: "SDG-5",
      title: "Audit log perubahan KRS mahasiswa",
      description: "Mencatat setiap tambah/hapus mata kuliah pada masa KRS.",
      statusId: statuses["delivered"],
      priority: Priority.MEDIUM,
      estimate: 3,
      assigneeId: dev1.id,
      cycleId: activeCycle.id,
      labelIds: [lblAcademic.id, lblCore.id],
    },
    {
      projectId: projSdg.id,
      number: 6,
      identifier: "SDG-6",
      title: "Redesign halaman jadwal kuliah semester baru",
      description: "Peningkatan keterbacaan tabel jadwal di layar kecil.",
      statusId: statuses["backlog"],
      priority: Priority.LOW,
      estimate: 3,
      assigneeId: null,
      cycleId: null,
      labelIds: [lblAcademic.id],
    },
    {
      projectId: projMob.id,
      number: 1,
      identifier: "MOB-1",
      title: "Notifikasi push jadwal ujian H-1 di Android & iOS",
      description: "Mengirim FCM push notification 24 jam sebelum jadwal ujian CBT dimulai.",
      statusId: statuses["qc-demo"],
      priority: Priority.HIGH,
      estimate: 5,
      assigneeId: dev2.id,
      cycleId: activeCycle.id,
      labelIds: [lblMobile.id, lblCbt.id],
    },
    {
      projectId: projMob.id,
      number: 2,
      identifier: "MOB-2",
      title: "Fix crash saat buka lampiran PDF di iOS 18",
      description: "WebView PDF viewer force close pada perangkat iOS 18.x.",
      statusId: statuses["qc-demo-standby"],
      priority: Priority.URGENT,
      estimate: 3,
      assigneeId: dev2.id,
      cycleId: activeCycle.id,
      labelIds: [lblMobile.id, lblBug.id],
    },
    {
      projectId: projMob.id,
      number: 3,
      identifier: "MOB-3",
      title: "Mode offline untuk kartu rencana studi (KRS)",
      description: "Cache jadwal kuliah agar tetap bisa diakses tanpa koneksi internet.",
      statusId: statuses["request-deploy"],
      priority: Priority.MEDIUM,
      estimate: 5,
      assigneeId: dev1.id,
      cycleId: activeCycle.id,
      labelIds: [lblMobile.id, lblAcademic.id],
    },
    {
      projectId: projMob.id,
      number: 4,
      identifier: "MOB-4",
      title: "Biometric login (FaceID / Fingerprint)",
      description: "Opsi login cepat menggunakan biometrik perangkat.",
      statusId: statuses["in-development"],
      priority: Priority.HIGH,
      estimate: 3,
      assigneeId: dev2.id,
      cycleId: activeCycle.id,
      labelIds: [lblMobile.id, lblCore.id],
    },
    {
      projectId: projApi.id,
      number: 1,
      identifier: "API-1",
      title: "Rate limiting per API Key untuk endpoint publik",
      description: "Mencegah lonjakan traffic dari integrasi eksternal.",
      statusId: statuses["request-deploy"],
      priority: Priority.HIGH,
      estimate: 3,
      assigneeId: admin.id,
      cycleId: activeCycle.id,
      labelIds: [lblCore.id],
    },
    {
      projectId: projApi.id,
      number: 2,
      identifier: "API-2",
      title: "Webhook retry queue dengan exponential backoff",
      description: "Menjamin pengiriman event ke Nexora jika target sempat down.",
      statusId: statuses["done"],
      priority: Priority.MEDIUM,
      estimate: 5,
      assigneeId: admin.id,
      cycleId: activeCycle.id,
      labelIds: [lblCore.id],
    },
  ];

  let firstIssueId: string | null = null;
  for (let i = 0; i < issueSpecs.length; i++) {
    const spec = issueSpecs[i];
    const created = await prisma.issue.create({
      data: {
        workspaceId: workspace.id,
        projectId: spec.projectId,
        number: spec.number,
        identifier: spec.identifier,
        title: spec.title,
        description: spec.description,
        statusId: spec.statusId,
        priority: spec.priority,
        estimate: spec.estimate,
        assigneeId: spec.assigneeId,
        reporterId: admin.id,
        cycleId: spec.cycleId,
        sortOrder: i * 1000,
        labels: {
          create: spec.labelIds.map((labelId) => ({ labelId })),
        },
        activities: {
          create: {
            actorId: admin.id,
            actorName: admin.name,
            action: "CREATED",
            newValue: spec.identifier,
          },
        },
      },
    });
    if (i === 0) firstIssueId = created.id;
  }

  // Create a sample sub-issue for SDG-1
  if (firstIssueId) {
    await prisma.project.update({
      where: { id: projSdg.id },
      data: { issueCounter: 7 },
    });
    await prisma.issue.create({
      data: {
        workspaceId: workspace.id,
        projectId: projSdg.id,
        number: 7,
        identifier: "SDG-7",
        title: "Buat unit test validasi bobot nilai CBT",
        description: "Cakupan test minimal untuk nilai nol, desimal, dan remedial.",
        statusId: statuses["done"],
        priority: Priority.MEDIUM,
        estimate: 1,
        assigneeId: dev1.id,
        reporterId: admin.id,
        cycleId: activeCycle.id,
        parentId: firstIssueId,
        sortOrder: 13000,
        activities: {
          create: {
            actorId: dev1.id,
            actorName: dev1.name,
            action: "CREATED",
            newValue: "SDG-7",
          },
        },
      },
    });
  }

  // Create Saved Views (Mobile Dev, QC Mobile, Web Dev & API, QC Web & API)
  const devStatusIds = [statuses["select-for-sprint"], statuses["in-development"]];
  const qcStatusIds = [statuses["qc-demo-standby"], statuses["qc-demo"], statuses["request-deploy"]];

  await prisma.savedView.createMany({
    data: [
      {
        workspaceId: workspace.id,
        ownerId: dev2.id,
        name: "Mobile Development",
        description: "Papan kerja pengerjaan fitur & perbaikan aplikasi Mobile (Android & iOS).",
        isShared: true,
        filters: { projectIds: [projMob.id], statusIds: devStatusIds },
        displayConfig: { viewMode: "kanban", swimlane: "priority" },
      },
      {
        workspaceId: workspace.id,
        ownerId: qc1.id,
        name: "QC Mobile",
        description: "Antrean tiket modul Mobile yang siap diuji (QC Demo Standby, QC Demo, Request Deploy).",
        isShared: true,
        filters: { projectIds: [projMob.id], statusIds: qcStatusIds },
        displayConfig: { viewMode: "kanban", swimlane: "priority" },
      },
      {
        workspaceId: workspace.id,
        ownerId: dev1.id,
        name: "Web Development & API",
        description: "Papan kerja pengerjaan fitur & perbaikan Web (SDG) dan Backend API.",
        isShared: true,
        filters: { projectIds: [projSdg.id, projApi.id], statusIds: devStatusIds },
        displayConfig: { viewMode: "kanban", swimlane: "priority" },
      },
      {
        workspaceId: workspace.id,
        ownerId: qc1.id,
        name: "QC Web & API",
        description: "Antrean pengujian Quality Control untuk modul Web (SDG) dan Backend API.",
        isShared: true,
        filters: { projectIds: [projSdg.id, projApi.id], statusIds: qcStatusIds },
        displayConfig: { viewMode: "kanban", swimlane: "priority" },
      },
    ],
  });

  // Create a demo API key for Nexora integration
  const rawDemoKey = "ot_live_nexora_demo_key_2026_opentrack";
  const keyHash = crypto.createHash("sha256").update(rawDemoKey).digest("hex");
  await prisma.apiKey.create({
    data: {
      workspaceId: workspace.id,
      name: "Nexora Internal Integration (Demo)",
      keyPrefix: rawDemoKey.slice(0, 14),
      keyHash,
      createdById: admin.id,
    },
  });

  console.log("Seed completed!");
  console.log("Demo Login: admin@opentrack.local / password123");
  console.log("Demo API Key:", rawDemoKey);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
