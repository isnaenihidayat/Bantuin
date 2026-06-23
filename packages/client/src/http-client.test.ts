import { expect, test } from "bun:test";
import { BantuinClient } from "./http-client";
import { encodeSseFrame } from "./sse";

test("BantuinClient logs in and reuses the authenticated SSE contract", async () => {
  const requests: Request[] = [];
  const client = new BantuinClient({
    fetch: (async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.url.endsWith("/v1/auth/login")) {
        return Response.json({}, { headers: { "set-cookie": "bantuin_session=secret; Path=/" } });
      }
      if (request.url.endsWith("/v1/sessions")) {
        return Response.json({ session: { id: "ses_1" } }, { status: 201 });
      }
      return new Response(
        encodeSseFrame({ event: "message.delta", data: JSON.stringify({ delta: "Halo" }) }) +
          encodeSseFrame({ data: "[DONE]" }),
      );
    }) as typeof fetch,
  });

  await client.login("owner@example.com", "password panjang");
  const sessionId = await client.createSession();
  expect(await client.sendMessage(sessionId, "Hai", "request-123")).toBe("Halo");
  expect(requests[1]?.headers.get("cookie")).toBe("bantuin_session=secret");
  expect(requests[2]?.headers.get("x-csrf-token")).toBe("1");
});
