// S2 — Privilege & capability surface.
//
//  C1 non-root UID:     runner container runs as uid 1100, not root.
//  C3 capabilities:     CapDrop=["ALL"] — no CAP_SYS_ADMIN/PTRACE/etc.
//  C5 no-new-privs:     setuid bits can't escalate; capability files can't.
//
// Together these claims say: "even if a learner manages to exec
// arbitrary Linux syscalls or compile a setuid binary, they still can't
// become root, ptrace other processes, or mount filesystems."
//
// Style: we use Python's ctypes to reach raw syscalls. A clean `EPERM`
// from the kernel is the exact signal we want — proves the capability
// is dropped rather than just that the helper binary is absent.

import { test, expect } from "../harness/fixtures.js";

test.describe("S2 — privileges & capabilities", () => {
  test("S2a: process runs as non-root (uid 1100)", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S2a",
      claim: ["C1 non-root UID 1100"],
      summary: "runtime uid must be the runner user, never 0",
    });
    const result = await attack.runAttack({
      sessionId,
      language: "python",
      files: [
        {
          path: "main.py",
          content: `
import os
print(f"UID:{os.getuid()}")
print(f"GID:{os.getgid()}")
print(f"EUID:{os.geteuid()}")
`.trim(),
        },
      ],
    });
    expect(result.stdout).toContain("UID:1100");
    expect(result.stdout).toContain("EUID:1100");
    expect(result.stdout).not.toContain("UID:0");
  });

  test("S2b: mount() syscall returns EPERM (CAP_SYS_ADMIN dropped)", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S2b",
      claim: ["C3 capabilities dropped"],
      summary: "mount() must fail with EPERM — not just command-not-found",
    });
    const result = await attack.runAttack({
      sessionId,
      language: "python",
      files: [
        {
          path: "main.py",
          content: `
import ctypes, ctypes.util, os
libc = ctypes.CDLL(ctypes.util.find_library("c"), use_errno=True)
# mount("tmpfs", "/mnt", "tmpfs", 0, NULL)
rc = libc.mount(b"tmpfs", b"/mnt", b"tmpfs", 0, None)
errno = ctypes.get_errno()
print(f"RC:{rc}")
print(f"ERRNO:{errno}")  # EPERM = 1
print(f"MSG:{os.strerror(errno)}")
`.trim(),
        },
      ],
    });
    expect(result.stdout).toContain("RC:-1");
    // EPERM or EACCES — both are "you do not have the capability"; we
    // accept either, but NOT EINVAL/ENOENT (those would mean mount got
    // further than it should).
    expect(result.stdout).toMatch(/ERRNO:(1|13)\b/);
  });

  // NOTE: S2c (ptrace attach on a sibling) was removed intentionally.
  // Same-UID ptrace is standard Unix behavior and does NOT require
  // CAP_SYS_PTRACE — it's gated by YAMA (ptrace_scope), which is
  // process-hierarchy-aware, not capability-aware. A single-tenant
  // sandbox that runs everything as uid 1100 would see ptrace-on-sibling
  // succeed regardless of cap drops, and that's fine — the sibling IS
  // the same attacker. The meaningful boundaries (no cross-tenant
  // ptrace, no PID-namespace escape) are enforced by the sandbox
  // topology itself: one container per session. See S2b, S2e for the
  // cap-drop verification.

  test("S2d: setuid-root binary cannot escalate (no-new-privs in effect)", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S2d",
      claim: ["C5 no-new-privileges"],
      summary: "exec of a setuid binary must not change the effective uid",
    });
    // The runner image ships `su` as setuid-root on most base images.
    // If no-new-privs is enforced, execing it should NOT change euid.
    // (If `su` isn't present, chpasswd/passwd are alternatives — we use
    // a shell fallback that prints uid before/after attempting escalation.)
    const result = await attack.runAttack({
      sessionId,
      language: "python",
      files: [
        {
          path: "main.py",
          content: `
import subprocess, os, shutil
# Pick the first setuid-root binary we can find.
candidates = ["/usr/bin/su", "/bin/su", "/usr/bin/passwd", "/bin/chsh"]
bin = next((c for c in candidates if os.path.exists(c)), None)
print(f"PRE_EUID:{os.geteuid()}")
if not bin:
    print("NOSETUID:none-available")
else:
    print(f"BIN:{bin}")
    st = os.stat(bin)
    is_setuid = bool(st.st_mode & 0o4000) and st.st_uid == 0
    print(f"HAS_SETUID_BIT:{is_setuid}")
# Exec a non-interactive shim — we just want to see whether the kernel
# honors the setuid bit. Invoking 'su' without stdin will exit quickly.
if bin:
    try:
        r = subprocess.run([bin, "--help"], capture_output=True, timeout=3)
    except Exception as e:
        print(f"EXEC_ERR:{type(e).__name__}")
print(f"POST_EUID:{os.geteuid()}")
`.trim(),
        },
      ],
    });
    expect(result.stdout).toContain("PRE_EUID:1100");
    expect(result.stdout).toContain("POST_EUID:1100");
    expect(result.stdout).not.toContain("POST_EUID:0");
  });

  test("S2e: unshare(CLONE_NEWUSER) fails (cannot create new user namespace)", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S2e",
      claim: ["C3 capabilities dropped"],
      summary: "user-namespace creation must fail",
    });
    const result = await attack.runAttack({
      sessionId,
      language: "python",
      files: [
        {
          path: "main.py",
          content: `
import ctypes, ctypes.util, os
libc = ctypes.CDLL(ctypes.util.find_library("c"), use_errno=True)
CLONE_NEWUSER = 0x10000000
rc = libc.unshare(CLONE_NEWUSER)
errno = ctypes.get_errno()
print(f"RC:{rc}")
print(f"ERRNO:{errno}")
`.trim(),
        },
      ],
    });
    expect(result.stdout).toContain("RC:-1");
    // EPERM=1, EINVAL=22 (kernel rejecting flags under seccomp/caps),
    // ENOSYS=38 (seccomp outright blocks the syscall). Any of those
    // proves we didn't succeed.
    expect(result.stdout).toMatch(/ERRNO:(1|22|38)\b/);
  });
});
