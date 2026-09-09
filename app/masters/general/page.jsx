import DashboardLayout from "@/components/dashboard-layout"
import styles from "./page.module.css"

export default function GeneralMastersPage() {
  return (
    <DashboardLayout>
      <div className={styles.pageBackground}>
        <div className="p-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">General Masters</h1>
        <p className="text-slate-600">Content for General Masters will be added here.</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
