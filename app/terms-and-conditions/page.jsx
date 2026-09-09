import { APP_BRANDING } from "@/lib/config/appBranding"
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_PLATFORM_DESCRIPTION,
  LEGAL_PLATFORM_NAME,
  LEGAL_REGISTERED_OFFICE,
} from "@/lib/config/legalContent"

export const metadata = {
  title: `Terms and Conditions - ${APP_BRANDING.productName}`,
  description: `Terms and Conditions for ${APP_BRANDING.productName} ${APP_BRANDING.platformDescription}`,
}

export default function TermsAndConditionsPage() {
  const platform = LEGAL_PLATFORM_NAME
  const registeredOffice = LEGAL_REGISTERED_OFFICE

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms & Conditions</h1>
        <p className="text-sm text-slate-500 mb-6">{LEGAL_PLATFORM_DESCRIPTION}</p>

        <div className="prose prose-slate max-w-none space-y-6 text-sm">
          <section>
            <p className="text-slate-700 leading-relaxed mb-4">
              The <strong>{platform}</strong> electronic data capture platform (<strong>&quot;Platform&quot;</strong>) is
              operated by <strong>{platform}</strong> (hereinafter referred to as <strong>&quot;we&quot;</strong>,{" "}
              <strong>&quot;us&quot;</strong> or <strong>&quot;our&quot;</strong>), with operations in{" "}
              <strong>{registeredOffice}</strong>. For enquiries, contact{" "}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-emerald-700 hover:text-emerald-800 underline">
                {LEGAL_CONTACT_EMAIL}
              </a>
              .
            </p>
            <p className="text-slate-700 leading-relaxed mb-4">
              By accessing or using the Platform, creating an account, or entering clinical study data, you agree to be bound
              by these Terms of Use (<strong>&quot;Terms&quot;</strong>) and our applicable privacy and security policies.
              Together they form a binding agreement (<strong>&quot;Agreement&quot;</strong>) between you and {platform}.
            </p>
            <p className="text-slate-700 leading-relaxed mb-4">
              Please read these Terms carefully before using the Platform. If you do not agree, you must not access or use
              the Platform or any related services (<strong>&quot;Services&quot;</strong>).
            </p>
            <p className="text-slate-700 leading-relaxed mb-4">This Agreement applies to you whether you are:</p>
            <ol className="list-decimal pl-6 mt-2 space-y-2 text-slate-700">
              <li>
                A sponsor, contract research organisation, site, investigator, coordinator, monitor, or other authorised
                study personnel (<strong>&quot;Study User&quot;</strong>); or
              </li>
              <li>
                An administrator or support user managing studies, sites, users, or configuration on the Platform; or
              </li>
              <li>Any other person authorised to access the Platform (<strong>&quot;you&quot;</strong> or <strong>&quot;User&quot;</strong>).</li>
            </ol>
            <p className="text-slate-700 leading-relaxed mt-4">
              The Services include study configuration, electronic case report forms (eCRFs), patient enrolment, data entry,
              query management, reporting, audit trails, role-based access, and related clinical data management features
              made available through the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Account enrolment</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              To use the Services, you must establish a user account with credentials issued or approved by your study
              administrator. You agree to provide accurate, current, and complete information and to keep your account
              details up to date. You are responsible for safeguarding your login credentials and for all activity under
              your account. You must not share credentials or permit unauthorised access. Notify your administrator
              immediately if you suspect compromise of your account.
            </p>
            <p className="text-slate-700 leading-relaxed">
              You represent that you are at least 18 years of age and authorised to access the studies and data assigned to
              you. {platform} may suspend or terminate access if you breach these Terms, applicable law, or your study
              obligations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Acceptable use</h2>
            <ol className="list-decimal pl-6 mt-2 space-y-3 text-slate-700">
              <li>
                You will use the Platform only for legitimate clinical research and related operations authorised for your
                role and study protocol.
              </li>
              <li>
                You will comply with applicable laws and guidelines, including data protection requirements and good clinical
                practice, and with your organisation&apos;s policies and the protocol for each study.
              </li>
              <li>
                You will not copy, reverse engineer, scrape, resell, or misuse Platform content, except as permitted for
                your authorised study duties.
              </li>
              <li>
                You will not upload malware, attempt unauthorised access, or interfere with Platform security, audit trails,
                or other users.
              </li>
              <li>
                Clinical data entered through the Platform remains subject to sponsor, site, and regulatory obligations.
                {platform} provides the technology; study teams remain responsible for data accuracy and medical decisions.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Indemnification</h2>
            <p className="text-slate-700 leading-relaxed">
              You agree to indemnify and hold harmless {platform} and its affiliates, officers, directors,
              agents, and employees from claims, losses, and expenses (including reasonable legal fees) arising from your
              breach of this Agreement, misuse of the Platform, violation of law, or infringement of third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Limitation of liability</h2>
            <p className="text-slate-700 leading-relaxed">
              To the fullest extent permitted by law, {platform} and its affiliates shall not be liable for indirect,
              incidental, special, consequential, or punitive damages, or for loss of profits, data, or business arising
              from use of the Platform. Aggregate liability for any claim relating to the Services shall not exceed INR
              100, except where liability cannot be limited under applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Termination</h2>
            <ol className="list-decimal pl-6 mt-2 space-y-2 text-slate-700">
              <li>
                Your access may end when your study role ends, when your administrator deactivates your account, or when you
                stop using the Services.
              </li>
              <li>
                We may suspend or terminate access immediately if we reasonably believe you have breached these Terms or
                pose a security or compliance risk.
              </li>
              <li>Provisions intended to survive termination (including confidentiality, indemnity, and liability limits) shall survive.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Governing law and dispute resolution</h2>
            <p className="text-slate-700 leading-relaxed">
              This Agreement is governed by the laws of India. Courts at <strong>Ahmedabad, Gujarat</strong> shall have
              exclusive jurisdiction over disputes arising from or relating to the Platform and these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Miscellaneous</h2>
            <ol className="list-decimal pl-6 mt-2 space-y-3 text-slate-700">
              <li>If any provision is held invalid, the remaining provisions remain in effect.</li>
              <li>
                {platform} is not liable for delay or failure caused by events beyond reasonable control, including natural
                disasters, government action, war, epidemic, or network outages.
              </li>
              <li>Failure to enforce a right does not waive that right.</li>
              <li>
                These Terms, together with applicable study agreements and privacy notices, constitute the entire agreement
                regarding Platform use.
              </li>
              <li>
                We may update these Terms by posting a revised version on the Platform. Continued use after changes constitutes
                acceptance.
              </li>
              <li>
                Questions about these Terms should be sent to{" "}
                <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-emerald-700 hover:text-emerald-800 underline">
                  {LEGAL_CONTACT_EMAIL}
                </a>
                .
              </li>
            </ol>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            {platform} · {registeredOffice}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Contact:{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-emerald-700 hover:text-emerald-800 underline">
              {LEGAL_CONTACT_EMAIL}
            </a>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Last updated: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  )
}
