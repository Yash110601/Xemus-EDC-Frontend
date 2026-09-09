import { Plus_Jakarta_Sans } from "next/font/google"

const loginFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-login",
})

export default function ForgotPasswordLayout({ children }) {
  return <div className={`${loginFont.variable} ${loginFont.className}`}>{children}</div>
}
