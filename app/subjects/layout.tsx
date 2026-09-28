// app/dashboard/layout.tsx
//import { getSubjects } from "@/lib/supabase/queries/subjects";
import DashboardClientLayout from "./_components/DashboardClientLayout";
//import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}
