import crypto from "crypto";
import { prisma } from "./prisma";
import { validateSafeWebhookUrl } from "./security";
import type { Prisma } from "@prisma/client";

export type WebhookEventType = "issue.created" | "issue.updated" | "issue.status_changed";

export function dispatchWebhooks(
  workspaceId: string,
  event: WebhookEventType,
  data: Record<string, unknown>
): void {
  // Fire and forget so UI/API stays fast (< 100ms)
  void (async () => {
    try {
      const hooks = await prisma.webhook.findMany({
        where: {
          workspaceId,
          isActive: true,
          events: { has: event },
        },
      });

      if (hooks.length === 0) return;

      const payloadObj = {
        event,
        timestamp: new Date().toISOString(),
        workspaceId,
        data,
      };
      const bodyStr = JSON.stringify(payloadObj);

      await Promise.all(
        hooks.map(async (hook) => {
          const signature = crypto
            .createHmac("sha256", hook.secret)
            .update(bodyStr)
            .digest("hex");

          let statusCode: number | null = null;
          let success = false;
          let errorMsg: string | null = null;

          try {
            const safeCheck = await validateSafeWebhookUrl(hook.url);
            if (!safeCheck.ok) {
              errorMsg = `Blocked by SSRF policy: ${safeCheck.reason}`;
            } else {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 5000);
              const res = await fetch(safeCheck.url.toString(), {
                method: "POST",
                redirect: "manual",
                headers: {
                  "Content-Type": "application/json",
                  "X-OpenTrack-Event": event,
                  "X-OpenTrack-Signature": `sha256=${signature}`,
                  "User-Agent": "OpenTrack-Webhook/1.0",
                },
                body: bodyStr,
                signal: controller.signal,
              });
              clearTimeout(timeout);
              statusCode = res.status;
              success = res.ok;
              if (!res.ok) {
                errorMsg = `HTTP ${res.status} ${res.statusText}`;
              }
            }
          } catch (err) {
            errorMsg = err instanceof Error ? err.message : "Network error";
          }

          await prisma.webhookDelivery.create({
            data: {
              webhookId: hook.id,
              event,
              statusCode,
              success,
              error: errorMsg,
              payload: payloadObj as Prisma.InputJsonValue,
            },
          });
        })
      );
    } catch (err) {
      console.error("[Webhook Dispatcher Error]", err);
    }
  })();
}
