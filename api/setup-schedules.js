import { authorized, cors } from "../lib/common.js";

const DESTINATION = "https://megacheck.vercel.app/api/push-check";

const schedules = [
  {
    id: "megapass-guard-2200",
    cron: "CRON_TZ=Asia/Seoul 0 22 * * *",
    level: "early",
  },
  {
    id: "megapass-guard-2300",
    cron: "CRON_TZ=Asia/Seoul 0 23 * * *",
    level: "urgent",
  },
  {
    id: "megapass-guard-2320",
    cron: "CRON_TZ=Asia/Seoul 20 23 * * *",
    level: "final",
  },
];

export default async function handler(req, res) {
  cors(res, "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "method not allowed",
    });
  }

  if (!authorized(req)) {
    return res.status(401).json({
      error: "unauthorized",
    });
  }

  const qstashToken =
    process.env.QSTASH_TOKEN ||
    process.env.US_EAST_1_QSTASH_TOKEN;

  const qstashUrl = (
    process.env.QSTASH_URL ||
    process.env.US_EAST_1_QSTASH_URL ||
    "https://qstash-us-east-1.upstash.io"
  ).replace(/\/$/, "");

  const accessToken = process.env.ACCESS_TOKEN;

  if (!qstashToken) {
    return res.status(500).json({
      error: "QStash token is missing",
    });
  }

  if (!accessToken) {
    return res.status(500).json({
      error: "ACCESS_TOKEN is missing",
    });
  }

  try {
    const created = [];

    for (const schedule of schedules) {
      /*
       * QStash 공식 형식:
       *
       * POST
       * https://qstash-{region}.upstash.io/v2/schedules/{destination}
       *
       * destination은 encodeURIComponent 하지 않는다.
       */
      const response = await fetch(
        `${qstashUrl}/v2/schedules/${DESTINATION}`,
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${qstashToken}`,

            "Content-Type": "application/json",

            "Upstash-Cron": schedule.cron,

            "Upstash-Schedule-Id": schedule.id,

            "Upstash-Retries": "2",

            /*
             * QStash가 실제 push-check를 호출할 때
             *
             * Authorization: Bearer ACCESS_TOKEN
             *
             * 으로 전달한다.
             */
            "Upstash-Forward-Authorization":
              `Bearer ${accessToken}`,
          },

          body: JSON.stringify({
            level: schedule.level,
          }),
        }
      );

      const raw = await response.text();

      let result;

      try {
        result = JSON.parse(raw);
      } catch {
        result = {
          raw,
        };
      }

      if (!response.ok) {
        return res.status(502).json({
          error: "QStash schedule creation failed",
          schedule: schedule.id,
          qstashStatus: response.status,
          qstashResponse: result,
          qstashUrl,
        });
      }

      created.push({
        id: schedule.id,
        cron: schedule.cron,
        qstash: result,
      });
    }

    return res.status(200).json({
      ok: true,
      region: qstashUrl,
      destination: DESTINATION,
      schedules: created,
    });
  } catch (error) {
    console.error("QStash setup error:", error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unknown QStash error",
    });
  }
}
