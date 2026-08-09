import type {
  ApplicantProfile,
  ApplicantProfileUpdate,
} from "@job-copilot/contracts";
import { type FormEvent, useEffect, useState } from "react";

export interface ProfileProps {
  profile: ApplicantProfile;
  onSave: (update: ApplicantProfileUpdate) => Promise<ApplicantProfile>;
}

export function Profile({ profile, onSave }: ProfileProps) {
  const [firstName, setFirstName] = useState(profile.identity.firstName ?? "");
  const [lastName, setLastName] = useState(profile.identity.lastName ?? "");
  const [email, setEmail] = useState(profile.contact.email ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  useEffect(() => {
    setFirstName(profile.identity.firstName ?? "");
    setLastName(profile.identity.lastName ?? "");
    setEmail(profile.contact.email ?? "");
  }, [profile]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    try {
      await onSave({
        identity: {
          ...(firstName === "" ? {} : { firstName }),
          ...(lastName === "" ? {} : { lastName }),
        },
        contact: email === "" ? {} : { email },
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={submit} className="job-copilot-section">
      <h2>Profile</h2>
      <label>
        First name
        <input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
      </label>
      <label>
        Last name
        <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
      </label>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <button type="submit" disabled={status === "saving"}>Save profile</button>
      {status === "saved" && <small role="status">Profile saved</small>}
      {status === "error" && <small role="alert">Could not save profile</small>}
    </form>
  );
}

