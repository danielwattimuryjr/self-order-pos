"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock3,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  ScrollText,
  ShoppingBag,
  SlidersHorizontal,
  Table2,
  TicketPercent,
  UserRound,
  UsersRound,
  UtensilsCrossed,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

type SignOutAction = () => Promise<void>;
type AppRole = "ADMIN" | "STAFF";

type NavigationLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
};

type NavigationGroup = { label: string; links: NavigationLink[] };

const adminNavigation: NavigationGroup[] = [
  {
    label: "Ringkasan",
    links: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Penjualan",
    links: [
      { href: "/admin/orders", label: "Pesanan", icon: ShoppingBag },
      { href: "/admin/transactions", label: "Transaksi", icon: ReceiptText },
    ],
  },
  {
    label: "Data Master",
    links: [
      { href: "/admin/tables", label: "Meja", icon: Table2 },
      {
        href: "/admin/catalog",
        label: "Kategori & Menu",
        icon: UtensilsCrossed,
      },
      {
        href: "/admin/templates",
        label: "Template Menu",
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    label: "Promosi",
    links: [{ href: "/admin/vouchers", label: "Voucher", icon: TicketPercent }],
  },
  {
    label: "Pengaturan",
    links: [
      { href: "/admin/settings", label: "Jam Operasional", icon: Clock3 },
      { href: "/admin/staff", label: "Staf", icon: UsersRound },
      { href: "/admin/audit-logs", label: "Audit Log", icon: ScrollText },
    ],
  },
];

const staffNavigation: NavigationGroup[] = [
  {
    label: "Operasional",
    links: [
      { href: "/staff/queue", label: "Antrean Pesanan", icon: ClipboardList },
      { href: "/staff/history", label: "Riwayat Pesanan", icon: History },
      { href: "/staff/transactions", label: "Transaksi", icon: ReceiptText },
      { href: "/staff/profile", label: "Profil Akun", icon: UserRound },
    ],
  },
];

export function ManagementShell({
  role,
  staffName,
  signOutAction,
  children,
}: {
  role: AppRole;
  staffName: string;
  signOutAction: SignOutAction;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navigation = role === "ADMIN" ? adminNavigation : staffNavigation;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link
            href={role === "ADMIN" ? "/admin/dashboard" : "/staff/queue"}
            className="truncate px-2 py-1 font-semibold"
          >
            QR Restaurant
          </Link>
          <p className="truncate px-2 text-sm text-sidebar-foreground/70">
            {staffName} · {role === "ADMIN" ? "Admin" : "Staff"}
          </p>
        </SidebarHeader>
        <SidebarContent>
          {navigation.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.links.map(({ href, label, icon: Icon, disabled }) => (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        asChild={!disabled}
                        isActive={
                          !disabled &&
                          (pathname === href || pathname.startsWith(`${href}/`))
                        }
                        disabled={disabled}
                        tooltip={label}
                      >
                        {disabled ? (
                          <>
                            <Icon />
                            <span>{label}</span>
                          </>
                        ) : (
                          <Link href={href}>
                            <Icon />
                            <span>{label}</span>
                          </Link>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <form action={signOutAction}>
                <SidebarMenuButton type="submit" tooltip="Keluar">
                  <LogOut />
                  <span>Keluar</span>
                </SidebarMenuButton>
              </form>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
          <SidebarTrigger aria-label="Buka atau tutup navigasi" />
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm font-medium">
            {role === "ADMIN" ? "Admin" : "Staff"}
          </span>
        </header>
        <div className="min-w-0 flex-1 p-4 md:p-8">{children}</div>
      </div>
    </SidebarProvider>
  );
}
