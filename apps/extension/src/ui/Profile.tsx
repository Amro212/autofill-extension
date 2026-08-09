import type {
  ApplicantProfile,
  ApplicantProfileUpdate,
} from "@job-copilot/contracts";
import { type FormEvent, useEffect, useRef, useState } from "react";

export interface ProfileProps {
  profile: ApplicantProfile;
  onSave: (update: ApplicantProfileUpdate) => Promise<ApplicantProfile>;
}

export function Profile({ profile, onSave }: ProfileProps) {
  // Identity
  const [firstName, setFirstName] = useState(profile.identity.firstName ?? "");
  const [middleName, setMiddleName] = useState(profile.identity.middleName ?? "");
  const [lastName, setLastName] = useState(profile.identity.lastName ?? "");
  const [preferredName, setPreferredName] = useState(profile.identity.preferredName ?? "");

  // Contact
  const [email, setEmail] = useState(profile.contact.email ?? "");
  const [phone, setPhone] = useState(profile.contact.phone ?? "");
  const [city, setCity] = useState(profile.contact.city ?? "");
  const [region, setRegion] = useState(profile.contact.region ?? "");
  const [country, setCountry] = useState(profile.contact.country ?? "");
  const [postalCode, setPostalCode] = useState(profile.contact.postalCode ?? "");
  const [linkedin, setLinkedin] = useState(profile.contact.linkedin ?? "");
  const [github, setGithub] = useState(profile.contact.github ?? "");
  const [portfolio, setPortfolio] = useState(profile.contact.portfolio ?? "");

  // Preferences
  const [remote, setRemote] = useState(profile.preferences.remote ?? false);
  const [hybrid, setHybrid] = useState(profile.preferences.hybrid ?? false);
  const [onsite, setOnsite] = useState(profile.preferences.onsite ?? false);
  const [relocation, setRelocation] = useState(profile.preferences.relocation ?? false);
  const [startDate, setStartDate] = useState(profile.preferences.startDate ?? "");

  // Eligibility (stored as Record<string, JsonValue>)
  const eligibility = profile.eligibility ?? {};
  const [workAuth, setWorkAuth] = useState(
    typeof eligibility.workAuthorization === "boolean" ? eligibility.workAuthorization : false,
  );
  const [sponsorship, setSponsorship] = useState(
    typeof eligibility.requiresSponsorship === "boolean" ? eligibility.requiresSponsorship : false,
  );

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    identity: true,
    contact: true,
    links: false,
    preferences: false,
    eligibility: false,
    experience: false,
  });
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setFirstName(profile.identity.firstName ?? "");
    setMiddleName(profile.identity.middleName ?? "");
    setLastName(profile.identity.lastName ?? "");
    setPreferredName(profile.identity.preferredName ?? "");
    setEmail(profile.contact.email ?? "");
    setPhone(profile.contact.phone ?? "");
    setCity(profile.contact.city ?? "");
    setRegion(profile.contact.region ?? "");
    setCountry(profile.contact.country ?? "");
    setPostalCode(profile.contact.postalCode ?? "");
    setLinkedin(profile.contact.linkedin ?? "");
    setGithub(profile.contact.github ?? "");
    setPortfolio(profile.contact.portfolio ?? "");
    setRemote(profile.preferences.remote ?? false);
    setHybrid(profile.preferences.hybrid ?? false);
    setOnsite(profile.preferences.onsite ?? false);
    setRelocation(profile.preferences.relocation ?? false);
    setStartDate(profile.preferences.startDate ?? "");
    const elig = profile.eligibility ?? {};
    setWorkAuth(typeof elig.workAuthorization === "boolean" ? elig.workAuthorization : false);
    setSponsorship(typeof elig.requiresSponsorship === "boolean" ? elig.requiresSponsorship : false);
  }, [profile]);

  function toggleSection(key: string) {
    setExpandedSections((current) => ({ ...current, [key]: !current[key] }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    try {
      await onSave({
        identity: {
          ...(firstName === "" ? {} : { firstName }),
          ...(middleName === "" ? {} : { middleName }),
          ...(lastName === "" ? {} : { lastName }),
          ...(preferredName === "" ? {} : { preferredName }),
        },
        contact: {
          ...(email === "" ? {} : { email }),
          ...(phone === "" ? {} : { phone }),
          ...(city === "" ? {} : { city }),
          ...(region === "" ? {} : { region }),
          ...(country === "" ? {} : { country }),
          ...(postalCode === "" ? {} : { postalCode }),
          ...(linkedin === "" ? {} : { linkedin }),
          ...(github === "" ? {} : { github }),
          ...(portfolio === "" ? {} : { portfolio }),
        },
        preferences: {
          remote,
          hybrid,
          onsite,
          relocation,
          ...(startDate === "" ? {} : { startDate }),
        },
        eligibility: {
          workAuthorization: workAuth,
          requiresSponsorship: sponsorship,
        },
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const hasEducation = (profile.education?.length ?? 0) > 0;
  const hasEmployment = (profile.employment?.length ?? 0) > 0;
  const hasSkills = (profile.skills?.length ?? 0) > 0;

  return (
    <form onSubmit={submit} className="job-copilot-section">
      {/* Identity Section */}
      <button
        type="button"
        className="jc-section-header"
        aria-expanded={expandedSections.identity}
        onClick={() => toggleSection("identity")}
      >
        Personal Info
      </button>
      {expandedSections.identity && (
        <>
          <div className="jc-field-row">
            <label>
              First name
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
            </label>
            <label>
              Last name
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
            </label>
          </div>
          <div className="jc-field-row">
            <label>
              Middle name
              <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
            </label>
            <label>
              Preferred name
              <input value={preferredName} onChange={(e) => setPreferredName(e.target.value)} />
            </label>
          </div>
        </>
      )}

      {/* Contact Section */}
      <button
        type="button"
        className="jc-section-header"
        aria-expanded={expandedSections.contact}
        onClick={() => toggleSection("contact")}
      >
        Contact Details
      </button>
      {expandedSections.contact && (
        <>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
          </label>
          <label>
            Phone
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" />
          </label>
          <div className="jc-field-row">
            <label>
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Francisco" />
            </label>
            <label>
              State / Region
              <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="CA" />
            </label>
          </div>
          <div className="jc-field-row">
            <label>
              Country
              <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="United States" />
            </label>
            <label>
              Postal code
              <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="94102" />
            </label>
          </div>
        </>
      )}

      {/* Links Section */}
      <button
        type="button"
        className="jc-section-header"
        aria-expanded={expandedSections.links}
        onClick={() => toggleSection("links")}
      >
        Links &amp; Social
      </button>
      {expandedSections.links && (
        <>
          <label>
            LinkedIn
            <input type="url" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." />
          </label>
          <label>
            GitHub
            <input type="url" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/..." />
          </label>
          <label>
            Portfolio / Website
            <input type="url" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://..." />
          </label>
        </>
      )}

      {/* Work Preferences */}
      <button
        type="button"
        className="jc-section-header"
        aria-expanded={expandedSections.preferences}
        onClick={() => toggleSection("preferences")}
      >
        Work Preferences
      </button>
      {expandedSections.preferences && (
        <>
          <label className="jc-switch">
            <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
            Open to remote
          </label>
          <label className="jc-switch">
            <input type="checkbox" checked={hybrid} onChange={(e) => setHybrid(e.target.checked)} />
            Open to hybrid
          </label>
          <label className="jc-switch">
            <input type="checkbox" checked={onsite} onChange={(e) => setOnsite(e.target.checked)} />
            Open to on-site
          </label>
          <label className="jc-switch">
            <input type="checkbox" checked={relocation} onChange={(e) => setRelocation(e.target.checked)} />
            Willing to relocate
          </label>
          <label>
            Earliest start date
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
        </>
      )}

      {/* Eligibility */}
      <button
        type="button"
        className="jc-section-header"
        aria-expanded={expandedSections.eligibility}
        onClick={() => toggleSection("eligibility")}
      >
        Work Authorization
      </button>
      {expandedSections.eligibility && (
        <>
          <label className="jc-switch">
            <input type="checkbox" checked={workAuth} onChange={(e) => setWorkAuth(e.target.checked)} />
            Authorized to work in target country
          </label>
          <label className="jc-switch">
            <input type="checkbox" checked={sponsorship} onChange={(e) => setSponsorship(e.target.checked)} />
            Requires visa sponsorship
          </label>
        </>
      )}

      {/* Read-only summaries from resume parsing */}
      {(hasEducation || hasEmployment || hasSkills) && (
        <>
          <button
            type="button"
            className="jc-section-header"
            aria-expanded={expandedSections.experience}
            onClick={() => toggleSection("experience")}
          >
            Experience &amp; Skills
          </button>
          {expandedSections.experience && (
            <>
              {hasEmployment && (
                <div className="jc-profile-summary">
                  <h4>Employment ({profile.employment.length})</h4>
                  <ul>
                    {profile.employment.slice(0, 3).map((job) => (
                      <li key={job.id}>
                        <strong>{job.title}</strong> at {job.company}
                        {job.current ? " · Current" : ""}
                      </li>
                    ))}
                    {profile.employment.length > 3 && (
                      <li>+{profile.employment.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}
              {hasEducation && (
                <div className="jc-profile-summary">
                  <h4>Education ({profile.education.length})</h4>
                  <ul>
                    {profile.education.slice(0, 3).map((edu) => (
                      <li key={edu.id}>
                        {edu.degree ? `${edu.degree}, ` : ""}{edu.institution}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {hasSkills && (
                <div className="jc-profile-summary">
                  <h4>Skills ({profile.skills.length})</h4>
                  <p>{profile.skills.slice(0, 8).map((s) => s.name).join(" · ")}{profile.skills.length > 8 ? " ..." : ""}</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      <button type="submit" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save profile"}
      </button>
      {status === "saved" && <small role="status">✓ Profile saved</small>}
      {status === "error" && <small role="alert">Could not save profile</small>}
    </form>
  );
}
