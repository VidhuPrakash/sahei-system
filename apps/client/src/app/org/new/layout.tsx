import type { Metadata } from "next";

export const metadata: Metadata = { title: "Set up your organization" };

export default function NewOrganizationLayout({ children }: LayoutProps<"/org/new">) {
  return children;
}
