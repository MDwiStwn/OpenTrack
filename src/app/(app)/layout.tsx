import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import { AppSidebar } from "@/components/AppSidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) {
    redirect("/login");
  }

  return (
    <WorkspaceProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:text-xs focus:font-medium"
      >
        Langsung ke konten utama
      </a>
      <div className="min-h-dvh flex flex-col md:flex-row bg-sidebar text-foreground">
        <Suspense fallback={<aside className="hidden md:block w-60 shrink-0 bg-sidebar border-r border-sidebar-border" />}>
          <AppSidebar />
        </Suspense>
        <main
          id="main-content"
          className="flex-1 min-w-0 flex flex-col min-h-[calc(100dvh-48px)] md:min-h-[calc(100dvh-12px)] md:my-1.5 md:mr-1.5 md:rounded-lg md:border md:border-border bg-background overflow-x-hidden"
        >
          {children}
        </main>
      </div>
    </WorkspaceProvider>
  );
}
