import Docker from "dockerode";
import { config } from "../../config.js";

const docker = new Docker();

export interface CreatedContainer {
  id: string;
}

export async function ensureRunnerImage(): Promise<void> {
  try {
    await docker.getImage(config.runnerImage).inspect();
  } catch {
    throw new Error(
      `Runner image "${config.runnerImage}" not found. Build it first: ` +
        `docker build -t ${config.runnerImage} ./runner-image`
    );
  }
}

export async function createSessionContainer(
  sessionId: string,
  hostWorkspacePath: string
): Promise<CreatedContainer> {
  const container = await docker.createContainer({
    Image: config.runnerImage,
    name: `ai-code-editor-session-${sessionId}`,
    Cmd: ["sleep", "infinity"],
    WorkingDir: "/workspace",
    User: "runner",
    Tty: false,
    AttachStdout: false,
    AttachStderr: false,
    NetworkDisabled: true,
    HostConfig: {
      AutoRemove: true,
      NetworkMode: "none",
      Memory: config.runner.memoryBytes,
      NanoCpus: config.runner.nanoCpus,
      PidsLimit: 256,
      Binds: [`${hostWorkspacePath}:/workspace`],
      SecurityOpt: ["no-new-privileges"],
    },
  });
  await container.start();
  return { id: container.id };
}

export async function destroyContainer(id: string): Promise<void> {
  try {
    const c = docker.getContainer(id);
    await c.stop({ t: 1 }).catch(() => {});
    // AutoRemove should delete it; force-remove if it lingers.
    await c.remove({ force: true }).catch(() => {});
  } catch {
    /* already gone */
  }
}

export async function isContainerAlive(id: string): Promise<boolean> {
  try {
    const info = await docker.getContainer(id).inspect();
    return info.State.Running === true;
  } catch {
    return false;
  }
}
