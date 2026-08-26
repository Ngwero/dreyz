import type {
  Learner,
  Instructor,
  Course,
  Module,
  Resource,
  ScheduleItem,
  AttendanceRecord,
  Assessment,
  Notice,
  Project,
  Enrollment,
  FeeTrack,
  ClassOption,
} from "./types";

export const stats = {
  learners: 2840,
  instructors: 18,
  certifications: 1240,
  courses: 29,
  projects: 890,
  revenue: 186500,
};

/** Full programme: coursework units + 2-month internship */
export const programme = {
  name: "Professional Interior Design Programme",
  courseworkUnits: 28,
  internshipMonths: 2,
  note: "The extra 2 months are for internship (Industrial Training).",
};

export const schoolInfo = {
  name: "Dreyz Interior Design School",
  tagline: "Learn | Design | Inspire",
  location: "Kira Road, opposite Total Kyaliwajjala, Kyaliwajjala",
  area: "Kyaliwajjala",
  phones: ["+256 779 449481", "+256 758 218 123"],
  email: "dreyzinteriorug@gmail.com",
  website: "www.dreyzschool.com",
  format: "Physical classes and practicals only — no online option.",
  certificate: "Graduates receive a certificate.",
  installments: "Fees can be paid in 3 or 4 installments.",
  /** Current open registration window */
  intake: "January 2027",
  intakeStatus: "open" as const,
  intakeNote:
    "September intake is closed. We are now registering for the January 2027 intake.",
};

export const admissionRequirements = [
  "A valid identification document (National ID or passport)",
  "2 hardcopy passport-size photographs",
  "1 soft-copy image for your student ID",
  "Ability to read and write",
  "Basic computer skills (needed later for the design software)",
];

export const classOptions: ClassOption[] = [
  {
    id: "weekday",
    name: "Weekday Morning",
    days: "Monday – Wednesday",
    time: "8:30 AM – 10:30 AM",
    hoursPerDay: 2,
  },
  {
    id: "weekday-pm",
    name: "Weekday Midday",
    days: "Monday – Wednesday",
    time: "11:00 AM – 1:00 PM",
    hoursPerDay: 2,
  },
];

export const feeTracks: FeeTrack[] = [
  {
    id: "4-month",
    name: "4-Month Main Course",
    durationMonths: 4,
    total: 3350000,
    includesInternship: false,
    breakdown: [
      { label: "Registration", amount: 350000 },
      { label: "Tuition", amount: 2000000 },
      { label: "Study text book", amount: 350000 },
      { label: "Graduation", amount: 650000 },
    ],
  },
  {
    id: "6-month",
    name: "6-Month Course + Internship",
    durationMonths: 6,
    total: 4400000,
    includesInternship: true,
    breakdown: [
      { label: "Registration", amount: 350000 },
      { label: "Tuition", amount: 2000000 },
      { label: "Study text book", amount: 350000 },
      { label: "Graduation", amount: 650000 },
      { label: "PPE (protective gear)", amount: 350000 },
      { label: "Internship", amount: 700000 },
    ],
  },
];

export const learners: Learner[] = [
  { id: "DRY001", name: "Amara Okafor", email: "amara.o@email.com", phone: "+234 801 234 5678", course: "Residential Interior Design", enrollmentDate: "2025-09-12", intake: "September 2025", progress: 78, status: "active" },
  { id: "DRY002", name: "James Mitchell", email: "j.mitchell@email.com", phone: "+44 7700 900123", course: "Commercial Interior Design", enrollmentDate: "2025-10-03", intake: "September 2025", progress: 92, status: "active" },
  { id: "DRY003", name: "Priya Sharma", email: "priya.s@email.com", phone: "+91 98765 43210", course: "Colour Theory and Colour Psychology", enrollmentDate: "2025-08-20", intake: "September 2025", progress: 100, status: "completed" },
  { id: "DRY004", name: "David Chen", email: "d.chen@email.com", phone: "+1 555 0123", course: "SketchUp and 3D Visualization", enrollmentDate: "2025-11-01", intake: "September 2025", progress: 45, status: "active" },
  { id: "DRY005", name: "Fatima Al-Rashid", email: "fatima.a@email.com", phone: "+971 50 123 4567", course: "Hospitality Interior Design", enrollmentDate: "2025-07-15", intake: "September 2025", progress: 100, status: "completed" },
  { id: "DRY006", name: "Lucas Bergström", email: "lucas.b@email.com", phone: "+46 70 123 4567", course: "Materials and Finishes", enrollmentDate: "2025-11-18", intake: "September 2025", progress: 23, status: "active" },
  { id: "DRY007", name: "Grace Nakato", email: "grace.n@email.com", phone: "+256 712 345 678", course: "Space Planning and Layout", enrollmentDate: "2025-06-08", intake: "January 2025", progress: 65, status: "paused" },
  { id: "DRY008", name: "Marco Rossi", email: "marco.r@email.com", phone: "+39 333 123 4567", course: "AutoCAD for Interior Design", enrollmentDate: "2025-10-22", intake: "September 2025", progress: 88, status: "active" },
];

export const instructors: Instructor[] = [
  { id: "INS001", name: "Elena Vasquez", email: "elena@dreyzinterior.com", specialty: "Residential Design", courses: 5, rating: 4.9, status: "active" },
  { id: "INS002", name: "Marcus Webb", email: "marcus@dreyzinterior.com", specialty: "Commercial & Technical", courses: 5, rating: 4.8, status: "active" },
  { id: "INS003", name: "Yuki Tanaka", email: "yuki@dreyzinterior.com", specialty: "3D Visualization", courses: 3, rating: 4.7, status: "active" },
  { id: "INS004", name: "Sophie Laurent", email: "sophie@dreyzinterior.com", specialty: "Colour & Styling", courses: 4, rating: 4.9, status: "active" },
  { id: "INS005", name: "Ahmed Hassan", email: "ahmed@dreyzinterior.com", specialty: "Materials & Construction", courses: 5, rating: 4.6, status: "on-leave" },
  { id: "INS006", name: "Isabella Romano", email: "isabella@dreyzinterior.com", specialty: "Hospitality & Business", courses: 4, rating: 5.0, status: "active" },
];

export const courses: Course[] = [
  // Foundations
  { id: "CRS001", title: "Introduction to Interior Design", category: "Foundations", level: "Beginner", duration: "2 weeks", enrolled: 412, capacity: 450, instructor: "Elena Vasquez", status: "active", price: 0 },
  { id: "CRS002", title: "Principles and Elements of Design", category: "Foundations", level: "Beginner", duration: "2 weeks", enrolled: 398, capacity: 450, instructor: "Sophie Laurent", status: "active", price: 0 },
  { id: "CRS003", title: "Space Planning and Layout", category: "Foundations", level: "Beginner", duration: "3 weeks", enrolled: 376, capacity: 400, instructor: "Elena Vasquez", status: "active", price: 0 },
  { id: "CRS004", title: "Colour Theory and Colour Psychology", category: "Foundations", level: "Beginner", duration: "2 weeks", enrolled: 401, capacity: 450, instructor: "Sophie Laurent", status: "active", price: 0 },
  // Design & Décor
  { id: "CRS005", title: "Furniture Design and Selection", category: "Design & Décor", level: "Intermediate", duration: "2 weeks", enrolled: 312, capacity: 350, instructor: "Sophie Laurent", status: "active", price: 0 },
  { id: "CRS006", title: "Lighting Design", category: "Design & Décor", level: "Intermediate", duration: "2 weeks", enrolled: 298, capacity: 350, instructor: "Elena Vasquez", status: "active", price: 0 },
  { id: "CRS007", title: "Interior Styling and Décor", category: "Design & Décor", level: "Intermediate", duration: "2 weeks", enrolled: 334, capacity: 350, instructor: "Sophie Laurent", status: "active", price: 0 },
  // Materials & Finishes
  { id: "CRS008", title: "Materials and Finishes", category: "Materials & Finishes", level: "Intermediate", duration: "2 weeks", enrolled: 287, capacity: 350, instructor: "Ahmed Hassan", status: "active", price: 0 },
  { id: "CRS009", title: "Flooring, Wall and Ceiling Finishes", category: "Materials & Finishes", level: "Intermediate", duration: "2 weeks", enrolled: 265, capacity: 300, instructor: "Ahmed Hassan", status: "active", price: 0 },
  { id: "CRS010", title: "Gypsum Ceiling and Partition Design", category: "Materials & Finishes", level: "Intermediate", duration: "2 weeks", enrolled: 241, capacity: 300, instructor: "Ahmed Hassan", status: "active", price: 0 },
  { id: "CRS011", title: "Soft Furnishings and Window Treatments", category: "Materials & Finishes", level: "Intermediate", duration: "2 weeks", enrolled: 278, capacity: 300, instructor: "Sophie Laurent", status: "active", price: 0 },
  // Specialized Spaces
  { id: "CRS012", title: "Kitchen and Wardrobe Design", category: "Specialized Spaces", level: "Intermediate", duration: "3 weeks", enrolled: 256, capacity: 300, instructor: "Elena Vasquez", status: "active", price: 0 },
  { id: "CRS013", title: "Bathroom Design", category: "Specialized Spaces", level: "Intermediate", duration: "2 weeks", enrolled: 234, capacity: 300, instructor: "Elena Vasquez", status: "active", price: 0 },
  // Practice Areas
  { id: "CRS014", title: "Residential Interior Design", category: "Practice Areas", level: "Intermediate", duration: "3 weeks", enrolled: 342, capacity: 400, instructor: "Elena Vasquez", status: "active", price: 0 },
  { id: "CRS015", title: "Commercial Interior Design", category: "Practice Areas", level: "Advanced", duration: "3 weeks", enrolled: 198, capacity: 250, instructor: "Marcus Webb", status: "active", price: 0 },
  { id: "CRS016", title: "Hospitality Interior Design", category: "Practice Areas", level: "Advanced", duration: "3 weeks", enrolled: 156, capacity: 200, instructor: "Isabella Romano", status: "active", price: 0 },
  { id: "CRS017", title: "Landscape and Outdoor Living Design", category: "Practice Areas", level: "Intermediate", duration: "2 weeks", enrolled: 178, capacity: 250, instructor: "Ahmed Hassan", status: "active", price: 0 },
  // Technical Skills
  { id: "CRS018", title: "Technical Drawing and Drafting", category: "Technical Skills", level: "Beginner", duration: "3 weeks", enrolled: 356, capacity: 400, instructor: "Marcus Webb", status: "active", price: 0 },
  { id: "CRS019", title: "AutoCAD for Interior Design", category: "Technical Skills", level: "Intermediate", duration: "4 weeks", enrolled: 312, capacity: 350, instructor: "Marcus Webb", status: "active", price: 0 },
  { id: "CRS020", title: "SketchUp and 3D Visualization", category: "Technical Skills", level: "Intermediate", duration: "4 weeks", enrolled: 287, capacity: 300, instructor: "Yuki Tanaka", status: "active", price: 0 },
  // Professional Practice
  { id: "CRS021", title: "Project Costing and Bill of Quantities (BOQ)", category: "Professional Practice", level: "Intermediate", duration: "2 weeks", enrolled: 223, capacity: 300, instructor: "Marcus Webb", status: "active", price: 0 },
  { id: "CRS022", title: "Project Management", category: "Professional Practice", level: "Intermediate", duration: "2 weeks", enrolled: 210, capacity: 300, instructor: "Isabella Romano", status: "active", price: 0 },
  { id: "CRS023", title: "Site Supervision and Quality Control", category: "Professional Practice", level: "Intermediate", duration: "2 weeks", enrolled: 189, capacity: 250, instructor: "Ahmed Hassan", status: "active", price: 0 },
  { id: "CRS024", title: "Client Relations and Presentation Skills", category: "Professional Practice", level: "Intermediate", duration: "2 weeks", enrolled: 245, capacity: 300, instructor: "Isabella Romano", status: "active", price: 0 },
  { id: "CRS025", title: "Entrepreneurship and Interior Design Business Management", category: "Professional Practice", level: "Advanced", duration: "2 weeks", enrolled: 167, capacity: 200, instructor: "Isabella Romano", status: "active", price: 0 },
  // Capstone
  { id: "CRS026", title: "Portfolio Development", category: "Capstone", level: "Advanced", duration: "2 weeks", enrolled: 201, capacity: 250, instructor: "Yuki Tanaka", status: "active", price: 0 },
  { id: "CRS027", title: "Industrial Training and Site Visits", category: "Capstone", level: "Intermediate", duration: "2 weeks", enrolled: 178, capacity: 200, instructor: "Marcus Webb", status: "active", price: 0 },
  { id: "CRS028", title: "Final Practical Design Project", category: "Capstone", level: "Advanced", duration: "4 weeks", enrolled: 156, capacity: 200, instructor: "Elena Vasquez", status: "active", price: 0 },
  // Internship (extra 2 months)
  { id: "CRS029", title: "Internship", category: "Internship", level: "Advanced", duration: "2 months", enrolled: 142, capacity: 180, instructor: "Marcus Webb", status: "active", price: 0 },
];

export const modules: Module[] = [
  { id: "MOD001", courseId: "CRS001", title: "History & Role of the Interior Designer", lessons: 4, duration: "2h 00m", order: 1 },
  { id: "MOD002", courseId: "CRS001", title: "Design Process Overview", lessons: 5, duration: "2h 30m", order: 2 },
  { id: "MOD003", courseId: "CRS003", title: "Circulation and Zoning", lessons: 6, duration: "3h 15m", order: 1 },
  { id: "MOD004", courseId: "CRS003", title: "Furniture Layout Strategies", lessons: 5, duration: "2h 45m", order: 2 },
  { id: "MOD005", courseId: "CRS004", title: "Colour Wheels and Harmonies", lessons: 4, duration: "2h 00m", order: 1 },
  { id: "MOD006", courseId: "CRS004", title: "Psychological Effects of Colour", lessons: 4, duration: "2h 15m", order: 2 },
  { id: "MOD007", courseId: "CRS019", title: "AutoCAD Interface & Drafting Basics", lessons: 8, duration: "4h 30m", order: 1 },
  { id: "MOD008", courseId: "CRS020", title: "SketchUp Interface & Tools", lessons: 10, duration: "5h 15m", order: 1 },
  { id: "MOD009", courseId: "CRS014", title: "Residential Space Types", lessons: 6, duration: "3h 30m", order: 1 },
  { id: "MOD010", courseId: "CRS028", title: "Brief Development & Concept", lessons: 4, duration: "3h 00m", order: 1 },
  { id: "MOD011", courseId: "CRS028", title: "Final Presentation & Critique", lessons: 3, duration: "4h 00m", order: 2 },
  { id: "MOD012", courseId: "CRS029", title: "Placement Orientation", lessons: 2, duration: "1h 30m", order: 1 },
  { id: "MOD013", courseId: "CRS029", title: "Site Log & Mentorship Reviews", lessons: 4, duration: "2h 00m", order: 2 },
];

export const resources: Resource[] = [
  { id: "RES001", title: "Material Swatch Library", category: "Textures", type: "Texture", files: 240, downloads: 1840 },
  { id: "RES002", title: "CAD Floor Plan Templates", category: "Templates", type: "CAD", files: 86, downloads: 920 },
  { id: "RES003", title: "Furniture Catalog 2025", category: "Reference", type: "PDF", files: 12, downloads: 2100 },
  { id: "RES004", title: "Lighting Fixture Models", category: "3D Assets", type: "CAD", files: 156, downloads: 670 },
  { id: "RES005", title: "Mood Board Templates", category: "Templates", type: "Template", files: 48, downloads: 1340 },
  { id: "RES006", title: "Client Presentation Decks", category: "Business", type: "Template", files: 24, downloads: 890 },
];

export const schedule: ScheduleItem[] = [
  { id: "SCH001", title: "Live Q&A: Space Planning", course: "Space Planning and Layout", date: "2026-08-24", time: "14:00", type: "live", instructor: "Elena Vasquez" },
  { id: "SCH002", title: "Workshop: Colour Palettes", course: "Colour Theory and Colour Psychology", date: "2026-08-25", time: "10:00", type: "workshop", instructor: "Sophie Laurent" },
  { id: "SCH003", title: "Project Review Session", course: "Commercial Interior Design", date: "2026-08-26", time: "16:00", type: "review", instructor: "Marcus Webb" },
  { id: "SCH004", title: "SketchUp Live Demo", course: "SketchUp and 3D Visualization", date: "2026-08-27", time: "11:00", type: "live", instructor: "Yuki Tanaka" },
  { id: "SCH005", title: "Hospitality Design Masterclass", course: "Hospitality Interior Design", date: "2026-08-28", time: "15:00", type: "workshop", instructor: "Isabella Romano" },
];

export const attendance: AttendanceRecord[] = [
  { id: "ATT001", learnerId: "DRY001", learnerName: "Amara Okafor", course: "Residential Interior Design", date: "2025-06-28", status: "present" },
  { id: "ATT002", learnerId: "DRY002", learnerName: "James Mitchell", course: "Commercial Interior Design", date: "2025-06-28", status: "present" },
  { id: "ATT003", learnerId: "DRY004", learnerName: "David Chen", course: "SketchUp and 3D Visualization", date: "2025-06-28", status: "late" },
  { id: "ATT004", learnerId: "DRY006", learnerName: "Lucas Bergström", course: "Materials and Finishes", date: "2025-06-28", status: "absent" },
  { id: "ATT005", learnerId: "DRY008", learnerName: "Marco Rossi", course: "AutoCAD for Interior Design", date: "2025-06-28", status: "present" },
];

export const assessments: Assessment[] = [
  { id: "ASM001", title: "Space Planning Quiz", course: "Space Planning and Layout", type: "quiz", date: "2025-07-01", maxScore: 100, submissions: 298 },
  { id: "ASM002", title: "Office Layout Project", course: "Commercial Interior Design", type: "project", date: "2025-07-05", maxScore: 100, submissions: 142 },
  { id: "ASM003", title: "Colour Harmony Assignment", course: "Colour Theory and Colour Psychology", type: "project", date: "2025-07-08", maxScore: 100, submissions: 401 },
  { id: "ASM004", title: "3D Room Render Final", course: "SketchUp and 3D Visualization", type: "final", date: "2025-07-15", maxScore: 100, submissions: 89 },
  { id: "ASM005", title: "Final Practical Design Project", course: "Final Practical Design Project", type: "final", date: "2025-07-20", maxScore: 100, submissions: 67 },
];

export const notices: Notice[] = [
  {
    id: "NTC001",
    title: "January 2027 intake now open",
    content:
      "September intake is closed. Registration is open for the January 2027 intake. Choose the 4-month main course or 6-month course with internship.",
    date: "2026-08-21",
    priority: "high",
    category: "Enrollment",
  },
  { id: "NTC002", title: "Platform Maintenance Scheduled", content: "The learning platform will undergo maintenance on July 2nd from 2:00 AM to 4:00 AM UTC.", date: "2025-06-29", priority: "medium", category: "System" },
  { id: "NTC003", title: "New Resource Pack: Material Swatches", content: "We've added 240 new material textures to the Design Resource Center.", date: "2025-06-28", priority: "low", category: "Resources" },
  { id: "NTC004", title: "Internship Placements Open", content: "The 2-month internship block placements are now open. Apply via Industrial Training and Site Visits.", date: "2025-06-27", priority: "high", category: "Enrollment" },
  { id: "NTC005", title: "Student Showcase: June 2025", content: "Congratulations to our featured students for their outstanding portfolio projects this month.", date: "2025-06-25", priority: "medium", category: "Achievement" },
];

export const projects: Project[] = [
  { id: "PRJ001", learnerId: "DRY002", learnerName: "James Mitchell", title: "Modern Open-Plan Office", course: "Commercial Interior Design", score: 98, status: "featured" },
  { id: "PRJ002", learnerId: "DRY003", learnerName: "Priya Sharma", title: "Bohemian Living Room", course: "Colour Theory and Colour Psychology", score: 96, status: "featured" },
  { id: "PRJ003", learnerId: "DRY005", learnerName: "Fatima Al-Rashid", title: "Boutique Hotel Suite", course: "Hospitality Interior Design", score: 99, status: "featured" },
  { id: "PRJ004", learnerId: "DRY001", learnerName: "Amara Okafor", title: "Cozy Family Home", course: "Residential Interior Design", score: 91, status: "reviewed" },
  { id: "PRJ005", learnerId: "DRY008", learnerName: "Marco Rossi", title: "Minimalist Kitchen", course: "Kitchen and Wardrobe Design", score: 94, status: "reviewed" },
  { id: "PRJ006", learnerId: "DRY004", learnerName: "David Chen", title: "3D Bedroom Visualization", course: "SketchUp and 3D Visualization", score: 87, status: "submitted" },
];

export const enrollments: Enrollment[] = [];

export const courseStats = [
  { name: "Foundations", value: 18, color: "#061a4a" },
  { name: "Design & Décor", value: 14, color: "#082878" },
  { name: "Materials", value: 16, color: "#1F429A" },
  { name: "Practice Areas", value: 20, color: "#1b7eef" },
  { name: "Technical", value: 18, color: "#d8ff59" },
  { name: "Professional", value: 14, color: "#ff8c00" },
];

export const performanceByLevel = [
  { level: "Beginner", score: 82 },
  { level: "Intermediate", score: 91 },
  { level: "Advanced", score: 96 },
];

export const scheduleDownloads = [
  { month: "June 2025", sessions: 12 },
  { month: "July 2025", sessions: 18 },
];
