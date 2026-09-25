export const ROLES = ["Admin", "Marketing Lead", "Writer", "Designer", "SEO", "Social", "Approver", "Viewer"] as const;
export type Role = (typeof ROLES)[number];
