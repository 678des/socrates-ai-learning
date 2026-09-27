import { type ReactNode } from "react";

export default function DashboardClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col bg-[#15171B] text-[#E7E8EA]">
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
