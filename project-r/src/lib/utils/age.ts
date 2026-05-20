export function ageInYears(birthdate: string): number {
  const dob = new Date(birthdate);

  // Fail-safe: invalid date string or future birthdate returns 0 (treat as minor)
  if (isNaN(dob.getTime())) {
    return 0;
  }

  const today = new Date();
  if (dob > today) {
    return 0;
  }

  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}
