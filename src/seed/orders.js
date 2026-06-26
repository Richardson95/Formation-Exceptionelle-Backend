// Demo orders backing the admin Payments view (mirrors the transactions shown in
// the live frontend). Statuses map to the table as: paid → completed.
// `date` controls both the createdAt ordering (newest = TXN-001) and the displayed date.
export const DEMO_ORDERS = [
  {
    userId: 'demo-chioma',
    items: [{ courseId: 'c001', title: 'Financing, M&A and ADR: Advanced Practice', price: 35000 }],
    total: 35000,
    status: 'paid',
    date: '2026-06-14',
    billing: { firstName: 'Chioma', lastName: 'Eze', email: 'chioma@email.com', country: 'Nigeria' },
  },
  {
    userId: 'demo-james',
    items: [{ courseId: 'c005', title: 'Capital Market: Corporate Financing & Compliance', price: 30000 }],
    total: 30000,
    status: 'paid',
    date: '2026-06-13',
    billing: { firstName: 'James', lastName: 'Adeyemi', email: 'james@email.com', country: 'Nigeria' },
  },
  {
    userId: 'demo-fatima',
    items: [{ courseId: 'c003', title: 'Strategic Leadership & Corporate Governance', price: 28000 }],
    total: 28000,
    status: 'paid',
    date: '2026-06-12',
    billing: { firstName: 'Fatima', lastName: 'Hassan', email: 'fatima@email.com', country: 'Nigeria' },
  },
  {
    userId: 'demo-emmanuel',
    items: [{ courseId: 'c007', title: 'Mergers & Acquisitions: Regulations & Risk', price: 32000 }],
    total: 32000,
    status: 'pending',
    date: '2026-06-11',
    billing: { firstName: 'Emmanuel', lastName: 'Osei', email: 'emmanuel@email.com', country: 'Ghana' },
  },
  {
    userId: 'demo-ngozi',
    items: [{ courseId: 'c009', title: 'The New Tax Laws: Strategic Implications', price: 22000 }],
    total: 22000,
    status: 'paid',
    date: '2026-06-10',
    billing: { firstName: 'Ngozi', lastName: 'Iweala', email: 'ngozi@email.com', country: 'Nigeria' },
  },
  {
    userId: 'demo-kwame',
    items: [{ courseId: 'c006', title: 'Project Structuring, Financing & ESG', price: 40000 }],
    total: 40000,
    status: 'refunded',
    date: '2026-06-09',
    billing: { firstName: 'Kwame', lastName: 'Mensah', email: 'kwame@email.com', country: 'Ghana' },
  },
];
