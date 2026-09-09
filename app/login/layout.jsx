import { Plus_Jakarta_Sans } from "next/font/google"
import LoginScrollLock from "@/components/login/login-scroll-lock"

const loginFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-login",
})

export default function LoginLayout({ children }) {
  return (
    <div className={`${loginFont.variable} ${loginFont.className}`}>
      <LoginScrollLock />
      {children}
    </div>
  )
}
