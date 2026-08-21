export interface Learner {
  id: string;
  name: string;
  email: string;
  phone: string;
  course: string;
  enrollmentDate: string;
  progress: number;
  status: "active" | "completed" | "paused";
  avatar?: string;
}

export interface Instructor {
  id: string;
  name: string;
  email: string;
  specialty: string;
  courses: number;
  rating: number;
  status: "active" | "on-leave";
}

export interface Course {
  id: string;
  title: string;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  enrolled: number;
  capacity: number;
  instructor: string;
  status: "active" | "draft" | "archived";
  price: number;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  lessons: number;
  duration: string;
  order: number;
}

export interface Resource {
  id: string;
  title: string;
  category: string;
  type: "PDF" | "CAD" | "Video" | "Template" | "Texture";
  files: number;
  downloads: number;
}

export interface ScheduleItem {
  id: string;
  title: string;
  course: string;
  date: string;
  time: string;
  type: "live" | "workshop" | "review";
  instructor: string;
}

export interface AttendanceRecord {
  id: string;
  learnerId: string;
  learnerName: string;
  course: string;
  date: string;
  status: "present" | "absent" | "late";
}

export interface Assessment {
  id: string;
  title: string;
  course: string;
  type: "quiz" | "project" | "final";
  date: string;
  maxScore: number;
  submissions: number;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  priority: "low" | "medium" | "high";
  category: string;
}

export interface Project {
  id: string;
  learnerId: string;
  learnerName: string;
  title: string;
  course: string;
  score: number;
  status: "submitted" | "reviewed" | "featured";
  thumbnail?: string;
}

export interface Enrollment {
  id: string;
  learnerName: string;
  course: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "refunded";
  learnerEmail?: string;
  feeTrackId?: string;
  classOptionId?: string;
  credentialsSent?: boolean;
}

export type UserRole = "super_admin" | "accountant" | "tutor" | "student";

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  status: "active" | "inactive";
  /** Links student users to learner roster */
  learnerId?: string;
  /** Links tutor users to instructor roster */
  instructorId?: string;
  feeTrackId?: string;
  classOptionId?: string;
  specialty?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  learnerId?: string;
  instructorId?: string;
}

export interface PaymentRecord {
  id: string;
  learnerName: string;
  learnerEmail: string;
  phone: string;
  feeTrackId: string;
  classOptionId: string;
  amount: number;
  method: "mobile_money" | "bank" | "cash" | "card";
  reference: string;
  date: string;
  status: "confirmed" | "pending" | "failed";
  credentialsSent: boolean;
  studentUserId?: string;
  rukaPayTxnId?: string;
  rukaPayProvider?: string;
}

export interface CredentialEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  paymentId?: string;
  userId?: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  children?: { label: string; href: string }[];
}

export interface FeeItem {
  label: string;
  amount: number;
}

export interface FeeTrack {
  id: string;
  name: string;
  durationMonths: number;
  total: number;
  breakdown: FeeItem[];
  includesInternship: boolean;
}

export interface ClassOption {
  id: string;
  name: string;
  days: string;
  time: string;
  hoursPerDay: number;
}
