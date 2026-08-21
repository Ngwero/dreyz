export type PasswordStrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

export type PasswordChecks = {
  minLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  longEnough: boolean;
};

export type PasswordStrength = {
  score: number;
  level: PasswordStrengthLevel;
  label: string;
  checks: PasswordChecks;
  hints: string[];
};

const LEVELS: { min: number; level: PasswordStrengthLevel; label: string }[] = [
  { min: 4, level: "strong", label: "Strong" },
  { min: 3, level: "good", label: "Good" },
  { min: 2, level: "fair", label: "Fair" },
  { min: 1, level: "weak", label: "Weak" },
];

export function getPasswordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= 6,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
    longEnough: password.length >= 10,
  };
}

export function scorePassword(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      level: "empty",
      label: "",
      checks: getPasswordChecks(""),
      hints: [],
    };
  }

  const checks = getPasswordChecks(password);
  let score = 0;
  if (checks.minLength) score += 1;
  if (checks.hasLower && checks.hasUpper) score += 1;
  if (checks.hasNumber) score += 1;
  if (checks.hasSpecial) score += 1;
  if (checks.longEnough) score += 1;

  // Cap weak short passwords even if they hit character classes
  if (password.length < 6) score = Math.min(score, 1);

  const matched = LEVELS.find((l) => score >= l.min) ?? {
    level: "weak" as const,
    label: "Weak",
  };

  const hints: string[] = [];
  if (!checks.minLength) hints.push("Use at least 6 characters");
  else if (!checks.longEnough) hints.push("Make it 10+ characters");
  if (!(checks.hasLower && checks.hasUpper)) hints.push("Mix upper & lower case");
  if (!checks.hasNumber) hints.push("Add a number");
  if (!checks.hasSpecial) hints.push("Add a symbol (!@#…)");

  return {
    score: Math.min(score, 4),
    level: matched.level,
    label: matched.label,
    checks,
    hints: hints.slice(0, 2),
  };
}

/** Minimum acceptable strength for new / changed passwords. */
export function isPasswordAcceptable(password: string): boolean {
  const { checks, level } = scorePassword(password);
  return checks.minLength && level !== "weak" && level !== "empty";
}
