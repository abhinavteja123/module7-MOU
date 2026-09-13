import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  FileText,
  Filter,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import {
  addLiveActivity,
  changeLiveStatus,
  clearAuth,
  createLiveCompany,
  getAuthUser,
  getLiveCompanies,
  getLiveUsers,
  isLiveMode,
  login,
  updateLiveCompany,
  uploadLivePdf,
} from "./lib/api";

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
type User = {
  name: string;
  initials: string;
  color: string;
  email: string;
  phone?: string;
};
type StatusEvent = { status: Status; date: string; user: User };
type ActivityItem = {
  id: number | string;
  title: string;
  note: string;
  date: string;
  isoDate?: string;
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
const statusGroups: { label: string; statuses: Status[] }[] = [
  {
    label: "Preparation",
    statuses: ["Proposed", "Under discussion", "Drafted"],
  },
  {
    label: "Review & approval",
    statuses: ["Legal review", "Approval pending", "Approved"],
  },
  {
    label: "Signing",
    statuses: ["Signed by client", "Signed by university", "Signed by both"],
  },
  {
    label: "Lifecycle",
    statuses: [
      "Active",
      "Expected renewal",
      "Renewal",
      "Expired",
      "Closed",
      "Terminated",
    ],
  },
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
function fromApiCompany(record: any): Company {
  const mou = record.mou || {};
  const contact = record.contact_details?.[0] || {};
  const history: StatusEvent[] = (record.status_history || []).map(
    (entry: any) => ({
      status: statusLabel(entry.status),
      date: displayDate(entry.status_date || entry.changed_at),
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
  const [adminUsers, setAdminUsers] = useState<User[]>(isLiveMode ? [] : users);
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [view, setView] = useState<
    "overview" | "companies" | "activities" | "admin"
  >("overview");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All statuses" | Status>(
    "All statuses",
  );
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [authUser, setAuthUser] = useState(getAuthUser());
  const [syncState, setSyncState] = useState<
    "demo" | "synced" | "syncing" | "error"
  >(isLiveMode ? "syncing" : "demo");
  const activeUser = authUser
    ? apiUser({ email: authUser.email, display_name: authUser.display_name })
    : users[0];
  useEffect(() => {
    if (!isLiveMode || !authUser) return;
    let cancelled = false;
    const load = async (showInitialLoading = false) => {
      if (showInitialLoading) setSyncState("syncing");
      try {
        const [companyResult, userResult] = await Promise.all([
          getLiveCompanies(),
          getLiveUsers(),
        ]);
        if (!cancelled) {
          setCompanies(companyResult.data.map(fromApiCompany));
          setAdminUsers(userResult.data.map((item: any) => apiUser(item)));
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
  }, [authUser]);
  const selectedCompany =
    companies.find((company) => company.id === selectedId) ?? null;
  const filteredCompanies = useMemo(
    () =>
      companies.filter(
        (company) =>
          `${company.name} ${company.city || ""} ${company.scope} ${company.spoc.name}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (statusFilter === "All statuses" || company.status === statusFilter),
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
        <nav className="nav-section nav-bottom">
          <div className="nav-caption">Manage</div>
          <button
            className={`nav-item ${view === "admin" ? "active" : ""}`}
            onClick={() => setView("admin")}
          >
            <ShieldCheck size={17} /> Admin access
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="help-card">
            <Sparkles size={18} />
            <div>
              <strong>Need a hand?</strong>
              <span>Check the tracker guide</span>
            </div>
            <ArrowUpRight size={15} />
          </div>
          <div className="sidebar-user">
            <Avatar user={activeUser} />
            <div>
              <strong>{activeUser.name}</strong>
              <span>Workspace admin</span>
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
                    : "Admin access"}
            </strong>
          </div>
          <div className="top-actions">
            <button className="icon-button notification">
              <Bell size={18} />
              <i></i>
            </button>
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
            </div>
          </div>
        </header>
        <div className="content-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow">Workspace administration</div>
              <h1>Good morning, {activeUser.name.split(" ")[0]}</h1>
              <p>
                Manage MOU records, contacts, internal SPOCs, statuses,
                documents and activities.
              </p>
            </div>
            {view !== "admin" && (
              <button
                className="primary-button"
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={17} /> Add company
              </button>
            )}
          </div>
          {view === "admin" ? (
            <AdminAccessPage adminUsers={adminUsers} activeUser={activeUser} />
          ) : view === "activities" ? (
            <ActivityFeed companies={companies} />
          ) : (
            <section className="portfolio-section">
              {view === "overview" && (
                <section
                  className="status-overview"
                  aria-label="MOU status summary"
                >
                  <div className="status-overview-header">
                    <div>
                      <span className="eyebrow">Portfolio snapshot</span>
                      <h2>Status distribution</h2>
                    </div>
                    <span>{companies.length} total MOUs</span>
                  </div>
                  <div
                    className="portfolio-kpi-strip"
                    aria-label="MOU health KPIs"
                  >
                    <div className="portfolio-kpi portfolio-kpi-expiry">
                      <span>Expires in 30 days</span>
                      <strong>{expiringSoonCompanies.length}</strong>
                      <small>
                        {expiringSoonCompanies.length === 1
                          ? "Agreement needs a renewal decision"
                          : "Agreements need renewal decisions"}
                      </small>
                    </div>
                  </div>
                  {syncState === "syncing" && companies.length === 0 ? (
                    <div className="status-cards-loading">
                      <Clock3 size={19} />
                      <div>
                        <strong>Loading MOU statuses</strong>
                        <span>Fetching the current records from Supabase…</span>
                      </div>
                    </div>
                  ) : (
                    <div className="status-group-grid">
                      {statusGroups.map((group) => (
                        <section className="status-group" key={group.label}>
                          <h3>{group.label}</h3>
                          <div className="status-chip-grid">
                            {group.statuses.map((status) => (
                              <button
                                type="button"
                                className={`status-summary-chip ${statusValue(status)}`}
                                key={status}
                                aria-label={`Show ${status} MOUs`}
                                onClick={() => {
                                  setStatusFilter(status);
                                  setShowFilters(true);
                                  setView("companies");
                                }}
                              >
                                <span className="status-summary-label">
                                  <i />
                                  {status}
                                </span>
                                <strong>{statusCounts[status]}</strong>
                              </button>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </section>
              )}
              {view === "overview" && (
                <section className="insight-banner">
                  <div className="insight-icon">
                    <Sparkles size={19} />
                  </div>
                  <div>
                    <strong>Keep every record accountable</strong>
                    <p>
                      Status changes, activities and document updates are
                      attributed to the signed-in admin.
                    </p>
                  </div>
                  <button onClick={() => setView("companies")}>
                    Open company list <ArrowUpRight size={15} />
                  </button>
                </section>
              )}
              <div className="section-header">
                <div>
                  <h2>
                    {view === "companies" ? "All companies" : "MOU portfolio"}
                  </h2>
                  <p>Every company and agreement in your workspace.</p>
                </div>
                <div className="section-meta">
                  <span
                    className={`live-dot ${syncState === "error" ? "sync-error" : ""}`}
                  ></span>
                  {syncState === "demo"
                    ? "Demo data"
                    : syncState === "syncing"
                      ? "Syncing…"
                      : syncState === "error"
                        ? "Sync error"
                        : "Synced just now"}
                </div>
              </div>
              <div className="toolbar">
                <div className="search-box">
                  <Search size={17} />
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
                  <Filter size={16} /> Filter
                  {statusFilter !== "All statuses" && (
                    <span className="filter-count">1</span>
                  )}
                </button>
                <button className="secondary-button export-button">
                  <ArrowDownToLine size={16} /> Export
                </button>
              </div>
              {showFilters && (
                <div className="filter-row">
                  <span>Show status</span>
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as "All statuses" | Status,
                      )
                    }
                  >
                    <option>All statuses</option>
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
                          <div className="update-cell">
                            <span>{company.lastUpdated}</span>
                            <small>
                              by {company.lastUpdatedBy.name.split(" ")[0]}
                            </small>
                          </div>
                        </td>
                        <td>
                          <button
                            className="row-action"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(company.id);
                            }}
                          >
                            <ArrowUpRight size={16} />
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
                        ? "Loading MOU records from Supabase"
                        : syncState === "error"
                          ? "Could not load MOU records"
                          : "No MOUs match that search"}
                    </strong>
                    <span>
                      {syncState === "syncing"
                        ? "The workspace will populate as soon as the live request finishes."
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
          )}
        </div>
      </main>
      {selectedCompany && (
        <CompanyDrawer
          company={selectedCompany}
          activeUser={activeUser}
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
    </div>
  );
}

function CompanyDrawer({
  company,
  activeUser,
  onClose,
  onEdit,
  onSave,
}: {
  company: Company;
  activeUser: User;
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
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const statusSaveInFlight = useRef(false);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityNote, setActivityNote] = useState("");
  const [activityDate, setActivityDate] = useState("");

  function startStatusEdit() {
    setPendingStatus(company.status);
    setStatusDate(todayInput());
    setStatusError("");
    setShowStatusEdit(true);
  }

  async function saveStatus() {
    if (statusSaveInFlight.current) return;
    if (!statusDate) {
      setStatusError("A status date is required.");
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
        });
      const now = new Date().toISOString();
      onSave({
        ...company,
        status: pendingStatus,
        lastUpdated: "Just now",
        lastUpdatedBy: activeUser,
        statusHistory: [
          ...company.statusHistory,
          {
            status: pendingStatus,
            date: formatDate(statusDate),
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
    if (!activityTitle.trim() || !activityDate) return;
    try {
      if (isLiveMode && typeof company.id === "string")
        await addLiveActivity(company.id, {
          activity_name: activityTitle.trim(),
          activity_notes: activityNote.trim() || null,
          activity_date: activityDate,
        });
      const newActivity = {
        id: Date.now(),
        title: activityTitle.trim(),
        note:
          activityNote.trim() ||
          "Primary activity logged from the MOU workspace.",
        date: formatDate(activityDate),
        isoDate: activityDate,
        user: activeUser,
      };
      onSave({
        ...company,
        lastUpdated: "Just now",
        lastUpdatedBy: activeUser,
        activities: [newActivity, ...company.activities],
      });
      setActivityTitle("");
      setActivityNote("");
      setActivityDate("");
    } catch (error) {
      console.error(error);
    }
  }

  async function attachPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;
    try {
      if (isLiveMode && company.mouId) await uploadLivePdf(company.mouId, file);
      onSave({
        ...company,
        document: file.name,
        documentSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        lastUpdated: "Just now",
        lastUpdatedBy: activeUser,
      });
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-top">
          <button className="close-button" onClick={onClose}>
            <X size={19} />
          </button>
          <div className="drawer-actions">
            <label className="secondary-button">
              <Paperclip size={15} />{" "}
              {company.document ? "Replace PDF" : "Attach PDF"}
              <input
                type="file"
                accept="application/pdf,.pdf"
                style={{ display: "none" }}
                onChange={attachPdf}
              />
            </label>
            <button className="secondary-button" onClick={onEdit}>
              <Edit3 size={15} /> Edit all details
            </button>
          </div>
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
                <label>
                  <span>Status date *</span>
                  <input
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
            ) : (
              <button
                className={statusClass(company.status)}
                onClick={startStatusEdit}
              >
                <i></i>
                {company.status}
                <ChevronDown size={14} />
              </button>
            )}
          </div>
          <div className="updated-by">
            <span>Last updated {company.lastUpdated}</span>
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
              <button className="secondary-button" onClick={onEdit}>
                <Edit3 size={15} /> Edit details
              </button>
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
                <label className="text-button">
                  <UploadCloud size={14} />{" "}
                  {company.document ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    style={{ display: "none" }}
                    onChange={attachPdf}
                  />
                </label>
              </div>
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
                  <MoreHorizontal size={16} />
                </div>
              ) : (
                <div className="upload-empty">
                  <UploadCloud size={20} />
                  <span>Upload the signed MOU PDF</span>
                  <small>PDF only · Max 10 MB</small>
                </div>
              )}
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
                  <small>
                    {company.activities[0]?.date || "—"} ·{" "}
                    {company.activities[0]?.user.name || "—"}
                  </small>
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
                    <p>
                      {event.date} · Updated by {event.user.name}
                    </p>
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
            <form className="activity-form" onSubmit={addActivity}>
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
                <label>
                  <span>Activity date *</span>
                  <input
                    required
                    type="date"
                    value={activityDate}
                    onChange={(event) => setActivityDate(event.target.value)}
                  />
                </label>
                <button className="primary-button compact" type="submit">
                  <Plus size={15} /> Add activity
                </button>
              </div>
            </form>
            <div className="activity-list">
              {company.activities.map((activity) => (
                <div className="activity-item" key={activity.id}>
                  <div className="activity-marker">
                    <Activity size={14} />
                  </div>
                  <div>
                    <strong>{activity.title}</strong>
                    <p>{activity.note}</p>
                    <small>
                      {activity.date} · {activity.user.name}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "audit" && <AuditLog events={company.auditLog || []} />}
      </aside>
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
        return `${status}${parsed.date ? ` · ${formatDate(String(parsed.date))}` : ""}`;
      }
    }
    if (field === "activity" && typeof parsed === "object") {
      const name = String(parsed.name || parsed.title || "Activity");
      return `${name}${parsed.date ? ` · ${formatDate(String(parsed.date))}` : ""}`;
    }
    if (field === "signed_copy" && typeof parsed === "object") {
      const path = String(parsed.path || parsed.filename || "MOU signed copy");
      return path.split("/").pop() || "MOU signed copy";
    }
    return typeof parsed === "string" ? parsed : JSON.stringify(parsed);
  }

  function eventTitle(event: AuditEvent) {
    if (event.field_name === "status") return "Status changed";
    if (event.field_name === "activity") return "Activity logged";
    if (event.field_name === "signed_copy")
      return event.old_value ? "Signed copy replaced" : "Signed copy uploaded";
    return `${fieldLabels[event.field_name] || event.field_name} ${
      event.old_value ? "updated" : "added"
    }`;
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
          {events.map((event) => (
            <div className="audit-item" key={event.id}>
              <div className={`audit-marker audit-${event.field_name}`}>
                {eventIcon(event)}
              </div>
              <div className="audit-content">
                <div className="audit-heading">
                  <div>
                    <strong>{eventTitle(event)}</strong>
                    <small>
                      Changed by {apiUser(event.changed_by_user).name}
                    </small>
                  </div>
                  <time>{displayDateTime(event.changed_at)}</time>
                </div>
                <div
                  className={`audit-change ${
                    event.old_value ? "has-previous" : "is-created"
                  }`}
                >
                  {event.old_value && (
                    <div className="audit-value audit-old">
                      <span>Previous</span>
                      <strong>
                        {friendly(event.old_value, event.field_name)}
                      </strong>
                    </div>
                  )}
                  {event.old_value && <ArrowUpRight size={13} />}
                  <div className="audit-value audit-new">
                    <span>{event.old_value ? "New" : "Added"}</span>
                    <strong>
                      {friendly(event.new_value, event.field_name)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
  onSave: (company: Company) => void;
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
  const [document, setDocument] = useState<File | null>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
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
      (activityName.trim() && !activityDate)
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
      lastUpdatedBy: activeUser,
      statusHistory: company?.statusHistory || [
        {
          status,
          date: displayDate(new Date().toISOString()),
          user: activeUser,
        },
      ],
      activities: activity,
      auditLog: company?.auditLog || [],
      documentFile: document || undefined,
    };
    onSave(next);
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
          <div className="modal-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit">
              {company ? (
                "Save changes"
              ) : (
                <>
                  <Plus size={16} /> Create company
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
}: {
  adminUsers: User[];
  activeUser: User;
}) {
  return (
    <section className="activity-page">
      <div className="section-header">
        <div>
          <h2>Admin access</h2>
          <p>Login accounts with permission to manage every MOU record.</p>
        </div>
        <div className="section-meta">
          <span className="live-dot"></span> Database-backed
        </div>
      </div>
      <div className="admin-access-card">
        <div className="history-intro">
          <ShieldCheck size={17} />
          <span>
            Internal SPOCs and client contacts are not users. They are
            maintained inside each MOU record.
          </span>
        </div>
        <div className="admin-user-list">
          {adminUsers.map((user) => (
            <div className="admin-user-row" key={user.email}>
              <Avatar user={user} />
              <div>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </div>
              <span className="admin-role">
                {user.email === activeUser.email
                  ? "You · Admin"
                  : "Workspace admin"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
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
              <small>
                {activity.date} · {activity.user.name}
              </small>
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
