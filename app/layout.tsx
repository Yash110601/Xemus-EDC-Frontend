import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import { ToasterClient } from '@/components/ToasterClient'
import DisableNumberInputScroll from '@/components/DisableNumberInputScroll'
import DevRevWidgetInitializer from '@/components/devrev-widget-initializer'
import { DEVREV_WIDGET_ENABLED } from '@/lib/config/supportWidget'
import { VisitAttachmentUploadProvider } from '@/context/VisitAttachmentUploadContext'
import { ReportExportJobsProvider } from '@/context/ReportExportJobsContext'
import { AppTimeProvider } from '@/context/AppTimeContext'
import AppTooltipProvider from '@/components/providers/AppTooltipProvider'
import { StudyUserImportJobsProvider } from '@/context/StudyUserImportJobsContext'
import './globals.css'
import { APP_BRANDING } from '@/lib/config/appBranding'
import {
  DEVELOPER_ATTRIBUTION_LINE,
  DEVELOPER_ATTRIBUTION_META_NAME,
} from '@/lib/config/developerAttribution'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: APP_BRANDING.productName,
  description: `${APP_BRANDING.productName} — ${APP_BRANDING.platformTitle}`,
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  other: {
    [DEVELOPER_ATTRIBUTION_META_NAME]: DEVELOPER_ATTRIBUTION_LINE,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" data-edc-application-developer={DEVELOPER_ATTRIBUTION_LINE}>
      <body className={`font-sans antialiased`}>
        <span hidden aria-hidden="true" data-edc-developer-attribution={DEVELOPER_ATTRIBUTION_LINE}>
          {DEVELOPER_ATTRIBUTION_LINE}
        </span>
        <VisitAttachmentUploadProvider>
          <ReportExportJobsProvider>
            <AppTimeProvider>
              <AppTooltipProvider>
                <StudyUserImportJobsProvider>
                  {children}
                </StudyUserImportJobsProvider>
              </AppTooltipProvider>
            </AppTimeProvider>
          </ReportExportJobsProvider>
          <ToasterClient />
          <DisableNumberInputScroll />
          {DEVREV_WIDGET_ENABLED ? <DevRevWidgetInitializer /> : null}
          {DEVREV_WIDGET_ENABLED && process.env.NODE_ENV === "production" && (
            <Script
              id="devrev-plug-widget"
              src="https://plug-platform.devrev.ai/static/plug.js"
              strategy="afterInteractive"
            />
          )}
        </VisitAttachmentUploadProvider>
      </body>
    </html>
  )
}