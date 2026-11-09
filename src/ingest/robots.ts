// Minimal robots.txt reader: User-agent groups, Allow/Disallow with
// longest-match precedence, `*` wildcards and `$` end anchors. Pure.

interface Rule {
  allow: boolean;
  pattern: string;
}

export interface Robots {
  isAllowed(pathAndQuery: string): boolean;
}

export const ALLOW_ALL: Robots = { isAllowed: () => true };
export const DISALLOW_ALL: Robots = { isAllowed: () => false };

function toRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Parses robots.txt and returns the rules that apply to `userAgent` (falls back to `*`). */
export function parseRobots(text: string, userAgent: string): Robots {
  const token = userAgent.split("/")[0].toLowerCase();
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === "allow" || key === "disallow") {
      lastWasAgent = false;
      if (!current) continue;
      if (key === "disallow" && value === "") continue; // "Disallow:" = allow everything
      current.rules.push({ allow: key === "allow", pattern: value });
    } else {
      lastWasAgent = false;
    }
  }

  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && a !== "" && token.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules).map((r) => ({ ...r, re: toRegExp(r.pattern) }));

  return {
    isAllowed(pathAndQuery: string) {
      let best: { allow: boolean; len: number } | null = null;
      for (const r of rules) {
        if (!r.re.test(pathAndQuery)) continue;
        const len = r.pattern.length;
        // Longest match wins; on a tie Allow wins.
        if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
      }
      return best ? best.allow : true;
    },
  };
}
