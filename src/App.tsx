import {
  ChangeEvent,
  FormEvent,
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  FileText,
  Filter,
  LayoutDashboard,
  KeyRound,
  Maximize2,
  Menu,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  addLiveActivity,
  changeLiveStatus,
  changeOwnPassword,
  clearAuth,
  createLiveCompany,
  createLiveUser,
  getAuthUser,
  getLiveCompanies,
  getLivePdfUrl,
  getLiveUsers,
  isLiveMode,
  login,
  removeLiveUser,
  resetLiveUserPassword,
  updateLiveUserAccess,
  updateLiveCompany,
  uploadLivePdf,
} from "./lib/api";
import { Document, Page, pdfjs } from "react-pdf";
import type { AuthUser, ManagedUser } from "./lib/api";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type Status =
  | "Proposed"
  | "Under discussion"
  | "Drafted"
  | "Legal review"
  | "Approval pending"
  | "Approved"
  | "Signed by client"
  | "Signed by university"
  | "Signed by both"
  | "Active"
  | "Expected renewal"
  | "Expired"
  | "Renewal"
  | "Closed"
  | "Terminated";
type CompanyFilter = "All statuses" | "Expires in 30 days" | Status;
type User = {
  name: string;
  initials: string;
  color: string;
  email: string;
  phone?: string;
};
type TrackerAccess = "view" | "edit";
type ManagedTrackerUser = User & {
  id: string;
  role: "user" | "super_admin";
  accessLevel: TrackerAccess;
  isActive: boolean;
};
type StatusEvent = {
  status: Status;
  date: string;
  effectiveTime?: string;
  recordedAt?: string;
  user: User;
};
type ActivityItem = {
  id: number | string;
  title: string;
  note: string;
  date: string;
  isoDate?: string;
  effectiveTime?: string;
  recordedAt?: string;
  user: User;
};
type AuditEvent = {
  id: string;
  entity_type: string;
  entity_id: string;
  field_name: string;
  old_value?: string | null;
  new_value?: string | null;
  changed_at: string;
  changed_by_user?: any;
};
type Company = {
  id: number | string;
  mouId?: string;
  createdAt?: string;
  name: string;
  city?: string;
  logo: string;
  logoColor: string;
  status: Status;
  effectiveDate: string;
  expiryDate: string;
  scope: string;
  deliverables?: string;
  spoc: User;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  document?: string;
  documentSize?: string;
  statusHistory: StatusEvent[];
  activities: ActivityItem[];
  auditLog?: AuditEvent[];
  documentFile?: File;
  lastUpdated: string;
  lastUpdatedAt?: string;
  lastUpdatedBy: User;
};

const users: User[] = [
  {
    name: "Arjun Mehta",
    initials: "AM",
    color: "#ec8b5d",
    email: "arjun.mehta@vextra.ai",
  },
  {
    name: "Priya Nair",
    initials: "PN",
    color: "#7566c7",
    email: "priya.nair@vextra.ai",
  },
  {
    name: "Abhinav Teja",
    initials: "AT",
    color: "#4c8eb5",
    email: "abhinav.teja@vextra.ai",
  },
];
const statuses: Status[] = [
  "Proposed",
  "Under discussion",
  "Drafted",
  "Legal review",
  "Approval pending",
  "Approved",
  "Signed by client",
  "Signed by university",
  "Signed by both",
  "Active",
  "Expected renewal",
  "Expired",
  "Renewal",
  "Closed",
  "Terminated",
];
const seedCompanies: Company[] = [
  {
    id: 1,
    name: "Aster Labs",
    city: "Bengaluru",
    logo: "AL",
    logoColor: "#1f9d87",
    status: "Active",
    effectiveDate: "Jan 18, 2025",
    expiryDate: "Jan 18, 2027",
    scope: "Strategic partnership & co-marketing",
    deliverables: "Quarterly co-marketing campaigns",
    spoc: users[0],
    contactName: "Nikhil Rao",
    contactEmail: "nikhil@asterlabs.io",
    contactPhone: "+91 98765 43120",
    document: "aster-labs-mou.pdf",
    documentSize: "1.8 MB",
    lastUpdated: "2 hours ago",
    lastUpdatedBy: users[0],
    statusHistory: [
      { status: "Proposed", date: "Dec 04, 2024", user: users[1] },
      { status: "Under discussion", date: "Dec 11, 2024", user: users[0] },
      { status: "Signed by both", date: "Jan 18, 2025", user: users[1] },
      { status: "Active", date: "Jan 18, 2025", user: users[0] },
    ],
    activities: [
      {
        id: 1,
        title: "Quarterly review call",
        note: "Reviewed co-marketing deliverables for Q2.",
        date: "May 08, 2025",
        user: users[0],
      },
    ],
    auditLog: [
      {
        id: "demo-status-1",
        entity_type: "mou",
        entity_id: "demo-aster-mou",
        field_name: "status",
        old_value: JSON.stringify({
          status: "signed_by_both",
          date: "2025-01-18",
          time: "10:00",
        }),
        new_value: JSON.stringify({
          status: "active",
          date: "2025-01-18",
          time: "14:30",
        }),
        changed_at: "2025-01-18T09:00:00Z",
        changed_by_user: users[0],
      },
      {
        id: "demo-activity-1",
        entity_type: "company",
        entity_id: "1",
        field_name: "activity",
        new_value: JSON.stringify({
          name: "Quarterly review call",
          notes: "Reviewed co-marketing deliverables for Q2.",
          date: "2025-05-08",
          time: "11:00",
        }),
        changed_at: "2025-05-08T06:00:00Z",
        changed_by_user: users[0],
      },
      {
        id: "demo-document-1",
        entity_type: "mou",
        entity_id: "demo-aster-mou",
        field_name: "signed_copy",
        new_value: JSON.stringify({ filename: "aster-labs-mou.pdf" }),
        changed_at: "2025-01-18T05:30:00Z",
        changed_by_user: users[1],
      },
    ],
  },
  {
    id: 2,
    name: "Vertex Ventures",
    city: "Mumbai",
    logo: "VV",
    logoColor: "#3b7ed0",
    status: "Legal review",
    effectiveDate: "—",
    expiryDate: "—",
    scope: "Investment & founder network access",
    spoc: users[1],
    contactName: "Kavya Shah",
    contactEmail: "kavya@vertex.vc",
    contactPhone: "+91 99887 22110",
    lastUpdated: "Yesterday",
    lastUpdatedBy: users[1],
    statusHistory: [
      { status: "Proposed", date: "Jun 02, 2025", user: users[0] },
      { status: "Under discussion", date: "Jun 11, 2025", user: users[1] },
      { status: "Drafted", date: "Jun 18, 2025", user: users[0] },
      { status: "Legal review", date: "Jun 23, 2025", user: users[1] },
    ],
    activities: [
      {
        id: 3,
        title: "Legal redlines shared",
        note: "Sent the updated liability and confidentiality clauses.",
        date: "Jun 23, 2025",
        user: users[1],
      },
    ],
  },
  {
    id: 3,
    name: "Nova Healthcare",
    city: "Hyderabad",
    logo: "NH",
    logoColor: "#d7903f",
    status: "Approval pending",
    effectiveDate: "—",
    expiryDate: "—",
    scope: "Employee wellness program",
    spoc: users[0],
    contactName: "Dr. Sahana Iyer",
    contactEmail: "sahana@novahealth.in",
    contactPhone: "+91 91234 56780",
    lastUpdated: "Jun 22, 2025",
    lastUpdatedBy: users[0],
    statusHistory: [
      { status: "Proposed", date: "May 28, 2025", user: users[0] },
      { status: "Drafted", date: "Jun 06, 2025", user: users[1] },
      { status: "Approval pending", date: "Jun 22, 2025", user: users[0] },
    ],
    activities: [
      {
        id: 4,
        title: "Finance approval requested",
        note: "Awaiting final sign-off on the annual commitment.",
        date: "Jun 22, 2025",
        user: users[0],
      },
    ],
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function formatDateForInput(value: string) {
  if (!value || value === "—") return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().slice(0, 10);
}
function todayInput() {
  return new Date().toISOString().slice(0, 10);
}
async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
}
function displayDate(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
}
function displayDateTime(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}
function displayTime(value?: string) {
  if (!value) return "—";
  const parsed = new Date(`1970-01-01T${value}`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
}
function currentTimeInput() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
}
function activityDateTime(activity: ActivityItem) {
  return `Activity date ${activity.date}${activity.effectiveTime ? ` at ${displayTime(activity.effectiveTime)}` : ""}`;
}
function TimestampBadge({
  label,
  value,
  by,
  isoDateTime,
  className = "",
}: {
  label: string;
  value: string;
  by?: string;
  isoDateTime?: string;
  className?: string;
}) {
  return (
    <span className={`timestamp-badge ${className}`.trim()}>
      <Clock3 size={11} aria-hidden="true" />
      <span>
        <b>{label}</b>
        <time dateTime={isoDateTime}>{value}</time>
      </span>
      {by && <em>by {by}</em>}
    </span>
  );
}
function ActivityTimestamp({ activity }: { activity: ActivityItem }) {
  const recordedAt = activity.recordedAt
    ? displayDateTime(activity.recordedAt)
    : activity.date;
  return (
    <div className="activity-metadata">
      <span className="activity-scheduled">{activityDateTime(activity)}</span>
      <span className="activity-meta-sep">·</span>
      <span className="activity-recorded">
        <Clock3 size={11} aria-hidden="true" />
        <span>Logged {recordedAt}</span>
        <em>by {activity.user.name}</em>
      </span>
    </div>
  );
}
function previousCalendarMonth(reference = new Date()) {
  const end = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const start = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  return {
    start,
    end,
    label: start.toLocaleDateString("en-US", { month: "long" }),
  };
}
function isTerminalStatus(status: Status) {
  return ["Expired", "Closed", "Terminated"].includes(status);
}
function hasActivityInPreviousMonth(company: Company, reference = new Date()) {
  const { start, end } = previousCalendarMonth(reference);
  const createdAt = company.createdAt ? new Date(company.createdAt) : null;
  if (createdAt && createdAt >= end) return true;
  return company.activities.some((activity) => {
    const isoDate = activity.isoDate || formatDateForInput(activity.date);
    const activityDate = isoDate ? new Date(`${isoDate}T00:00:00`) : null;
    return Boolean(activityDate && activityDate >= start && activityDate < end);
  });
}
function needsMonthlyActivityFollowUp(
  company: Company,
  reference = new Date(),
) {
  return (
    !isTerminalStatus(company.status) &&
    !hasActivityInPreviousMonth(company, reference)
  );
}
function expiresWithinThirtyDays(company: Company, reference = new Date()) {
  if (isTerminalStatus(company.status)) return false;
  const expiry = formatDateForInput(company.expiryDate);
  if (!expiry) return false;
  const today = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );
  const expiryDate = new Date(`${expiry}T00:00:00`);
  const daysUntilExpiry = Math.ceil(
    (expiryDate.getTime() - today.getTime()) / 86_400_000,
  );
  return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
}
function statusValue(value: Status) {
  return value.toLowerCase().replace(/ /g, "_");
}
function statusLabel(value: string): Status {
  const labels: Record<string, Status> = {
    proposed: "Proposed",
    under_discussion: "Under discussion",
    drafted: "Drafted",
    legal_review: "Legal review",
    approval_pending: "Approval pending",
    approved: "Approved",
    signed_by_client: "Signed by client",
    signed_by_university: "Signed by university",
    signed_by_both: "Signed by both",
    active: "Active",
    expected_renewal: "Expected renewal",
    expired: "Expired",
    renewal: "Renewal",
    closed: "Closed",
    terminated: "Terminated",
  };
  return labels[value] ?? (value as Status);
}
function apiUser(value: any, fallback = users[0]): User {
  if (!value) return fallback;
  const existing = users.find(
    (user) => user.email === value.email || user.name === value.display_name,
  );
  return (
    existing ?? {
      name: value.display_name || value.email || fallback.name,
      initials: initials(value.display_name || value.email || fallback.name),
      color: "#6874b8",
      email: value.email || fallback.email,
      phone: value.phone,
    }
  );
}

function managedApiUser(value: ManagedUser): ManagedTrackerUser {
  return {
    ...apiUser(value),
    id: value.id,
    role: value.role === "super_admin" ? "super_admin" : "user",
    accessLevel: value.access_level === "edit" ? "edit" : "view",
    isActive: value.is_active !== false,
  };
}

function demoManagedUsers(): ManagedTrackerUser[] {
  return users.map((user, index) => ({
    ...user,
    id: `demo-user-${index + 1}`,
    role: index === 0 ? "super_admin" : "user",
    accessLevel: "edit",
    isActive: true,
  }));
}
function fromApiCompany(record: any): Company {
  const mou = record.mou || {};
  const contact = record.contact_details?.[0] || {};
  const history: StatusEvent[] = (record.status_history || []).map(
    (entry: any) => ({
      status: statusLabel(entry.status),
      date: displayDate(entry.status_date || entry.changed_at),
      effectiveTime: entry.status_time,
      recordedAt: entry.changed_at,
      user: apiUser(entry.changed_by_user),
    }),
  );
  const activities: ActivityItem[] = (record.activities || []).map(
    (entry: any) => ({
      id: entry.id,
      title: entry.activity_name || "Primary activity",
      note: entry.activity_notes || entry.description,
      date: entry.activity_date
        ? displayDate(entry.activity_date)
        : displayDate(entry.created_at),
      isoDate: entry.activity_date || entry.created_at,
      effectiveTime: entry.activity_time,
      recordedAt: entry.created_at,
      user: apiUser(entry.created_by_user),
    }),
  );
  const updatedAt = mou.updated_at ? new Date(mou.updated_at) : null;
  return {
    id: record.id,
    mouId: mou.id,
    createdAt: record.created_at,
    name: record.company_name,
    city: record.city || "—",
    logo: initials(record.company_name),
    logoColor: "#6874b8",
    status: statusLabel(mou.current_status),
    effectiveDate: displayDate(mou.effective_date),
    expiryDate: displayDate(mou.expiring_date),
    scope: mou.mou_scope || "MOU scope to be defined",
    deliverables: mou.deliverables || "—",
    spoc: {
      name: mou.internal_spoc_name || "Unassigned",
      initials: initials(mou.internal_spoc_name || "UN"),
      color: "#6874b8",
      email: mou.internal_spoc_email || "—",
      phone: mou.internal_spoc_phone || "—",
    },
    contactName: contact.contact_name || "Client contact not added",
    contactEmail: contact.email || "—",
    contactPhone: contact.phone || "—",
    document: mou.pdf_url?.split("/").pop(),
    lastUpdated: updatedAt
      ? updatedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
        })
      : "—",
    lastUpdatedAt: mou.updated_at,
    lastUpdatedBy: apiUser(mou.updated_by_user || mou.created_by_user),
    statusHistory: history,
    activities,
    auditLog: record.audit_log || [],
  };
}
function statusClass(status: Status) {
  return `status status-${status.toLowerCase().replace(/ /g, "-")}`;
}
function Avatar({ user, small = false }: { user: User; small?: boolean }) {
  return (
    <span
      className={`avatar ${small ? "avatar-small" : ""}`}
      style={{ background: user.color }}
    >
      {user.initials}
    </span>
  );
}

function App() {
  const [companies, setCompanies] = useState<Company[]>(
    isLiveMode ? [] : seedCompanies,
  );
  const [adminUsers, setAdminUsers] = useState<ManagedTrackerUser[]>(
    isLiveMode ? [] : demoManagedUsers(),
  );
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [view, setView] = useState<
    "overview" | "companies" | "activities" | "admin"
  >("overview");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CompanyFilter>(
    "All statuses",
  );
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [authUser, setAuthUser] = useState(getAuthUser());
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [syncState, setSyncState] = useState<
    "demo" | "synced" | "syncing" | "error"
  >(isLiveMode ? "syncing" : "demo");
  const activeUser = authUser
    ? apiUser({ email: authUser.email, display_name: authUser.display_name })
    : users[0];
  const isSuperAdmin = !isLiveMode || authUser?.role === "super_admin";
  const canEdit = !isLiveMode || authUser?.role === "super_admin" || authUser?.access_level === "edit";
  useEffect(() => {
    if (!isLiveMode || !authUser) return;
    let cancelled = false;
    const load = async (showInitialLoading = false) => {
      if (showInitialLoading) setSyncState("syncing");
      try {
        const companyResult = await getLiveCompanies();
        const userResult = isSuperAdmin ? await getLiveUsers() : null;
        if (!cancelled) {
          setCompanies(companyResult.data.map(fromApiCompany));
          if (userResult) setAdminUsers(userResult.data.map(managedApiUser));
          setSyncState("synced");
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setSyncState("error");
      }
    };
    void load(true);
    const interval = window.setInterval(() => void load(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [authUser, isSuperAdmin]);
  const selectedCompany =
    companies.find((company) => company.id === selectedId) ?? null;
  const filteredCompanies = useMemo(
    () =>
      companies.filter(
        (company) =>
          `${company.name} ${company.city || ""} ${company.scope} ${company.spoc.name}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (statusFilter === "All statuses" ||
            (statusFilter === "Expires in 30 days"
              ? expiresWithinThirtyDays(company, new Date())
              : company.status === statusFilter)),
      ),
    [companies, query, statusFilter],
  );
  const statusCounts = useMemo(
    () =>
      Object.fromEntries(
        statuses.map((status) => [
          status,
          companies.filter((company) => company.status === status).length,
        ]),
      ) as Record<Status, number>,
    [companies],
  );
  const expiringSoonCompanies = useMemo(
    () =>
      companies.filter((company) =>
        expiresWithinThirtyDays(company, new Date()),
      ),
    [companies],
  );
  if (isLiveMode && !authUser)
    return <AuthScreen onAuthenticated={setAuthUser} />;
  async function saveCompany(company: Company) {
    if (!canEdit) return;
    if (isLiveMode) {
      try {
        if (!company.mouId && !company.documentFile)
          throw new Error("A signed MOU PDF is required to create the record.");
        const effectiveDateValue = formatDateForInput(company.effectiveDate);
        const activityDateValue = company.activities[0]?.date
          ? formatDateForInput(company.activities[0].date)
          : "";
        const updatePayload = {
          company_name: company.name,
          city: company.city,
          mou_scope: company.scope,
          deliverables: company.deliverables,
          expiring_date: formatDateForInput(company.expiryDate),
          internal_spoc_name: company.spoc.name,
          internal_spoc_email: company.spoc.email,
          internal_spoc_phone: company.spoc.phone,
          contact_name: company.contactName,
          contact_email: company.contactEmail,
          contact_phone: company.contactPhone,
        };
        const result = company.mouId
          ? await updateLiveCompany(String(company.id), updatePayload)
          : await createLiveCompany({
              ...updatePayload,
              effective_date: effectiveDateValue,
              initial_status: statusValue(company.status),
              document_filename: company.documentFile!.name,
              document_content_type:
                company.documentFile!.type || "application/pdf",
              document_base64: await fileToBase64(company.documentFile!),
        activity_name: company.activities[0]?.title || null,
        activity_notes: company.activities[0]?.note || null,
        activity_date: activityDateValue || null,
        activity_time: company.activities[0]?.effectiveTime || null,
            });
        const saved = fromApiCompany(result.data);
        if (company.mouId && company.documentFile && saved.mouId)
          await uploadLivePdf(saved.mouId, company.documentFile);
        const savedWithDocument = company.documentFile
          ? {
              ...saved,
              document: company.documentFile.name,
              documentSize: `${(company.documentFile.size / 1024 / 1024).toFixed(1)} MB`,
            }
          : saved;
        setCompanies((current) =>
          company.mouId
            ? current.map((item) =>
                item.id === company.id ? savedWithDocument : item,
              )
            : [savedWithDocument, ...current],
        );
        setSelectedId(saved.id);
        setSyncState("synced");
      } catch (error) {
        console.error(error);
        setSyncState("error");
        throw error;
      }
    } else
      setCompanies((current) =>
        company.mouId || current.some((item) => item.id === company.id)
          ? current.map((item) => (item.id === company.id ? company : item))
          : [company, ...current],
      );
    setShowAddModal(false);
    setEditingCompany(null);
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>Vextra AI</span>
        </div>
        <div className="workspace-switcher">
          <div className="workspace-icon">V</div>
          <div>
            <div className="workspace-label">Workspace</div>
            <div className="workspace-name">Vextra AI</div>
          </div>
          <ChevronDown size={15} className="muted-icon" />
        </div>
        <nav className="nav-section">
          <div className="nav-caption">Workspace</div>
          <button
            className={`nav-item ${view === "overview" ? "active" : ""}`}
            onClick={() => setView("overview")}
          >
            <LayoutDashboard size={17} /> Overview
          </button>
          <button
            className={`nav-item ${view === "companies" ? "active" : ""}`}
            onClick={() => setView("companies")}
          >
            <Users size={17} /> Companies{" "}
            <span className="nav-count">{companies.length}</span>
          </button>
          <button
            className={`nav-item ${view === "activities" ? "active" : ""}`}
            onClick={() => setView("activities")}
          >
            <Activity size={17} /> Activities
          </button>
        </nav>
        {isSuperAdmin && (
          <nav className="nav-section nav-bottom">
            <div className="nav-caption">Manage</div>
            <button
              className={`nav-item ${view === "admin" ? "active" : ""}`}
              onClick={() => setView("admin")}
            >
              <ShieldCheck size={17} /> User management
            </button>
          </nav>
        )}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <Avatar user={activeUser} />
            <div>
              <strong>{activeUser.name}</strong>
              <span>{isSuperAdmin ? "Super admin" : canEdit ? "Editor" : "Viewer"}</span>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu">
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {view === "overview"
                ? "Overview"
                : view === "companies"
                  ? "Companies"
                  : view === "activities"
                    ? "Activities"
                    : "User management"}
            </strong>
          </div>
          <div className="top-actions">
            <div className="user-switcher-wrap">
              <div className="user-switcher">
                <Avatar user={activeUser} small />
                <span>{activeUser.name}</span>
                <ShieldCheck size={14} />
              </div>
              <button
                className="logout-button"
                onClick={() => {
                  clearAuth();
                  setAuthUser(null);
                }}
              >
                Sign out
              </button>
              <button
                className="logout-button"
                onClick={() => setShowPasswordModal(true)}
              >
                Change password
              </button>
            </div>
          </div>
        </header>
        <div className="content-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow">Institutional Governance</div>
              <h1>{view === "admin" ? "Access control" : "Agreement control center"}</h1>
              <p>
                {canEdit
                  ? "Manage corporate partnerships, renewal milestones, and operational compliance."
                  : "Review institutional agreement records, ownership, and comprehensive audit trails."}
              </p>
            </div>
            {view !== "admin" && canEdit && (
              <button
                className="primary-button"
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={16} /> Add company
              </button>
            )}
          </div>
          {view === "admin" ? (
            <AdminAccessPage
              adminUsers={adminUsers}
              activeUser={authUser}
              onUsersChange={setAdminUsers}
            />
          ) : view === "activities" ? (
            <ActivityFeed companies={companies} />
          ) : (
            <>
              {view === "overview" && (
                <section
                  className="status-overview"
                  aria-label="MOU status summary"
                >
                  <div className="status-overview-header">
                    <div>
                      <h2>Portfolio health</h2>
                      <p className="overview-subtitle">
                        Real-time status distribution across active institutional agreements
                      </p>
                    </div>
                    <span className="portfolio-total-badge">
                      {companies.length} agreements
                    </span>
                  </div>
                  <div
                    className="portfolio-kpi-strip"
                    aria-label="MOU health KPIs"
                  >
                    <button
                      type="button"
                      className="portfolio-kpi portfolio-kpi-expiry"
                      aria-label="Show MOUs expiring in 30 days"
                      onClick={() => {
                        setStatusFilter("Expires in 30 days");
                        setShowFilters(true);
                        setView("companies");
                      }}
                    >
                      <div className="kpi-header">
                        <span className="kpi-label">Expiring Soon</span>
                        <span className="kpi-tag kpi-tag-amber">30d window</span>
                      </div>
                      <strong className="kpi-value">{expiringSoonCompanies.length}</strong>
                      <small className="kpi-hint">
                        {expiringSoonCompanies.length === 1
                          ? "1 agreement requires renewal review"
                          : `${expiringSoonCompanies.length} agreements need renewal decisions`}
                      </small>
                    </button>
                    {([
                      ["Active", "Live agreements in operational effect", "In Effect", "emerald"],
                      ["Expected renewal", "Agreements in renegotiation cycle", "Renewal Queue", "purple"],
                      ["Approved", "Cleared through review · ready for signing", "Ready to Sign", "blue"],
                    ] as const).map(([status, helper, tag, color]) => (
                      <button
                        type="button"
                        className={`portfolio-kpi portfolio-kpi-${statusValue(status)}`}
                        key={status}
                        aria-label={`Show ${status} MOUs`}
                        onClick={() => {
                          setStatusFilter(status);
                          setShowFilters(true);
                          setView("companies");
                        }}
                      >
                        <div className="kpi-header">
                          <span className="kpi-label">{status}</span>
                          <span className={`kpi-tag kpi-tag-${color}`}>{tag}</span>
                        </div>
                        <strong className="kpi-value">{statusCounts[status] ?? 0}</strong>
                        <small className="kpi-hint">{helper}</small>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section className="portfolio-section">
                <div className="section-header">
                  <div>
                    <h2>
                      {view === "companies" ? "All companies" : "MOU portfolio"}
                    </h2>
                    <p>Central register of institutional partnerships, designated owners, and active terms.</p>
                  </div>
                  <div className="section-meta">
                    <span
                      className={`live-dot ${syncState === "error" ? "sync-error" : ""}`}
                    ></span>
                    <span>
                      {syncState === "demo"
                        ? "Demo data"
                        : syncState === "syncing"
                          ? "Syncing…"
                          : syncState === "error"
                            ? "Sync error"
                            : "Synced just now"}
                    </span>
                  </div>
                </div>
                <div className="toolbar">
                  <div className="search-box">
                    <Search size={16} />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search companies, city, scope or SPOC"
                    />
                  </div>
                  <button
                    className={`secondary-button ${showFilters ? "selected" : ""}`}
                    onClick={() => setShowFilters((current) => !current)}
                  >
                    <Filter size={15} /> Filter
                    {statusFilter !== "All statuses" && (
                      <span className="filter-count">1</span>
                    )}
                  </button>
                  <button className="secondary-button export-button">
                    <ArrowDownToLine size={15} /> Export
                  </button>
                </div>
                {showFilters && (
                  <div className="filter-row">
                    <span>Show records</span>
                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(
                          event.target.value as CompanyFilter,
                        )
                      }
                    >
                      <option>All statuses</option>
                      <option>Expires in 30 days</option>
                      {statuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                    {statusFilter !== "All statuses" && (
                      <button onClick={() => setStatusFilter("All statuses")}>
                        Clear
                      </button>
                    )}
                  </div>
                )}
                <div className="table-shell">
                  <table>
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>City</th>
                        <th>Status</th>
                        <th>Expiry date</th>
                        <th>Internal SPOC</th>
                        <th>Last update</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompanies.map((company) => (
                        <tr
                          key={company.id}
                          onClick={() => setSelectedId(company.id)}
                        >
                          <td>
                            <div className="company-cell">
                              <div
                                className="company-logo"
                                style={{ background: company.logoColor }}
                              >
                                {company.logo}
                              </div>
                              <div>
                                <strong>{company.name}</strong>
                                <span>{company.scope}</span>
                              </div>
                            </div>
                          </td>
                          <td>{company.city || "—"}</td>
                          <td>
                            <span className={statusClass(company.status)}>
                              <i></i>
                              {company.status}
                            </span>
                          </td>
                          <td>
                            <div
                              className={`expiry-cell ${company.status === "Expired" ? "warning" : ""}`}
                            >
                              <CalendarDays size={14} />
                              <span>{company.expiryDate}</span>
                            </div>
                          </td>
                          <td>
                            <div className="spoc-cell">
                              <Avatar user={company.spoc} small />
                              <span>{company.spoc.name}</span>
                            </div>
                          </td>
                          <td>
                            <div
                              className="update-cell"
                              title={`Last updated ${company.lastUpdatedAt ? displayDateTime(company.lastUpdatedAt) : company.lastUpdated} by ${company.lastUpdatedBy.name}`}
                            >
                              <span className="update-date">
                                {company.lastUpdatedAt
                                  ? displayDateTime(company.lastUpdatedAt)
                                  : company.lastUpdated}
                              </span>
                              <span className="update-author">
                                by {company.lastUpdatedBy.name.split(" ")[0]}
                              </span>
                            </div>
                          </td>
                          <td>
                            <button
                              className="row-action"
                              aria-label={`Open details for ${company.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedId(company.id);
                              }}
                            >
                              <ArrowUpRight size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredCompanies.length === 0 && (
                    <div className="empty-state">
                      {syncState === "syncing" ? (
                        <Clock3 size={24} />
                      ) : (
                        <Search size={24} />
                      )}
                      <strong>
                        {syncState === "syncing"
                          ? "Loading agreement records…"
                          : syncState === "error"
                            ? "Could not load agreement records"
                            : "No agreements match that search"}
                      </strong>
                      <span>
                        {syncState === "syncing"
                          ? "Synchronizing the latest partnership data."
                          : syncState === "error"
                            ? "Check the API connection, then refresh the page."
                            : "Try another company, scope or status."}
                      </span>
                    </div>
                  )}
                </div>
                <div className="table-footer">
                  <span>
                    Showing <strong>{filteredCompanies.length}</strong> of{" "}
                    {companies.length} companies
                  </span>
                  <div className="pagination">
                    <button>
                      <ChevronLeft size={15} />
                    </button>
                    <button className="current-page">1</button>
                    <button>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
      {selectedCompany && (
        <CompanyDrawer
          company={selectedCompany}
          activeUser={activeUser}
          canEdit={canEdit}
          onClose={() => setSelectedId(null)}
          onEdit={() => setEditingCompany(selectedCompany)}
          onSave={(company) =>
            setCompanies((current) =>
              current.map((item) => (item.id === company.id ? company : item)),
            )
          }
        />
      )}
      {(showAddModal || editingCompany) && (
        <CompanyModal
          activeUser={activeUser}
          company={editingCompany ?? undefined}
          onClose={() => {
            setShowAddModal(false);
            setEditingCompany(null);
          }}
          onSave={saveCompany}
        />
      )}
      {showPasswordModal && (
        <PasswordChangeModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
}

function CompanyDrawer({
  company,
  activeUser,
  canEdit,
  onClose,
  onEdit,
  onSave,
}: {
  company: Company;
  activeUser: User;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSave: (company: Company) => void;
}) {
  const [tab, setTab] = useState<
    "overview" | "history" | "activities" | "audit"
  >("overview");
  const [showStatusEdit, setShowStatusEdit] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<Status>(company.status);
  const [statusDate, setStatusDate] = useState(todayInput());
  const [statusTime, setStatusTime] = useState(currentTimeInput());
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const statusSaveInFlight = useRef(false);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityNote, setActivityNote] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [activityTime, setActivityTime] = useState(currentTimeInput());
  const [documentMenuOpen, setDocumentMenuOpen] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const documentInputId = `mou-document-${String(company.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  useEffect(() => {
    return () => {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    };
  }, [previewObjectUrl]);

  function startStatusEdit() {
    if (!canEdit) return;
    setPendingStatus(company.status);
    setStatusDate(todayInput());
    setStatusTime(currentTimeInput());
    setStatusError("");
    setShowStatusEdit(true);
  }

  async function saveStatus() {
    if (!canEdit) return;
    if (statusSaveInFlight.current) return;
    if (!statusDate || !statusTime) {
      setStatusError("A status date and time are required.");
      return;
    }
    if (pendingStatus === company.status) {
      setStatusError("Choose a different status before saving.");
      return;
    }
    statusSaveInFlight.current = true;
    setSavingStatus(true);
    setStatusError("");
    try {
      if (isLiveMode && company.mouId)
        await changeLiveStatus(company.mouId, {
          status: statusValue(pendingStatus),
          status_date: statusDate,
          status_time: statusTime,
        });
      const now = new Date().toISOString();
      onSave({
        ...company,
        status: pendingStatus,
        lastUpdated: "Just now",
        lastUpdatedAt: now,
        lastUpdatedBy: activeUser,
        statusHistory: [
          ...company.statusHistory,
          {
            status: pendingStatus,
            date: formatDate(statusDate),
            effectiveTime: statusTime,
            recordedAt: now,
            user: activeUser,
          },
        ],
      });
      setShowStatusEdit(false);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Unable to save the status.";
      try {
        setStatusError(
          JSON.parse(message).detail || "Unable to save the status.",
        );
      } catch {
        setStatusError(message);
      }
    } finally {
      statusSaveInFlight.current = false;
      setSavingStatus(false);
    }
  }

  async function addActivity(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    if (!activityTitle.trim() || !activityDate || !activityTime) return;
    try {
      if (isLiveMode && typeof company.id === "string")
        await addLiveActivity(company.id, {
          activity_name: activityTitle.trim(),
          activity_notes: activityNote.trim() || null,
          activity_date: activityDate,
          activity_time: activityTime,
        });
      const newActivity = {
        id: Date.now(),
        title: activityTitle.trim(),
        note:
          activityNote.trim() ||
          "Primary activity logged from the MOU workspace.",
        date: formatDate(activityDate),
        isoDate: activityDate,
        effectiveTime: activityTime,
        recordedAt: new Date().toISOString(),
        user: activeUser,
      };
      onSave({
        ...company,
        lastUpdated: "Just now",
        lastUpdatedAt: newActivity.recordedAt,
        lastUpdatedBy: activeUser,
        activities: [newActivity, ...company.activities],
      });
      setActivityTitle("");
      setActivityNote("");
      setActivityDate("");
      setActivityTime(currentTimeInput());
    } catch (error) {
      console.error(error);
    }
  }

  async function attachPdf(event: ChangeEvent<HTMLInputElement>) {
    if (!canEdit) return;
    const file = event.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;
    setDocumentError("");
    setDocumentMenuOpen(false);
    try {
      if (isLiveMode && company.mouId) await uploadLivePdf(company.mouId, file);
      onSave({
        ...company,
        document: file.name,
        documentSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        documentFile: file,
        lastUpdated: "Just now",
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: activeUser,
      });
    } catch (error) {
      console.error(error);
      setDocumentError(
        error instanceof Error ? error.message : "Unable to upload the PDF.",
      );
    } finally {
      event.target.value = "";
    }
  }

  function closePdfPreview() {
    setPreviewUrl(null);
    setPreviewObjectUrl(null);
  }

  async function openPdfPreview() {
    setDocumentMenuOpen(false);
    setDocumentError("");
    closePdfPreview();
    try {
      if (isLiveMode && company.mouId) {
        const response = await getLivePdfUrl(company.mouId);
        setPreviewUrl(response.data.url);
        return;
      }
      if (company.documentFile) {
        const localUrl = URL.createObjectURL(company.documentFile);
        setPreviewObjectUrl(localUrl);
        setPreviewUrl(localUrl);
        return;
      }
      throw new Error("The stored PDF is not available for preview yet.");
    } catch (error) {
      console.error(error);
      setDocumentError(
        error instanceof Error ? error.message : "Unable to open the PDF.",
      );
    }
  }

  async function downloadPdf() {
    setDocumentMenuOpen(false);
    setDocumentError("");
    let localUrl = "";
    try {
      let url = "";
      if (isLiveMode && company.mouId) {
        url = (await getLivePdfUrl(company.mouId)).data.url;
      } else if (company.documentFile) {
        localUrl = URL.createObjectURL(company.documentFile);
        url = localUrl;
      } else {
        throw new Error("The stored PDF is not available for download yet.");
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error("Unable to download the PDF.");
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = company.document || "mou-signed-copy.pdf";
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      console.error(error);
      setDocumentError(
        error instanceof Error ? error.message : "Unable to download the PDF.",
      );
    } finally {
      if (localUrl) URL.revokeObjectURL(localUrl);
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-top">
          <button className="close-button" onClick={onClose}>
            <X size={19} />
          </button>
          {canEdit && <div className="drawer-actions">
            <button className="secondary-button" onClick={onEdit}>
              <Edit3 size={15} /> Edit all details
            </button>
          </div>}
        </div>
        <div className="drawer-company">
          <div
            className="company-logo large"
            style={{ background: company.logoColor }}
          >
            {company.logo}
          </div>
          <div>
            <h2>{company.name}</h2>
            <p>
              {company.city || "City not added"} · {company.contactName} ·{" "}
              {company.contactEmail}
            </p>
          </div>
        </div>
        <div className="drawer-status">
          <div>
            <span className="field-label">Current status</span>
            {showStatusEdit ? (
              <div className="status-editor">
                <select
                  autoFocus
                  value={pendingStatus}
                  onChange={(event) => {
                    setPendingStatus(event.target.value as Status);
                    setStatusError("");
                  }}
                  disabled={savingStatus}
                >
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                <div className="status-datetime-fields">
                  <label>
                    <span>Status date *</span>
                    <input
                      aria-label="Status date *"
                      required
                      type="date"
                      value={statusDate}
                      onChange={(event) => {
                        setStatusDate(event.target.value);
                        setStatusError("");
                      }}
                      disabled={savingStatus}
                    />
                  </label>
                  <label>
                    <span>Time *</span>
                    <input
                      required
                      type="time"
                      value={statusTime}
                      onChange={(event) => {
                        setStatusTime(event.target.value);
                        setStatusError("");
                      }}
                      disabled={savingStatus}
                    />
                  </label>
                </div>
                {statusError && <p className="status-error">{statusError}</p>}
                <div className="status-editor-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setStatusError("");
                      setShowStatusEdit(false);
                    }}
                    disabled={savingStatus}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button compact"
                    type="button"
                    onClick={saveStatus}
                    disabled={savingStatus}
                  >
                    {savingStatus ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ) : canEdit ? (
              <button
                className={statusClass(company.status)}
                onClick={startStatusEdit}
              >
                <i></i>
                {company.status}
                <ChevronDown size={14} />
              </button>
            ) : <span className={statusClass(company.status)}><i></i>{company.status}</span>}
          </div>
          <div className="updated-by">
            <TimestampBadge
              label="Last updated"
              value={
                company.lastUpdatedAt
                  ? displayDateTime(company.lastUpdatedAt)
                  : company.lastUpdated
              }
              isoDateTime={company.lastUpdatedAt}
              className="timestamp-header"
            />
            <div>
              <Avatar user={company.lastUpdatedBy} small />{" "}
              {company.lastUpdatedBy.name}
            </div>
          </div>
        </div>
        <div className="drawer-tabs">
          <button
            className={tab === "overview" ? "active" : ""}
            onClick={() => setTab("overview")}
          >
            Overview
          </button>
          <button
            className={tab === "history" ? "active" : ""}
            onClick={() => setTab("history")}
          >
            Status history <span>{company.statusHistory.length}</span>
          </button>
          <button
            className={tab === "activities" ? "active" : ""}
            onClick={() => setTab("activities")}
          >
            Activities <span>{company.activities.length}</span>
            {needsMonthlyActivityFollowUp(company) && (
              <em
                className="activity-follow-up-dot"
                title="No activity last month"
              />
            )}
          </button>
          <button
            className={tab === "audit" ? "active" : ""}
            onClick={() => setTab("audit")}
          >
            Audit log <span>{company.auditLog?.length || 0}</span>
          </button>
        </div>
        {tab === "overview" && (
          <div className="drawer-body">
            <div className="overview-edit-bar">
              <div>
                <strong>Company and MOU details</strong>
                <span>
                  Update company, scope, dates, SPOCs and client contacts. The
                  initial status is permanently locked.
                </span>
              </div>
              {canEdit && <button className="secondary-button" onClick={onEdit}>
                <Edit3 size={15} /> Edit details
              </button>}
            </div>
            <div className="drawer-grid">
              <InfoItem label="City" value={company.city || "—"} />
              <InfoItem
                label="Effective / signed date"
                value={company.effectiveDate}
              />
              <InfoItem
                label="Expiry date"
                value={company.expiryDate}
                warning={company.status === "Expired"}
              />
              <InfoItem
                label={`Activity in ${previousCalendarMonth().label}`}
                value={
                  hasActivityInPreviousMonth(company)
                    ? "Activity logged"
                    : "No activity last month"
                }
                sub={
                  hasActivityInPreviousMonth(company)
                    ? "Monthly activity requirement met"
                    : "Add an activity to keep this MOU on track"
                }
                warning={needsMonthlyActivityFollowUp(company)}
              />
              <InfoItem label="MOU scope" value={company.scope} full />
              <InfoItem
                label="Deliverables"
                value={company.deliverables || "—"}
                full
              />
              <InfoItem
                label="Internal SPOC"
                value={company.spoc.name}
                sub={`${company.spoc.email} · ${company.spoc.phone || "Phone not added"}`}
              />
              <InfoItem
                label="Client contact"
                value={company.contactName}
                sub={`${company.contactEmail} · ${company.contactPhone}`}
              />
            </div>
            <div className="subsection">
              <div className="subsection-title">
                <span>MOU signed copy</span>
                <span className="document-hint">PDF · Max 10 MB</span>
              </div>
              {canEdit && <input
                  id={documentInputId}
                  className="document-file-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={attachPdf}
                />}
              {company.document ? (
                <div className="document-card">
                  <div className="pdf-icon">PDF</div>
                  <div>
                    <strong>{company.document}</strong>
                    <span>
                      {company.documentSize} · Uploaded by{" "}
                      {company.lastUpdatedBy.name}
                    </span>
                  </div>
                  <div className="document-actions-wrap">
                    <button
                      type="button"
                      className="document-menu-trigger"
                      aria-label="Document actions"
                      aria-haspopup="menu"
                      aria-expanded={documentMenuOpen}
                      onClick={() => setDocumentMenuOpen((open) => !open)}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {documentMenuOpen && (
                      <div className="document-menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void openPdfPreview()}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void downloadPdf()}
                        >
                          Download
                        </button>
                        {canEdit && <label
                          className="document-menu-item"
                          htmlFor={documentInputId}
                          role="menuitem"
                        >
                          Add document
                        </label>}
                        {canEdit && <label
                          className="document-menu-item"
                          htmlFor={documentInputId}
                          role="menuitem"
                        >
                          Replace document
                        </label>}
                      </div>
                    )}
                  </div>
                </div>
              ) : canEdit ? (
                <label className="upload-empty" htmlFor={documentInputId}>
                  <UploadCloud size={20} />
                  <span>Upload the signed MOU PDF</span>
                  <b>Add document</b>
                  <small>PDF only · Max 10 MB</small>
                </label>
              ) : (
                <div className="upload-empty"><FileText size={20} /><span>No signed MOU PDF has been added.</span></div>
              )}
              {documentError && <p className="document-error">{documentError}</p>}
            </div>
            <div className="subsection">
              <div className="subsection-title">
                <span>Latest primary activity</span>
                <button
                  className="text-button"
                  onClick={() => setTab("activities")}
                >
                  View all <ArrowUpRight size={14} />
                </button>
              </div>
              <div className="mini-activity">
                <div className="activity-dot"></div>
                <div>
                  <strong>
                    {company.activities[0]?.title || "No activity yet"}
                  </strong>
                  <p>
                    {company.activities[0]?.note ||
                      "Add an activity linked to the MOU."}
                  </p>
                  {company.activities[0] ? (
                    <ActivityTimestamp activity={company.activities[0]} />
                  ) : (
                    <small>Activity date —</small>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === "history" && (
          <div className="drawer-body">
            <div className="history-intro">
              <ShieldCheck size={17} />
              <span>
                Every status change is timestamped and attributed to the admin
                who made it. The initial state is permanently preserved.
              </span>
            </div>
            <div className="timeline">
              {company.statusHistory.map((event, index) => (
                <div
                  className="timeline-item"
                  key={`${event.date}-${event.status}-${index}`}
                >
                  <div className="timeline-rail">
                    <span
                      className={
                        index === company.statusHistory.length - 1
                          ? "active"
                          : ""
                      }
                    ></span>
                    {index < company.statusHistory.length - 1 && <i></i>}
                  </div>
                  <div className="timeline-content">
                    <div>
                      <strong>{event.status}</strong>
                      {index === 0 && <em>Initial · locked</em>}
                      {index === company.statusHistory.length - 1 && (
                        <em>Current</em>
                      )}
                    </div>
                    <div className="status-history-meta">
                      <span>
                        Effective {event.date}
                        {event.effectiveTime
                          ? ` at ${displayTime(event.effectiveTime)}`
                          : ""}
                      </span>
                      <TimestampBadge
                        label="Recorded"
                        value={
                          event.recordedAt
                            ? displayDateTime(event.recordedAt)
                            : event.date
                        }
                        by={event.user.name}
                        isoDateTime={event.recordedAt}
                        className="timestamp-status"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "activities" && (
          <div className="drawer-body">
            {needsMonthlyActivityFollowUp(company) && (
              <div className="activity-monthly-alert">
                <Activity size={17} />
                <div>
                  <strong>
                    No activity in {previousCalendarMonth().label}
                  </strong>
                  <span>
                    Add this month’s MOU activity to keep the record on track.
                  </span>
                </div>
              </div>
            )}
            {canEdit && <form className="activity-form" onSubmit={addActivity}>
              <div className="form-title">
                <Activity size={17} />
                <span>Log primary activity</span>
              </div>
              <label>
                <span>Primary activity as per MOU *</span>
                <input
                  required
                  value={activityTitle}
                  onChange={(event) => setActivityTitle(event.target.value)}
                  placeholder="e.g. Training session, review meeting, workshop"
                />
              </label>
              <label>
                <span>
                  Activity details <small>optional</small>
                </span>
                <textarea
                  value={activityNote}
                  onChange={(event) => setActivityNote(event.target.value)}
                  placeholder="Describe the ongoing activity or outcome"
                  rows={3}
                ></textarea>
              </label>
              <div className="form-row">
                <div className="activity-datetime-fields">
                  <label>
                    <span>Activity date *</span>
                    <input
                      required
                      type="date"
                      value={activityDate}
                      onChange={(event) => setActivityDate(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Time *</span>
                    <input
                      required
                      type="time"
                      value={activityTime}
                      onChange={(event) => setActivityTime(event.target.value)}
                    />
                  </label>
                </div>
                <button className="primary-button compact" type="submit">
                  <Plus size={15} /> Add activity
                </button>
              </div>
            </form>}
            <div className="activity-list">
              {company.activities.map((activity) => (
                <div className="activity-item" key={activity.id}>
                  <div className="activity-marker">
                    <Activity size={14} />
                  </div>
                  <div>
                    <strong>{activity.title}</strong>
                    <p>{activity.note}</p>
                    <ActivityTimestamp activity={activity} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "audit" && <AuditLog events={company.auditLog || []} />}
      </aside>
      {previewUrl && (
        <PdfPreviewModal
          url={previewUrl}
          title={company.document || "MOU signed copy"}
          onClose={closePdfPreview}
        />
      )}
    </div>
  );
}

function PdfPreviewModal({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  const [numPages, setNumPages] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === modalRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await modalRef.current?.requestFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen mode is unavailable.", error);
    }
  }

  async function closePreview() {
    if (document.fullscreenElement === modalRef.current) {
      await document.exitFullscreen();
    }
    onClose();
  }

  return (
    <div className="pdf-preview-backdrop" onClick={() => void closePreview()}>
      <section
        className="pdf-preview-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pdf-preview-header">
          <div>
            <h2 id="pdf-preview-title">PDF preview</h2>
            <span>{title}</span>
          </div>
          <div className="pdf-preview-header-actions">
            <button
              type="button"
              className="pdf-preview-icon-button"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={() => void toggleFullscreen()}
            >
              {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
            <button
              type="button"
              className="close-button"
              aria-label="Close PDF preview"
              onClick={() => void closePreview()}
            >
              <X size={19} />
            </button>
          </div>
        </div>
        <div className="pdf-preview-body">
          <Document
            file={url}
            onLoadSuccess={({ numPages: loadedPages }) =>
              setNumPages(loadedPages)
            }
            loading={<div className="pdf-preview-state">Loading preview…</div>}
            error={
              <div className="pdf-preview-state">
                This PDF could not be rendered in the preview.
              </div>
            }
          >
            {Array.from({ length: numPages }, (_, index) => (
              <Page
                key={`pdf-page-${index + 1}`}
                pageNumber={index + 1}
                width={620}
                renderAnnotationLayer
                renderTextLayer
              />
            ))}
          </Document>
        </div>
      </section>
    </div>
  );
}

function InfoItem({
  label,
  value,
  sub,
  full,
  warning,
}: {
  label: string;
  value: string;
  sub?: string;
  full?: boolean;
  warning?: boolean;
}) {
  return (
    <div className={`info-item ${full ? "full" : ""}`}>
      <span>{label}</span>
      <strong className={warning ? "text-warning" : ""}>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function AuditLog({ events }: { events: AuditEvent[] }) {
  const fieldLabels: Record<string, string> = {
    company_name: "Company name",
    city: "City",
    mou_scope: "MOU scope",
    deliverables: "Deliverables",
    effective_date: "Effective / signed date",
    expiring_date: "Expiry date",
    internal_spoc_name: "Internal SPOC name",
    internal_spoc_email: "Internal SPOC email",
    internal_spoc_phone: "Internal SPOC phone",
    contact_name: "Client contact name",
    email: "Client contact email",
    phone: "Client contact phone",
    status: "Status",
    status_notes: "Status notes",
    activity: "Primary activity",
    signed_copy: "MOU signed copy",
  };
  function valueFromAudit(value?: string | null) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  function friendly(value: string | null | undefined, field: string) {
    const parsed = valueFromAudit(value);
    if (!parsed) return "—";
    if (field === "status") {
      if (typeof parsed === "string") return statusLabel(parsed);
      if (typeof parsed === "object" && "status" in parsed) {
        const status = statusLabel(String(parsed.status));
        const dateTime = parsed.date
          ? ` · ${formatDate(String(parsed.date))}${parsed.time ? ` at ${displayTime(String(parsed.time))}` : ""}`
          : "";
        return `${status}${dateTime}`;
      }
    }
    if (field === "activity" && typeof parsed === "object") {
      const name = String(parsed.name || parsed.title || "Activity");
      const dateTime = parsed.date
        ? ` · ${formatDate(String(parsed.date))}${parsed.time ? ` at ${displayTime(String(parsed.time))}` : ""}`
        : "";
      return `${name}${dateTime}`;
    }
    if (field === "signed_copy" && typeof parsed === "object") {
      const path = String(parsed.path || parsed.filename || "MOU signed copy");
      return path.split("/").pop() || "MOU signed copy";
    }
    return typeof parsed === "string" ? parsed : JSON.stringify(parsed);
  }

  function eventTitle(event: AuditEvent) {
    if (event.field_name === "status") return "Status changed";
    if (event.field_name === "activity") return "Primary activity recorded";
    if (event.field_name === "signed_copy")
      return event.old_value ? "Signed copy replaced" : "Signed copy uploaded";
    return `${fieldLabels[event.field_name] || event.field_name} ${
      event.old_value ? "updated" : "added"
    }`;
  }

  function eventDetail(event: AuditEvent) {
    const parsed = valueFromAudit(event.new_value);
    if (
      event.field_name === "activity" &&
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.notes === "string" &&
      parsed.notes.trim()
    )
      return parsed.notes.trim();
    return null;
  }

  function valueLabel(event: AuditEvent) {
    if (event.field_name === "status")
      return event.old_value ? "Changed to" : "Status set to";
    if (event.field_name === "activity") return "Activity";
    if (event.field_name === "signed_copy") return "Document";
    return event.old_value ? "After" : "Added";
  }

  function eventIcon(event: AuditEvent) {
    if (event.field_name === "status") return <Activity size={14} />;
    if (event.field_name === "activity") return <CalendarDays size={14} />;
    if (event.field_name === "signed_copy") return <FileText size={14} />;
    return <Edit3 size={14} />;
  }
  return (
    <div className="drawer-body">
      <div className="history-intro">
        <ShieldCheck size={17} />
        <span>
          Every editable field, document, activity and status event is retained
          with the admin and exact timestamp.
        </span>
      </div>
      {events.length === 0 ? (
        <div className="empty-state">
          <Clock3 size={22} />
          <strong>No audit events yet</strong>
          <span>New changes will appear here.</span>
        </div>
      ) : (
        <div className="audit-list">
          {events.map((event) => {
            const actor = apiUser(event.changed_by_user);
            const detail = eventDetail(event);
            return (
            <article className="audit-item" key={event.id}>
              <div className={`audit-marker audit-${event.field_name}`}>
                {eventIcon(event)}
              </div>
              <div className="audit-content">
                <div className="audit-heading">
                  <div className="audit-header-info">
                    <strong className="audit-title">{eventTitle(event)}</strong>
                    <div className="audit-actor">
                      <span>Changed by</span> <b>{actor.name}</b>
                      {actor.email && actor.email !== actor.name ? (
                        <span className="audit-actor-email"> · {actor.email}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="audit-when">
                    <Clock3 size={11} aria-hidden="true" />
                    <time dateTime={event.changed_at}>
                      {displayDateTime(event.changed_at)}
                    </time>
                  </div>
                </div>
                <div
                  className={`audit-change ${
                    event.old_value ? "has-previous" : "is-created"
                  }`}
                >
                  {event.old_value && (
                    <div className="audit-value audit-old">
                      <span>Before</span>
                      <strong>
                        {friendly(event.old_value, event.field_name)}
                      </strong>
                    </div>
                  )}
                  {event.old_value && <ArrowRight size={15} aria-hidden="true" />}
                  <div className="audit-value audit-new">
                    <span>{valueLabel(event)}</span>
                    <strong>
                      {friendly(event.new_value, event.field_name)}
                    </strong>
                  </div>
                </div>
                {detail && (
                  <div className="audit-detail">
                    <span>Details</span>
                    <p>{detail}</p>
                  </div>
                )}
              </div>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CompanyModal({
  activeUser,
  company,
  onClose,
  onSave,
}: {
  activeUser: User;
  company?: Company;
  onClose: () => void;
  onSave: (company: Company) => Promise<void> | void;
}) {
  const [name, setName] = useState(company?.name || "");
  const [city, setCity] = useState(
    company?.city === "—" ? "" : company?.city || "",
  );
  const [scope, setScope] = useState(
    company?.scope === "MOU scope to be defined" ? "" : company?.scope || "",
  );
  const [deliverables, setDeliverables] = useState(
    company?.deliverables === "—" ? "" : company?.deliverables || "",
  );
  const [status, setStatus] = useState<Status>(company?.status || "Proposed");
  const [effectiveDate, setEffectiveDate] = useState(
    formatDateForInput(company?.effectiveDate || ""),
  );
  const [expiryDate, setExpiryDate] = useState(
    formatDateForInput(company?.expiryDate || ""),
  );
  const [spocName, setSpocName] = useState(
    company?.spoc.name === "Unassigned" ? "" : company?.spoc.name || "",
  );
  const [spocEmail, setSpocEmail] = useState(
    company?.spoc.email === "—" ? "" : company?.spoc.email || "",
  );
  const [spocPhone, setSpocPhone] = useState(
    company?.spoc.phone === "—" ? "" : company?.spoc.phone || "",
  );
  const [contactName, setContactName] = useState(
    company?.contactName === "Client contact not added"
      ? ""
      : company?.contactName || "",
  );
  const [contactEmail, setContactEmail] = useState(
    company?.contactEmail === "—" ? "" : company?.contactEmail || "",
  );
  const [contactPhone, setContactPhone] = useState(
    company?.contactPhone === "—" ? "" : company?.contactPhone || "",
  );
  const [activityName, setActivityName] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [activityTime, setActivityTime] = useState(currentTimeInput());
  const [document, setDocument] = useState<File | null>(null);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaveError("");
    if (
      !name.trim() ||
      !city.trim() ||
      !scope.trim() ||
      !deliverables.trim() ||
      !effectiveDate ||
      !expiryDate ||
      !spocName.trim() ||
      !spocEmail.trim() ||
      !spocPhone.trim() ||
      !contactName.trim() ||
      !contactEmail.trim() ||
      !contactPhone.trim() ||
      (!company && !document) ||
      (activityName.trim() && (!activityDate || !activityTime))
    )
      return;
    const spoc = {
      name: spocName.trim(),
      initials: initials(spocName),
      color: "#6874b8",
      email: spocEmail.trim(),
      phone: spocPhone.trim(),
    };
    const activity = activityName.trim()
      ? [
          {
            id: Date.now(),
            title: activityName.trim(),
            note:
              activityNotes.trim() ||
              "Primary activity logged from the MOU workspace.",
            date: formatDate(activityDate),
            isoDate: activityDate,
            effectiveTime: activityTime,
            recordedAt: new Date().toISOString(),
            user: activeUser,
          },
        ]
      : company?.activities || [];
    const next: Company = {
      id: company?.id || Date.now(),
      mouId: company?.mouId,
      createdAt: company?.createdAt || new Date().toISOString(),
      name: name.trim(),
      city: city.trim(),
      logo: initials(name),
      logoColor: company?.logoColor || "#6874b8",
      status,
      effectiveDate: formatDate(effectiveDate),
      expiryDate: formatDate(expiryDate),
      scope: scope.trim(),
      deliverables: deliverables.trim(),
      spoc,
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim(),
      document: document?.name || company?.document,
      documentSize: document
        ? `${(document.size / 1024 / 1024).toFixed(1)} MB`
        : company?.documentSize,
      lastUpdated: "Just now",
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: activeUser,
      statusHistory: company?.statusHistory || [
        {
          status,
          date: displayDate(new Date().toISOString()),
          recordedAt: new Date().toISOString(),
          user: activeUser,
        },
      ],
      activities: activity,
      auditLog: company?.auditLog || [],
      documentFile: document || undefined,
    };
    setSaving(true);
    try {
      await onSave(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save this MOU record.";
      try {
        setSaveError(JSON.parse(message).detail || "Unable to save this MOU record.");
      } catch {
        setSaveError(message);
      }
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="eyebrow">
              {company ? "Edit record" : "New record"}
            </div>
            <h2>{company ? "Edit MOU record" : "Add a company"}</h2>
            <p>
              All company, MOU, contact and internal SPOC fields are required.
              The initial status and effective start date are locked after
              creation.
            </p>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-section">
            <div className="form-section-title">
              <span>Company details</span>
              <small>All fields required</small>
            </div>
            <div className="form-grid">
              <label>
                <span>Company name *</span>
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Acme Corporation"
                />
              </label>
              <label>
                <span>City *</span>
                <input
                  required
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="e.g. Bengaluru"
                />
              </label>
              <label className="wide">
                <span>MOU scope *</span>
                <textarea
                  required
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                  placeholder="What does the MOU cover?"
                  rows={2}
                ></textarea>
              </label>
              <label className="wide">
                <span>Scope deliverables *</span>
                <textarea
                  required
                  value={deliverables}
                  onChange={(event) => setDeliverables(event.target.value)}
                  placeholder="What must be delivered under the MOU?"
                  rows={2}
                ></textarea>
              </label>
              <label>
                <span>
                  {company ? "Initial status (locked)" : "Initial status *"}
                </span>
                <select
                  value={status}
                  disabled={Boolean(company)}
                  onChange={(event) => setStatus(event.target.value as Status)}
                >
                  {statuses.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                {company && (
                  <small>
                    Initial status cannot be edited. Add later statuses from
                    Status history.
                  </small>
                )}
              </label>
              {company ? (
                <label>
                  <span>Effective / signed date (locked)</span>
                  <div className="read-only-date">
                    {formatDate(effectiveDate)}
                  </div>
                  <small>
                    This creation record is permanently preserved and cannot be
                    edited.
                  </small>
                </label>
              ) : (
                <label>
                  <span>Effective / signed date *</span>
                  <input
                    required
                    type="date"
                    value={effectiveDate}
                    onChange={(event) => setEffectiveDate(event.target.value)}
                  />
                </label>
              )}
              <label>
                <span>Expiry date *</span>
                <input
                  required
                  type="date"
                  value={expiryDate}
                  onChange={(event) => setExpiryDate(event.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="form-section">
            <div className="form-section-title">
              <span>Internal SPOC</span>
              <small>Required contact person, not a login user</small>
            </div>
            <div className="form-grid">
              <label>
                <span>SPOC name *</span>
                <input
                  required
                  value={spocName}
                  onChange={(event) => setSpocName(event.target.value)}
                  placeholder="Internal SPOC full name"
                />
              </label>
              <label>
                <span>SPOC email ID *</span>
                <input
                  required
                  type="email"
                  value={spocEmail}
                  onChange={(event) => setSpocEmail(event.target.value)}
                  placeholder="spoc@yourcompany.com"
                />
              </label>
              <label>
                <span>SPOC phone number *</span>
                <input
                  required
                  value={spocPhone}
                  onChange={(event) => setSpocPhone(event.target.value)}
                  placeholder="+91 00000 00000"
                />
              </label>
            </div>
          </div>
          <div className="form-section">
            <div className="form-section-title">
              <span>Client contact</span>
              <small>Required external contact for this company</small>
            </div>
            <div className="form-grid">
              <label>
                <span>Client contact name *</span>
                <input
                  required
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder="Full name"
                />
              </label>
              <label>
                <span>Client email ID *</span>
                <input
                  required
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="name@client.com"
                />
              </label>
              <label>
                <span>Client phone number *</span>
                <input
                  required
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  placeholder="+91 00000 00000"
                />
              </label>
              <label>
                <span>MOU signed copy {!company && "*"}</span>
                <div className="file-input">
                  <input
                    required={!company && !document}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) =>
                      setDocument(event.target.files?.[0] || null)
                    }
                  />
                  <Paperclip size={15} />
                  <span>
                    {document
                      ? document.name
                      : company?.document || "Choose PDF"}
                  </span>
                </div>
              </label>
            </div>
          </div>
          {!company && (
            <div className="form-section">
              <div className="form-section-title">
                <span>Primary activity</span>
                <small>Optional; activity date is required when used</small>
              </div>
              <div className="form-grid">
                <label className="wide">
                  <span>
                    Activity description <small>optional</small>
                  </span>
                  <textarea
                    value={activityName}
                    onChange={(event) => setActivityName(event.target.value)}
                    placeholder="e.g. Orientation session conducted for the client team"
                    rows={2}
                  ></textarea>
                </label>
                <label>
                  <span>
                    Activity date {activityName.trim() ? "*" : "(optional)"}
                  </span>
                  <input
                    required={Boolean(activityName.trim())}
                    type="date"
                    value={activityDate}
                    onChange={(event) => setActivityDate(event.target.value)}
                  />
                </label>
                <label>
                  <span>Activity time {activityName.trim() ? "*" : "(optional)"}</span>
                  <input
                    required={Boolean(activityName.trim())}
                    type="time"
                    value={activityTime}
                    onChange={(event) => setActivityTime(event.target.value)}
                  />
                </label>
                <label>
                  <span>
                    Activity notes <small>optional</small>
                  </span>
                  <input
                    value={activityNotes}
                    onChange={(event) => setActivityNotes(event.target.value)}
                    placeholder="Outcome or follow-up"
                  />
                </label>
              </div>
            </div>
          )}
          <div className="audit-note">
            <ShieldCheck size={16} />
            <span>
              Saved by <strong>{activeUser.name}</strong>. Every change records
              the admin and exact timestamp.
            </span>
          </div>
          {saveError && <p className="status-error modal-save-error">{saveError}</p>}
          <div className="modal-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={saving}>
              {company ? (
                saving ? "Saving…" : "Save changes"
              ) : (
                <>
                  <Plus size={16} /> {saving ? "Creating…" : "Create company"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminAccessPage({
  adminUsers,
  activeUser,
  onUsersChange,
}: {
  adminUsers: ManagedTrackerUser[];
  activeUser: AuthUser | null;
  onUsersChange: Dispatch<SetStateAction<ManagedTrackerUser[]>>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [accessLevel, setAccessLevel] = useState<TrackerAccess>("view");
  const [resetUser, setResetUser] = useState<ManagedTrackerUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function addUser(event: FormEvent) {
    event.preventDefault();
    if (password !== passwordConfirmation) {
      setError("The temporary password and confirmation do not match.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    const loginEmail = email.trim().toLowerCase();
    const userName = displayName.trim();
    try {
      if (isLiveMode) {
        const result = await createLiveUser({ email: loginEmail, display_name: userName, password, access_level: accessLevel });
        onUsersChange((current) => [...current, managedApiUser(result.data)].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        onUsersChange((current) => [...current, {
          ...apiUser({ email: loginEmail, display_name: userName }), id: `demo-user-${Date.now()}`, role: "user" as const, accessLevel, isActive: true,
        }].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setDisplayName(""); setEmail(""); setPassword(""); setPasswordConfirmation(""); setAccessLevel("view");
      setMessage(`${userName} was added as an ${accessLevel === "edit" ? "editor" : "viewer"}. They sign in with ${loginEmail}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to add user.");
    } finally { setSaving(false); }
  }

  async function changeAccess(target: ManagedTrackerUser, nextAccess: TrackerAccess) {
    setError(""); setMessage("");
    try {
      if (isLiveMode) await updateLiveUserAccess(target.id, nextAccess);
      onUsersChange((current) => current.map((user) => user.id === target.id ? { ...user, accessLevel: nextAccess } : user));
      setMessage(`${target.name} now has ${nextAccess} access.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update access.");
    }
  }

  async function removeUser(target: ManagedTrackerUser) {
    if (!window.confirm(`Remove ${target.name}'s access to the tracker? Their audit history will be kept.`)) return;
    setError(""); setMessage("");
    try {
      if (isLiveMode) await removeLiveUser(target.id);
      onUsersChange((current) => current.filter((user) => user.id !== target.id));
      setMessage(`${target.name}'s tracker access was removed.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to remove this user.");
    }
  }

  async function submitPasswordReset(event: FormEvent) {
    event.preventDefault();
    if (!resetUser) return;
    setSaving(true); setError(""); setMessage("");
    try {
      if (isLiveMode) await resetLiveUserPassword(resetUser.id, resetPassword);
      setResetUser(null); setResetPassword("");
      setMessage(`Password changed for ${resetUser.name}. Share it securely.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to reset the password.");
    } finally { setSaving(false); }
  }

  return (
    <section className="activity-page">
      <div className="section-header">
        <div>
          <h2>User management</h2>
          <p>Add tracker users, choose their access, or remove access safely.</p>
        </div>
        <div className="section-meta">
          <span className="live-dot"></span> Database-backed
        </div>
      </div>
      <div className="admin-access-card">
        <div className="history-intro">
          <ShieldCheck size={17} />
          <span>
            Viewers can inspect records and documents. Editors can also create,
            update and log tracker activity. Removed accounts keep audit history.
          </span>
        </div>
        <form className="user-management-form" onSubmit={addUser}>
          <strong><UserPlus size={15} /> Add tracker user</strong>
          <div className="user-form-grid">
            <label>Full name<input required autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
            <label>Login email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Temporary password<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label>Confirm temporary password<input required minLength={8} type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /></label>
            <label>Access<select value={accessLevel} onChange={(event) => setAccessLevel(event.target.value as TrackerAccess)}><option value="view">View only</option><option value="edit">Edit tracker</option></select></label>
          </div>
          <small className="user-login-hint">The user must sign in with the login email address above, not their display name.</small>
          <button className="primary-button compact" disabled={saving}><UserPlus size={15} /> Add user</button>
        </form>
        {message && <p className="user-management-message">{message}</p>}
        {error && <p className="status-error">{error}</p>}
        <div className="admin-user-list">
          {adminUsers.map((user) => (
            <div className="admin-user-row managed-user-row" key={user.id}>
              <Avatar user={user} />
              <div>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </div>
              <span className="admin-role">
                {user.role === "super_admin" ? "Super admin" : user.accessLevel === "edit" ? "Editor" : "Viewer"}
              </span>
              {user.role !== "super_admin" && (
                <div className="user-row-actions">
                  <select aria-label={`${user.name} access`} value={user.accessLevel} onChange={(event) => void changeAccess(user, event.target.value as TrackerAccess)}>
                    <option value="view">View</option><option value="edit">Edit</option>
                  </select>
                  <button type="button" className="secondary-button" onClick={() => setResetUser(user)}><KeyRound size={14} /> Password</button>
                  <button type="button" className="danger-button" onClick={() => void removeUser(user)} aria-label={`Remove ${user.name}`}><Trash2 size={14} /> Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {resetUser && (
        <div className="modal-backdrop" onClick={() => setResetUser(null)}>
          <form className="modal password-modal" onSubmit={submitPasswordReset} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" onClick={() => setResetUser(null)}><X size={18} /></button>
            <div className="eyebrow">Super-admin action</div><h2>Change password</h2>
            <p>Set a new password for {resetUser.name}. The previous password stops working immediately.</p>
            <label>New password<input autoFocus required minLength={8} type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} /></label>
            <div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setResetUser(null)}>Cancel</button><button className="primary-button" disabled={saving}>Save password</button></div>
          </form>
        </div>
      )}
    </section>
  );
}

function PasswordChangeModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) { setError("The new password and confirmation do not match."); return; }
    setSaving(true); setError("");
    try {
      if (isLiveMode) await changeOwnPassword(currentPassword, newPassword);
      setComplete(true);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to change your password."); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onClick={onClose}><form className="modal password-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
    <button type="button" className="close-button" onClick={onClose}><X size={18} /></button>
    <div className="eyebrow">Account security</div><h2>Change my password</h2>
    <p>Use at least eight characters. Your new password takes effect immediately.</p>
    {complete ? <p className="user-management-message">Password updated successfully.</p> : <><label>Current password<input autoFocus required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>New password<input required minLength={8} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label>Confirm new password<input required minLength={8} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>{error && <p className="status-error">{error}</p>}</>}
    <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>{complete ? "Close" : "Cancel"}</button>{!complete && <button className="primary-button" disabled={saving}>Save password</button>}</div>
  </form></div>;
}
function ActivityFeed({ companies }: { companies: Company[] }) {
  const allActivities = companies
    .flatMap((company) =>
      company.activities.map((activity) => ({
        ...activity,
        company: company.name,
      })),
    )
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));
  return (
    <section className="activity-page">
      <div className="section-header">
        <div>
          <h2>Activity log</h2>
          <p>Primary activities performed under each MOU.</p>
        </div>
        <div className="section-meta">
          <span className="live-dot"></span> Live audit trail
        </div>
      </div>
      <div className="activity-page-list">
        {allActivities.map((activity) => (
          <div className="activity-page-item" key={activity.id}>
            <div className="activity-marker large-marker">
              <Activity size={15} />
            </div>
            <div className="activity-page-content">
              <div>
                <strong>{activity.title}</strong>
                <span className="activity-company">{activity.company}</span>
              </div>
              <p>{activity.note}</p>
              <ActivityTimestamp activity={activity} />
            </div>
            <ArrowUpRight size={16} className="activity-arrow" />
          </div>
        ))}
      </div>
    </section>
  );
}
function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: NonNullable<ReturnType<typeof getAuthUser>>) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function signIn(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      onAuthenticated(await login(email, password));
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Unable to sign in",
      );
    }
    setLoading(false);
  }
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand auth-brand">
          <div className="brand-mark">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>Vextra AI</span>
        </div>
        <div className="auth-icon">
          <ShieldCheck size={21} />
        </div>
        <div className="eyebrow">Private workspace</div>
        <h1>Welcome back</h1>
        <p>Sign in as a workspace admin to manage MOU records.</p>
        <form onSubmit={signIn}>
          <label>
            Email address
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@vextra.ai"
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="primary-button auth-submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"} <ArrowUpRight size={15} />
          </button>
        </form>
        <small>Only invited workspace admins can access this tracker.</small>
      </div>
    </div>
  );
}
export default App;
