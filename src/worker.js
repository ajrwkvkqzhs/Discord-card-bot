function hexToBytes(hex) {
  if (!hex || !/^(?:[0-9a-f]{2})+$/i.test(hex)) {
    throw new Error("Invalid hex");
  }
  return Uint8Array.from(
    hex.match(/.{2}/g),
    byte => parseInt(byte, 16)
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // D1 연결 테스트
    if (url.pathname === "/health") {
      if (!env.DB) {
        return Response.json({
          worker: "OK",
          database: "NOT CONNECTED"
        }, { status: 500 });
      }

      try {
        const result = await env.DB
          .prepare("SELECT 1 AS connected")
          .first();

        return Response.json({
          worker: "OK",
          database: result?.connected === 1 ? "OK" : "ERROR"
        });
      } catch {
        return Response.json({
          worker: "OK",
          database: "ERROR"
        }, { status: 500 });
      }
    }

    // Discord Interaction 요청
    if (url.pathname === "/interactions") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405
        });
      }

      const signature = request.headers.get(
        "X-Signature-Ed25519"
      );
      const timestamp = request.headers.get(
        "X-Signature-Timestamp"
      );

      if (!signature || !timestamp) {
        return new Response("Unauthorized", {
          status: 401
        });
      }

      try {
        const body = await request.text();

        // Discord Ed25519 서명 검증
        const key = await crypto.subtle.importKey(
          "raw",
          hexToBytes(env.DISCORD_PUBLIC_KEY),
          { name: "Ed25519" },
          false,
          ["verify"]
        );

        const valid = await crypto.subtle.verify(
          "Ed25519",
          key,
          hexToBytes(signature),
          new TextEncoder().encode(timestamp + body)
        );

        if (!valid) {
          return new Response("Invalid signature", {
            status: 401
          });
        }

        const interaction = JSON.parse(body);

        // Discord 엔드포인트 인증
        if (interaction.type === 1) {
          return Response.json({ type: 1 });
        }

        // 슬래시 명령어 테스트 응답
        if (interaction.type === 2) {
          return Response.json({
            type: 4,
            data: {
              content: "디스코드 봇 연결 성공!"
            }
          });
        }

        return Response.json({
          type: 4,
          data: {
            content: "아직 준비 중인 기능입니다."
          }
        });
      } catch {
        return new Response("Invalid request", {
          status: 400
        });
      }
    }

    return new Response("Discord Card Bot is running!");
  }
};
