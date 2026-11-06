import { useState } from "react";
import { Navigate } from "react-router-dom";
import { can } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PageHeader } from "../../components/ui";
import { MasterTabs } from "./components/MasterTabs";
import { BidangTab } from "./tabs/BidangTab";
import { IndeksTab } from "./tabs/IndeksTab";
import { StrukturTab } from "./tabs/StrukturTab";
import type { MasterTab } from "./types";

/**
 * Master Data shell — tab navigation only.
 * Domain logic lives in tabs/* so each area is readable in isolation.
 *
 * Structure:
 *   pages/master/
 *     MasterPage.tsx       → shell + tabs
 *     types.ts             → shared DTOs
 *     constants.ts         → empty form defaults
 *     validation.ts        → kode/kategori rules
 *     components/          → shared UI pieces
 *     tabs/
 *       BidangTab.tsx
 *       IndeksTab.tsx      → list indeks + sub indeks
 *       StrukturTab.tsx    → kategori & kelompok (Super Admin)
 */
export function MasterPage() {
  const { user } = useAuth();
  const allowed = can(user, "master.manage");
  const isSuperAdmin = user?.roleName === "Super Admin";
  const [tab, setTab] = useState<MasterTab>("bidang");

  if (!allowed) return <Navigate to="/" replace />;

  return (
    <div>
      <PageHeader title="Master Data" subtitle="Lihat dan kelola Master Data" />
      <MasterTabs tab={tab} canManageStruktur={isSuperAdmin} onChange={setTab} />

      {tab === "bidang" && <BidangTab canManage={isSuperAdmin} />}
      {tab === "kode" && <IndeksTab canManage={isSuperAdmin} />}
      {tab === "struktur" && isSuperAdmin && <StrukturTab />}
    </div>
  );
}
