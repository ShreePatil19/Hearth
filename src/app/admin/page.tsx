import { redirect } from "next/navigation";

// /admin currently has nothing — just bounce to the members queue
export default function AdminIndex() {
  redirect("/admin/members");
}
