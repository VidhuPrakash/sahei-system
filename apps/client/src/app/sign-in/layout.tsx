import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInLayout({ children }: LayoutProps<"/sign-in">) {
  return children;
}
