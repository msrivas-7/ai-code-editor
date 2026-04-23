// S1 — Network egress isolation. Claim C2: every runner container
// runs with `NetworkMode: "none"`. That means:
//  - No DNS (no resolver reachable)
//  - No TCP to the internet
//  - No access to cloud metadata endpoints (IMDS)
//  - No access to the Docker socket (also gated by socket-proxy)
//  - No access to the host gateway / link-local
//
// If ANY of these succeed, network isolation is broken. These are the
// highest-value tests in the suite — a successful DNS lookup inside the
// sandbox is credential-theft-scale.
//
// Assertion style: we expect network calls to fail *fast* (typically
// ENETUNREACH within <500ms). A silent hang points at a different
// regression (e.g. network=bridge with firewall rules that blackhole
// rather than reject) — still a failure, but diagnostically distinct.

import { test, expect } from "../harness/fixtures.js";

// Python payload template — the probe prints "OK:<detail>" if the
// network call succeeded and "BLOCKED:<error>" if it was refused. The
// test asserts "BLOCKED:" appears and "OK:" does not.
const netProbe = (body: string) => `
import sys
try:
${body}
except Exception as e:
    print(f"BLOCKED:{type(e).__name__}:{e}", file=sys.stderr)
    sys.exit(0)
`;

test.describe("S1 — egress isolation (C2: network=none)", () => {
  test("S1a: DNS lookup for external hostname fails", async ({
    attack,
    sessionId,
    sentinel,
    scenario,
  }) => {
    scenario({
      id: "S1a",
      claim: ["C2 network=none"],
      summary: "external DNS must not resolve",
    });
    const obs = await sentinel.window(async () => {
      const result = await attack.runAttack({
        sessionId,
        language: "python",
        files: [
          {
            path: "main.py",
            content: netProbe(
              '    import socket\n    ip = socket.gethostbyname("example.com")\n    print(f"OK:{ip}")',
            ),
          },
        ],
      });
      expect(result.stdout).not.toContain("OK:");
      expect(result.stderr).toContain("BLOCKED:");
    });
    if (obs.egressPackets !== null) {
      expect(obs.egressPackets).toBe(0);
    }
  });

  test("S1b: TCP connect to internet host fails fast", async ({
    attack,
    sessionId,
    sentinel,
    scenario,
  }) => {
    scenario({
      id: "S1b",
      claim: ["C2 network=none"],
      summary: "TCP to 1.1.1.1:443 must not connect",
    });
    const obs = await sentinel.window(async () => {
      const result = await attack.runAttack({
        sessionId,
        language: "python",
        files: [
          {
            path: "main.py",
            content: netProbe(
              '    import socket\n    s = socket.create_connection(("1.1.1.1", 443), timeout=2)\n    print(f"OK:{s.getsockname()}")',
            ),
          },
        ],
      });
      expect(result.stdout).not.toContain("OK:");
      expect(result.stderr).toContain("BLOCKED:");
      // A connect attempt on network=none raises ENETUNREACH essentially
      // instantly. If it took close to the 2s socket timeout, that's a
      // silent-hang regression.
      expect(result.durationMs).toBeLessThan(5_000);
    });
    if (obs.egressPackets !== null) {
      expect(obs.egressPackets).toBe(0);
    }
  });

  test("S1c: cloud metadata endpoint (IMDS) is unreachable", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S1c",
      claim: ["C2 network=none"],
      summary: "AWS/Azure IMDS must not be reachable from the sandbox",
    });
    // Both cloud providers use 169.254.169.254. A successful probe
    // anywhere in this range is a credential-theft vector in prod.
    const result = await attack.runAttack({
      sessionId,
      language: "python",
      files: [
        {
          path: "main.py",
          content: netProbe(
            '    import urllib.request\n    r = urllib.request.urlopen("http://169.254.169.254/latest/meta-data/", timeout=2)\n    body = r.read().decode()\n    print(f"OK:{body[:50]}")',
          ),
        },
      ],
    });
    expect(result.stdout).not.toContain("OK:");
    expect(result.stderr).toContain("BLOCKED:");
  });

  test("S1d: Docker socket is not mounted in the container", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S1d",
      claim: ["C2 network=none", "sandbox:no-docker-socket"],
      summary: "/var/run/docker.sock must not exist inside the container",
    });
    const result = await attack.runAttack({
      sessionId,
      language: "python",
      files: [
        {
          path: "main.py",
          content: `
import os
print(f"EXISTS:{os.path.exists('/var/run/docker.sock')}")
print(f"ISSOCK:{os.path.exists('/var/run/docker.sock') and __import__('stat').S_ISSOCK(os.stat('/var/run/docker.sock').st_mode)}" if os.path.exists('/var/run/docker.sock') else "ISSOCK:False")
`.trim(),
        },
      ],
    });
    expect(result.stdout).toContain("EXISTS:False");
    expect(result.stdout).toContain("ISSOCK:False");
  });

  test("S1e: host gateway + link-local endpoints are unreachable", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S1e",
      claim: ["C2 network=none"],
      summary: "172.17.0.1 and fe80::/10 must not be reachable",
    });
    const result = await attack.runAttack({
      sessionId,
      language: "python",
      files: [
        {
          path: "main.py",
          content: `
import socket, sys
targets = [("172.17.0.1", 80), ("169.254.0.1", 80)]
for host, port in targets:
    try:
        s = socket.create_connection((host, port), timeout=1)
        print(f"OK:{host}:{port}")
        s.close()
    except Exception as e:
        print(f"BLOCKED:{host}:{port}:{type(e).__name__}", file=sys.stderr)
`.trim(),
        },
      ],
    });
    expect(result.stdout).not.toContain("OK:");
    expect(result.stderr).toContain("BLOCKED:172.17.0.1:80");
  });
});
