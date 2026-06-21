export type SseFrame = {
  event?: string;
  data: string;
  id?: string;
};

export function encodeSseFrame(frame: SseFrame): string {
  const lines = [];
  if (frame.id) {
    lines.push(`id: ${frame.id}`);
  }
  if (frame.event) {
    lines.push(`event: ${frame.event}`);
  }
  for (const line of frame.data.split("\n")) {
    lines.push(`data: ${line}`);
  }
  return `${lines.join("\n")}\n\n`;
}

export function parseSseFrames(input: string): SseFrame[] {
  const frames: SseFrame[] = [];

  for (const block of input.replaceAll("\r\n", "\n").split("\n\n")) {
    if (!block.trim()) {
      continue;
    }

    const data: string[] = [];
    let event: string | undefined;
    let id: string | undefined;

    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) {
        continue;
      }
      if (line.startsWith("data:")) {
        data.push(line.slice(5).trimStart());
      } else if (line.startsWith("event:")) {
        event = line.slice(6).trimStart();
      } else if (line.startsWith("id:")) {
        id = line.slice(3).trimStart();
      }
    }

    if (data.length > 0) {
      frames.push({
        data: data.join("\n"),
        ...(event ? { event } : {}),
        ...(id ? { id } : {}),
      });
    }
  }

  return frames;
}
