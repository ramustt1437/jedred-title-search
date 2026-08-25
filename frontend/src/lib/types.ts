// Hand-written mirrors of backend/models/schemas.py — keep both sides in sync.
export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "RESEARCHER" | "REVIEWER" | "CLIENT";
  active: boolean;
  is_demo: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  client_name: string;
  client_reference: string;
  order_date: string;
  due_date: string;
  priority: string;
  assigned_to: string | null;
  status: string;
  property_owner: string;
  applicant_name: string;
  property_address: string;
  village: string;
  taluk: string;
  district: string;
  state: string;
  survey_number: string;
  sub_division_number: string;
  plot_number: string;
  khata_number: string;
  registration_district: string;
  registration_office: string;
  search_period: string;
  other_identifying_info: string;
  client_instructions: string;
  internal_notes: string;
  additional_search_info: string;
  is_draft: boolean;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  assigned_to_name: string;
  is_demo: boolean;
  permissions: string[];
}

export type OrderPayload = Omit<
  Order,
  | "id" | "created_by" | "created_at" | "updated_at" | "assigned_to_name"
  | "is_demo" | "permissions" | "order_number"
> & { order_number?: string };

export interface DocumentInfo {
  registration_date: string;
  seller: string;
  buyer: string;
  donor: string;
  donee: string;
  mortgagor: string;
  mortgagee: string;
  other_parties: string;
  prop_address: string;
  survey_number: string;
  sub_division_number: string;
  plot_number: string;
  extent_area: string;
  boundaries: string;
  village: string;
  taluk: string;
  district: string;
  state: string;
  transaction_type: string;
  consideration_amount: string;
  execution_date: string;
  nature_of_transaction: string;
  important_info: string;
  researcher_notes: string;
  potential_issues: string;
  source_reference: string;
}

export interface DocumentRecord {
  id: string;
  order_id: string;
  doc_type: string;
  doc_number: string;
  doc_date: string;
  source: string;
  source_url: string;
  registration_number: string;
  registration_office: string;
  description: string;
  notes: string;
  file_name: string;
  file_size: number;
  content_type: string;
  uploaded_by_name: string;
  uploaded_at: string | null;
  timeline_index: number;
  info: DocumentInfo;
  upload_history: string[];
  is_demo: boolean;
}

export interface Finding {
  id: string;
  order_id: string;
  finding_type: string;
  description: string;
  source: string;
  source_url: string;
  date_found: string;
  related_document_id: string | null;
  researcher_notes: string;
  importance: string;
  created_by_name: string;
  is_demo: boolean;
}

export interface ReportSection {
  heading: string;
  body: string;
}

export interface ReportVersion {
  id: string;
  order_id: string;
  version: number;
  status: string;
  ai_generated: boolean;
  sections: ReportSection[];
  created_by_name: string;
  created_at: string | null;
  change_note: string;
}

export interface AccessGrant {
  id: string;
  order_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  permissions: string[];
}

export interface ActivityEntry {
  id: string;
  order_id: string | null;
  user_name: string;
  action: string;
  detail: string;
  created_at: string | null;
}

export interface AppSettings {
  company_name: string;
  company_address: string;
  company_contact: string;
  report_footer: string;
  document_types: string[];
}

export interface DashboardStats {
  total: number;
  new: number;
  in_progress: number;
  pending_review: number;
  completed: number;
  overdue: number;
}

export interface Dashboard {
  stats: DashboardStats;
  recent: Order[];
  due_soon: Order[];
  recently_completed: Order[];
  assigned_to_me: Order[];
}

export interface ClientRecord {
  id: string;
  name: string;
  contact_email: string;
  is_demo: boolean;
}

export const ORDER_STATUSES = [
  "NEW", "IN PROGRESS", "DOCUMENTS COLLECTED", "REPORT PREPARATION",
  "PENDING REVIEW", "APPROVED", "COMPLETED", "ON HOLD", "CANCELLED",
];

export const PRIORITIES = ["Low", "Normal", "High", "Urgent"];
export const PERMISSIONS = ["view", "edit", "upload", "download", "approve", "export"];

export const emptyOrder = (): OrderPayload => ({
  client_name: "", client_reference: "", order_date: "", due_date: "", priority: "Normal",
  assigned_to: null, status: "NEW", property_owner: "", applicant_name: "",
  property_address: "", village: "", taluk: "", district: "", state: "",
  survey_number: "", sub_division_number: "", plot_number: "", khata_number: "",
  registration_district: "", registration_office: "", search_period: "",
  other_identifying_info: "", client_instructions: "", internal_notes: "",
  additional_search_info: "", is_draft: false,
});
