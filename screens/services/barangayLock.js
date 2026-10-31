import { BASE_URL, getSession } from "./api";

// Returns the user's barangay name in UPPERCASE (e.g. "MOLINO II") or null
export async function getMyBarangayName() {
  try {
    const session = await getSession();
    if (!session?.token) return null;

    let code = session?.user?.assigned_barangay_code || null;
    try {
      const res = await fetch(`${BASE_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const data = await res.json();
      if (data?.user?.barangay_code) code = data.user.barangay_code;
    } catch {}

    if (!code) return null;
    let name = String(code);

    if (/^\d+$/.test(name)) {
      try {
        const r = await fetch(
          `https://psgc.gitlab.io/api/barangays/${code}.json`,
        );
        const b = await r.json();
        if (b?.name) name = b.name;
      } catch {}
    }
    return name.trim().toUpperCase();
  } catch {
    return null;
  }
}
