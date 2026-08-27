import { Hono } from "hono";

export const systemRoutes = new Hono();

export const CURRENT_VERSION = "0.1.0";
const GITHUB_REPO = "Kazbonfim2/Upy";

interface UpdateCache {
  hasUpdate: boolean;
  currentVersion: string;
  currentCommit: string | null;
  latestVersion: string;
  releaseUrl: string;
  checkedAt: number;
}

let updateCache: UpdateCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getLocalCommit(): Promise<string | null> {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT.substring(0, 7);
  try {
    const proc = Bun.spawn(["git", "rev-parse", "--short", "HEAD"], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const text = (await new Response(proc.stdout).text()).trim();
    return text || null;
  } catch {
    return null;
  }
}

systemRoutes.get("/status", async (c) => {
  const force = c.req.query("force") === "true";
  const now = Date.now();

  if (!force && updateCache && now - updateCache.checkedAt < CACHE_TTL_MS) {
    return c.json(updateCache);
  }

  const localCommit = await getLocalCommit();
  let hasUpdate = false;
  let latestVersion = CURRENT_VERSION;
  let releaseUrl = `https://github.com/${GITHUB_REPO}`;

  try {
    // 1. Check latest GitHub Release
    const releaseRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: { "User-Agent": "Upy-Updater" },
      },
    );

    if (releaseRes.ok) {
      const release = (await releaseRes.json()) as { tag_name: string; html_url: string };
      latestVersion = release.tag_name;
      hasUpdate = release.tag_name.replace(/^v/, "") !== CURRENT_VERSION;
      releaseUrl = release.html_url;
    } else {
      // 2. Fallback to latest commit on main for git clone deployments
      const commitRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/commits/main`,
        {
          headers: { "User-Agent": "Upy-Updater" },
        },
      );

      if (commitRes.ok) {
        const commit = (await commitRes.json()) as { sha: string; html_url: string };
        const remoteSha = commit.sha.substring(0, 7);
        latestVersion = remoteSha;
        releaseUrl = commit.html_url;
        if (localCommit && remoteSha !== localCommit) {
          hasUpdate = true;
        }
      }
    }

    updateCache = {
      hasUpdate,
      currentVersion: CURRENT_VERSION,
      currentCommit: localCommit,
      latestVersion,
      releaseUrl,
      checkedAt: now,
    };
  } catch {
    // Network or API failure, fallback gracefully
  }

  return c.json(
    updateCache ?? {
      hasUpdate: false,
      currentVersion: CURRENT_VERSION,
      currentCommit: localCommit,
      latestVersion: CURRENT_VERSION,
      releaseUrl,
      checkedAt: now,
    },
  );
});
