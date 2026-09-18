"use client";

import Image from "next/image";
import Link from "next/link";
import styles from "./AppNav.module.css";

export type AppNavSection =
  | "dashboard"
  | "new-task"
  | "resources"
  | "activity"
  | "policy";

const links: Array<{ section: AppNavSection; href: string; label: string }> = [
  { section: "dashboard", href: "/dashboard", label: "Dashboard" },
  { section: "new-task", href: "/tasks/new", label: "New task" },
  { section: "resources", href: "/resources", label: "Resources" },
  { section: "activity", href: "/activity", label: "Activity" },
  { section: "policy", href: "/policy", label: "Agent policy" },
];

export default function AppNav({ active }: { active?: AppNavSection }) {
  return (
    <nav className={styles.nav}>
      <Link className={styles.brand} href="/dashboard">
        <Image
          className={styles.logo}
          src="/pr-logo.png"
          alt=""
          width={34}
          height={34}
          priority
        />
        PolicyRail
      </Link>

      <div className={styles.links}>
        {links.map((link) => (
          <Link
            className={active === link.section ? styles.active : undefined}
            href={link.href}
            key={link.section}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
