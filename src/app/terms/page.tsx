import type { Metadata } from "next";

import { LegalContact, LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  description: "The terms governing access to and use of vidi.",
  title: "Terms of service",
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="The agreement" title="Terms of service">
      <p>
        These Terms of Service (“Terms”) govern your access to and use of the
        vidi movie game, website, and related services (the “Service”). By using
        vidi, you agree to these Terms and the Privacy Policy.
      </p>

      <h2>1. Who may use vidi</h2>
      <p>
        You must be legally capable of agreeing to these Terms. vidi is not
        directed to children under 13. If the law where you live requires
        parental permission at a higher age, you may use vidi only with that
        permission.
      </p>

      <h2>2. Accounts and guest play</h2>
      <p>
        You may play as a guest without creating an account. Some features,
        including permanent profiles, friendships, saved watchlists, and game
        history, require an account. You are responsible for maintaining control
        of the email or Google account used to access vidi and for activity
        under your session.
      </p>
      <p>
        Provide accurate information, do not impersonate another person, and do
        not transfer or sell access to an account. Tell us promptly if you
        believe an account or session has been compromised.
      </p>

      <h2>3. Game rules and results</h2>
      <p>
        vidi is a social entertainment game. Compatibility scores, movie
        personalities, recommendations, winner labels, and humorous copy are
        generated from game answers and movie metadata. They are subjective,
        approximate, and provided for entertainment. They are not professional
        assessments or statements of fact about a person.
      </p>
      <p>
        Do not manipulate games, automate answers, interfere with another
        player, exploit technical vulnerabilities, or attempt to view answers
        before the results stage.
      </p>

      <h2>4. Friendships and public profiles</h2>
      <p>
        vidi uses mutual friendships rather than followers. Profiles are public
        by default and can display your username, display name, avatar, movie
        counts, and movie personality. Friend requests must be consensual. Do
        not use profile or friendship features to harass, threaten, stalk, spam,
        deceive, or collect information about others.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You may not:</p>
      <ul>
        <li>Use the Service for unlawful, fraudulent, or abusive activity.</li>
        <li>Impersonate others or use deceptive profile information.</li>
        <li>Probe, bypass, or disrupt security or access controls.</li>
        <li>Scrape the Service or use bots without written permission.</li>
        <li>Upload or link to malicious, infringing, or harmful material.</li>
        <li>Interfere with the availability or performance of vidi.</li>
        <li>
          Use another person&apos;s account or session without authorization.
        </li>
      </ul>

      <h2>6. Your content</h2>
      <p>
        You retain rights you have in profile names, avatars, and other material
        you provide. You grant vidi a worldwide, non-exclusive, royalty-free
        license to host, reproduce, process, and display that material only as
        needed to operate, secure, and improve the Service. You confirm that you
        have permission to provide it.
      </p>

      <h2>7. vidi and third-party content</h2>
      <p>
        The vidi name, interface, software, visual design, and original content
        are protected by applicable intellectual-property laws. These Terms do
        not transfer ownership of vidi or third-party material to you.
      </p>
      <p>
        Movie metadata and images may come from TMDB. This product uses the TMDB
        API but is not endorsed or certified by TMDB. TMDB and movie rights
        remain with their respective owners. Use of third-party services may
        also be governed by their own terms.
      </p>

      <h2>8. Changes and availability</h2>
      <p>
        We may change, suspend, or discontinue parts of the Service, including
        game modes or third-party integrations. We will try to avoid unnecessary
        disruption but do not promise that vidi will always be available,
        uninterrupted, or error-free.
      </p>

      <h2>9. Suspension and termination</h2>
      <p>
        You may stop using vidi at any time. We may restrict or terminate access
        when reasonably necessary to protect users, enforce these Terms, comply
        with law, prevent abuse, or secure the Service. Where appropriate, we
        will provide notice or an opportunity to appeal.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        To the extent permitted by law, the Service is provided “as is” and “as
        available.” We disclaim implied warranties that may legally be
        disclaimed, including merchantability, fitness for a particular purpose,
        and non-infringement. Nothing in these Terms excludes rights or
        warranties that cannot lawfully be excluded.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the extent permitted by law, vidi and its operator will not be liable
        for indirect, incidental, special, consequential, or punitive loss, or
        for lost data, profits, goodwill, or opportunities arising from use of
        the Service. Liability that cannot legally be excluded remains
        unaffected.
      </p>

      <h2>12. Governing terms and disputes</h2>
      <p>
        Applicable mandatory consumer and data-protection rights remain in
        place. Before public launch, the final Terms will identify the legal
        operator, governing law, and dispute forum appropriate to where that
        operator is established and where vidi is offered.
      </p>

      <h2>13. Changes to these Terms</h2>
      <p>
        We may update these Terms as the Service develops. We will update the
        effective date and provide additional notice for material changes. If
        you do not agree to an updated version, stop using the Service.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms can be sent to <LegalContact />.
      </p>
    </LegalPage>
  );
}
